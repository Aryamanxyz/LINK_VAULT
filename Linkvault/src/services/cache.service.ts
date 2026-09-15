import client from "../config/redis";
import { Prisma } from "@prisma/client";

// Simple interface representing the shape of a Link record used for caching
interface CachedLink {
  id: string;
  shortCode: string;
  originalUrl: string;
  createdAt: Date;
  expiresAt?: Date | null;
  // Allow extra fields without type errors
  [key: string]: any;
}

const PREFIX = "link:";

/**
 * Retrieve a link from Redis cache.
 * Returns null if not found or on error.
 */
export const getLinkFromCache = async (shortCode: string): Promise<Partial<CachedLink> | null> => {
  try {
    const data = await client.get(PREFIX + shortCode);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error("Redis getLinkFromCache error", err);
    return null;
  }
};

/**
 * Store a link in Redis with an appropriate TTL.
 * If `link.expiresAt` exists, TTL is the remaining seconds until expiration.
 * Otherwise a fixed 24‑hour TTL is used.
 */
export const setLinkInCache = async (link: CachedLink): Promise<void> => {
  const key = PREFIX + link.shortCode;
  const ttlSeconds = link.expiresAt
    ? Math.max(0, Math.floor((new Date(link.expiresAt).getTime() - Date.now()) / 1000))
    : 24 * 60 * 60; // 24 hours
  try {
    await client.set(key, JSON.stringify(link), { EX: ttlSeconds });
  } catch (err) {
    console.error("Redis setLinkInCache error", err);
  }
};

/**
 * Delete a cached link – useful for future update/delete endpoints.
 */
export const deleteLinkFromCache = async (shortCode: string): Promise<void> => {
  try {
    await client.del(PREFIX + shortCode);
  } catch (err) {
    console.error("Redis deleteLinkFromCache error", err);
  }
};
