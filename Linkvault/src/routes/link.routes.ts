import { Router } from "express";
import { shortenUrl } from "../controllers/link.controller";
import { validate } from "../middlewares/validate.middleware";
import { shortenUrlSchema } from "../validators/shortenUrl.validator";
import { authMiddleware } from "../middleware/auth.middleware";

// Create an isolated Express router instance for link-related endpoints
const router = Router();

/**
 * Route: POST /api/links/shorten
 *
 * Middleware pipeline:
 * 1. validate(shortenUrlSchema):
 *    Intercepts the incoming request before the controller ever sees it.
 *    Validates req.body against our Zod schema. If invalid, returns 400 immediately.
 *
 * 2. shortenUrl:
 *    The controller function that runs only if validation succeeded.
 *    Generates/validates the shortCode and persists the link to the database.
 */
router.post("/shorten", validate(shortenUrlSchema), authMiddleware, shortenUrl);

export default router;

