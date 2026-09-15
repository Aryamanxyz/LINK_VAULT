# ---- Dockerfile ----
# Multi‑stage build for a TypeScript Express app

# Stage 1 – build the TS source
FROM node:20-alpine AS builder
WORKDIR /app

# Install only production‑ready deps first (helps with layer caching)
COPY package*.json ./
RUN npm ci

# Copy source files and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build   # assumes a "build" script that runs tsc

# Stage 2 – runtime image (minimal)
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy only compiled output and production deps
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# Expose the port the app listens on (default 3000)
EXPOSE 5000

# Use non‑root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Entry point
CMD ["node", "dist/server.js"]
