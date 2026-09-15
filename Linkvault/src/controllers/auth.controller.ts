// src/controllers/auth.controller.ts

/**
 * Authentication controller – handles user registration, login and token refresh.
 * Returns JSON responses; errors are passed to the global error handler.
 */

import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../config/Prisma";
import { signAccess, signRefresh, verifyRefresh } from "../utils/jwt";

/** Register a new user and issue both access & refresh tokens. */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashed } });

    const accessToken = signAccess({ userId: user.id, email: user.email });
    const refreshToken = signRefresh({ userId: user.id, email: user.email });

    // Store refresh token in HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: Number(process.env.REFRESH_TOKEN_EXPIRES_IN?.match(/\d+/)?.[0]) * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ accessToken });
  } catch (err) {
    next(err);
  }
};

/** Login an existing user – returns new tokens. */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const accessToken = signAccess({ userId: user.id, email: user.email });
    const refreshToken = signRefresh({ userId: user.id, email: user.email });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: Number(process.env.REFRESH_TOKEN_EXPIRES_IN?.match(/\d+/)?.[0]) * 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
};

/** Refresh endpoint – issues new access token using refresh token cookie. */
export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: "Refresh token missing" });
    }
    const payload = verifyRefresh(token);
    const newAccess = signAccess({ userId: payload.userId, email: payload.email });
    res.json({ accessToken: newAccess });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
};
