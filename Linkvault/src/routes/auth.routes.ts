// src/routes/auth.routes.ts

/**
 * Authentication routes – expose register, login and token refresh endpoints.
 * All routes return JSON and set the refresh token as an HttpOnly cookie.
 */

import { Router } from "express";
import { register, login, refresh } from "../controllers/auth.controller";

const router = Router();

// POST /api/auth/register – create new user
router.post("/register", register);

// POST /api/auth/login – authenticate existing user
router.post("/login", login);

// POST /api/auth/refresh – obtain new access token using refresh token cookie
router.post("/refresh", refresh);

export default router;
