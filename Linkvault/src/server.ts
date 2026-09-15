import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import apiRateLimiter from "./middleware/rateLimit.middleware";
import linkRoutes from "./routes/link.routes";

import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import { redirectLink } from "./controllers/link.controller";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse incoming JSON request bodies
app.use(express.json());
app.use(cookieParser());
app.use(apiRateLimiter);
// Mount application routes
// Any route defined in linkRoutes under /shorten will now be accessible at /api/links/shorten
app.use("/api/links", linkRoutes);
// Authentication routes
app.use("/api/auth", authRoutes);
// Simple health-check route (static routes must be declared before dynamic parameter routes)
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", message: "LinkVault server is running" });
});

// Dynamic redirect route: GET /:shortCode
// Placed after static routes (/health, /api/links) so "health" is never parsed as a shortCode
app.get("/:shortCode", redirectLink);

// Global error handler (catches errors passed via next(err))
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}/health`);
});