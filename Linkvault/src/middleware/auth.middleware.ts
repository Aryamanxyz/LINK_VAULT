// src/middleware/auth.middleware.ts

/**
 * Middleware to protect routes using JWT access tokens.
 * Expects the token in the `Authorization` header as `Bearer <token>`.
 * On successful verification, attaches `req.user` with the token payload.
 */
import { Request, Response, NextFunction } from "express";
import { verifyAccess, JwtPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization header missing or malformed" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyAccess(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
