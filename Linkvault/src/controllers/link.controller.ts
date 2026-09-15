import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/Prisma";
import { generateUniqueShortCode } from "../services/shortCode.service";
import { ShortenUrlInput } from "../validators/shortenUrl.validator";
import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { getLinkFromCache, setLinkInCache } from "../services/cache.service";

/**
 * Controller to handle URL shortening.
 * Route: POST /api/links/shorten
 */
export const shortenUrl = async (
  req: Request<{}, {}, ShortenUrlInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { originalUrl, customAlias, expiresInDays } = req.body;

    let shortCode: string;

    // --- 1. Short Code Resolution ---
    // If the user specified a custom alias, check if it's already taken.
    // If not specified, let our service generate a collision-free 7-character code.
    if (customAlias) {
      const existingLink = await prisma.link.findUnique({
        where: { shortCode: customAlias },
      });

      if (existingLink) {
        // 409 Conflict is the standard HTTP status code when a resource already exists
        return res.status(409).json({
          error: "Custom alias is already in use. Please choose another one.",
        });
      }

      shortCode = customAlias;
    } else {
      // Generates a base58 nanoid and verifies DB uniqueness
      shortCode = await generateUniqueShortCode();
    }

    // --- 2. Expiration Handling ---
    // If expiresInDays is supplied, calculate absolute expiration timestamp (UTC)
    let expiresAt: Date | null = null;
    if (expiresInDays) {
      expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    }

    // --- 3. Database Insertion ---
    // We insert into PostgreSQL via Prisma. Notice we do not pass userId yet;
    // once JWT authentication is added in Step 5, req.user.id will be wired here.
    const newLink = await prisma.link.create({
      data: {
        originalUrl,
        shortCode,
        expiresAt,
      },
    });

    // --- 4. Dynamic Short URL Construction ---
    // Instead of hardcoding "http://localhost:5000", we derive the base URL from the incoming request.
    // This ensures it works seamlessly across localhost, Docker, or production domains.
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const shortUrl = `${baseUrl}/${newLink.shortCode}`;

    // --- 5. HTTP Response ---
    // 201 Created signals that a new resource was successfully created on the server
    return res.status(201).json({
      shortCode: newLink.shortCode,
      shortUrl,
      originalUrl: newLink.originalUrl,
      createdAt: newLink.createdAt,
      expiresAt: newLink.expiresAt,
    });
  } catch (error: any) {
    // --- 6. Race Condition & Error Safeguard ---
    // Prisma error code P2002 indicates a unique constraint violation.
    // If two identical requests hit the server simultaneously and both passed the "findUnique" check
    // at the exact same millisecond, the database's UNIQUE constraint stops the second one here.
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        error: "Short code or alias collision occurred. Please try again.",
      });
    }

    // Pass any unexpected errors to the centralized error middleware in server.ts
    next(error);
  }
};

/**
 * Controller to handle short URL redirection and click analytics.
 * Route: GET /:shortCode
 */
export const redirectLink = async (
  req: Request<{ shortCode: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { shortCode } = req.params;

    // --- 1. Database Lookup ---
    // Look up link by shortCode. Because shortCode has a @unique constraint,
    // PostgreSQL uses a B-Tree index for an O(log N) lookup.
    // --- 1. Cache Lookup (Cache‑Aside) ---
    let link = null;
    try {
      const cached = await getLinkFromCache(shortCode);
      if (cached) {
        link = cached as any; // cached data matches Prisma Link shape
      }
    } catch (cacheErr) {
      console.error("Redis cache lookup error", cacheErr);
    }

    if (!link) {
      // Cache miss – fallback to DB
      link = await prisma.link.findUnique({
        where: { shortCode },
      });
      if (link) {
        // Populate cache for future requests
        try {
          await setLinkInCache(link);
        } catch (cacheSetErr) {
          console.error("Redis cache set error", cacheSetErr);
        }
      }
    }

    // --- 2. 404 Guard ---
    if (!link) {
      return res.status(404).json({
        error: "Short link not found or may have been deleted",
      });
    }

    // --- 3. Security Guard (Malicious Check) ---
    // If our upcoming AI scanner flagged this URL, block the user from being redirected
    if (link.isMalicious) {
      return res.status(403).json({
        error: "Access denied. This destination was flagged as unsafe or malicious.",
        reason: link.riskReason,
      });
    }

    // --- 4. Expiration Guard ---
    // If the link has an expiration date and current time has passed it, reject
    if (link.expiresAt && new Date() > link.expiresAt) {
      return res.status(410).json({
        error: "This link has expired and is no longer available.",
      });
    }

    // --- 5. Non-Blocking / Fire-and-Forget Analytics ---
    // We intentionally DO NOT 'await' this Prisma call.
    // Awaiting a database write adds 20-80ms of latency to the user's redirect.
    // Instead, we fire the insert asynchronously and let the redirect proceed immediately.
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      null;
    const userAgent = req.headers["user-agent"] || null;
    const referrer = req.headers["referer"] || req.headers["referrer"] || null;

    prisma.click
      .create({
        data: {
          linkId: link.id,
          ipAddress,
          userAgent,
          referrer: typeof referrer === "string" ? referrer : null,
        },
      })
      .catch((err: any) => {
        // Unawaited promises need an explicit .catch to prevent unhandled rejection crashes
        console.error("Failed to log click analytics:", err);
      });

    // --- 6. HTTP 302 Found Redirect ---
    // We explicitly use HTTP 302 (Temporary Redirect) instead of 301 (Permanent Redirect).
    // HTTP 301 would instruct the visitor's browser to cache the target URL locally,
    // meaning subsequent clicks would bypass our server entirely and fail to log analytics.
    return res.redirect(302, link.originalUrl);
  } catch (error) {
    next(error);
  }
};

