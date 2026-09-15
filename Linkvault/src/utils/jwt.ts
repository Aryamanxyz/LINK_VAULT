// src/utils/jwt.ts

/**
 * Centralised helpers for JSON Web Token (JWT) creation and verification.
 * Separate secrets and expiries are used for access and refresh tokens.
 */

import jwt from "jsonwebtoken";

/** Payload stored in both token types */
export interface JwtPayload {
  userId: string; // Prisma User.id (UUID)
  email: string;  // user email
  iat: number;   // issued‑at (added by jwt.sign)
  exp: number;   // expiry (added by jwt.sign)
}

/** Sign a short‑lived access token */
export const signAccess = (payload: Omit<JwtPayload, "iat" | "exp">): string =>
  jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET!, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? "15m",
  });

/** Sign a long‑lived refresh token */
export const signRefresh = (payload: Omit<JwtPayload, "iat" | "exp">): string =>
  jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? "7d",
  });

/** Verify access token – throws on invalid/expired */
export const verifyAccess = (token: string): JwtPayload =>
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as JwtPayload;

/** Verify refresh token – throws on invalid/expired */
export const verifyRefresh = (token: string): JwtPayload =>
  jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!) as JwtPayload;
