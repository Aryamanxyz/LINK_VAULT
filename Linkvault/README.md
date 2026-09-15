# LINK_VAULT

A production‑grade URL‑shortening service built with **Express**, **TypeScript**, **Prisma**, and **Redis**. This README explains the full architecture, design decisions, and how to run, test, and deploy the project.

---

## Table of Contents

- [Running the Project](#running-the-project)
- [Architecture Overview](#architecture-overview)
- [Request Lifecycle](#request-lifecycle)
- [Authentication & JWT Strategy](#authentication--jwt-strategy)
- [Short‑code Generation & Collision Handling](#short‑code-generation--collision-handling)
- [Redis Caching Strategy](#redis-caching-strategy)
- [Rate Limiting](#rate-limiting)
- [Request Validation with Zod](#request-validation-with-zod)
- [Logging](#logging)
- [Error Handling](#error-handling)
- [Database Indexes & Prisma Schema](#database-indexes--prisma-schema)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [CI / GitHub Actions Workflow](#ci--github-actions-workflow)
- [License](#license)

---

## Running the Project

### Local Development
```bash
# Local development (requires .env with DB & Redis credentials)
npm run dev
```

### Production Build
```bash
npm run build   # compiles TypeScript to ./dist
npm start       # runs the compiled server
```

### Docker
```bash
# Build and run the container
docker compose up --build

# Or, using Docker directly:
# Build the image
docker build -t linkvault .
# Run the container
docker run -p 3000:3000 -e PORT=3000 linkvault
```

The server starts on the port defined in `.env` (default `3000`).

---

## Architecture Overview

```
Request → Route → Middleware(s) → Controller → Service → Prisma Model → Database
```

| Layer        | Location                         | Responsibility |
|--------------|----------------------------------|----------------|
| **Routes**   | `src/routes/`                    | Define HTTP paths and attach middleware chains |
| **Controllers** | `src/controllers/`            | Parse/validate request, invoke service, format response |
| **Services** | `src/services/`                  | Business logic, orchestrate Prisma queries, cache handling |
| **Models**   | `src/models/` (Prisma schema)   | Database schema, type safety |
| **Middlewares** | `src/middleware/`             | Auth (JWT), rate‑limit, request‑body parsing |
| **Utils**    | `src/utils/`                     | Logger, async handler, Redis helpers, JWT helpers |
| **Validators** | `src/validators/`               | Zod schemas for request bodies & query strings |

---

## Request Lifecycle

A typical authenticated request (e.g., creating a short URL) follows:

1. **app.ts** – global middlewares (`express.json()`, `cookie-parser()`).
2. **router** – attaches endpoint‑specific middlewares (`authMiddleware`, `rateLimiter`).
3. **controller** – validates payload with Zod, calls the corresponding service.
4. **service** – executes Prisma queries, optionally writes/reads from Redis cache.
5. **service** – returns the result to the controller.
6. **controller** – wraps the data in a standard `ApiResponse` and sends JSON back.

All async controllers are wrapped by `asyncHandler` to forward errors to the global error handler.

---

## Authentication & JWT Strategy

### Two‑token system
| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| **Access token** | Minutes (default `15m`) | `httpOnly` cookie | Proven identity on every request |
| **Refresh token** | Days (default `7d`) | `httpOnly` cookie + stored in DB | Silent rotation to issue a new access token |

**Flow**:
1. `login` issues both tokens; the refresh token is saved in the user's record.
2. `authMiddleware` verifies the access token; on expiry it reads the refresh token, validates it, checks it matches the DB entry, issues a new access token, and continues.
3. Logout clears the refresh token from the DB and removes both cookies.

**Why httpOnly cookies?** Prevents client‑side JavaScript from accessing the tokens, mitigating XSS token‑stealing attacks.

---

## Short‑code Generation & Collision Handling

- **Algorithm**: `nanoid(8)` – generates an 8‑character alphanumeric string.
- **Uniqueness**: Before persisting a new `Link` record, the service queries the DB for an existing record with the same `code`. If a collision occurs (extremely unlikely), a new nanoid is generated and the check repeats.
- **Why not sequential IDs?** Random codes are harder to guess, improving security and removing the need for a central counter, which simplifies horizontal scaling.

---

## Redis Caching Strategy

- **Cache key**: `link:{code}` → JSON string of the original URL.
- **TTL**: 24 hours (configurable via `REDIS_TTL` env var).
- **Workflow**:
  1. On GET `/api/links/:code`, first attempt `redis.get(key)`.
  2. If a cache hit, redirect instantly.
  3. On miss, query Prisma, then `redis.set(key, value, { EX: TTL })`.
- **Benefits**: Reduces DB load for frequently accessed short codes and provides sub‑millisecond look‑ups.

---

## Rate Limiting

Implemented with Redis using the classic **INCR + EXPIRE** pattern.

```ts
const key = `rl:${req.ip}:${req.path}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 5); // 5‑second window
if (count > 15) throw new ApiError(429, 'Too many requests');
```

- **Scope**: Per IP + endpoint path.
- **Window**: 5 seconds, max 15 requests.
- **Why Redis?** Distributed lock‑free counter works across multiple instances; atomic operations guarantee correctness under concurrency.

---

## Request Validation with Zod

Every request body and query string is validated using **Zod** before reaching the service layer.

```ts
export const createLinkSchema = z.object({
  originalUrl: z.string().url(),
  customCode: z.string().optional().regex(/^[a-zA-Z0-9_-]{4,10}$/),
});
```

- Validation is performed inline in controllers (`createLinkSchema.parse(req.body)`).
- Errors are thrown as `ZodError`, automatically transformed into a `400 Bad Request` by the global error handler.
- Using Zod gives **runtime validation** and **static TypeScript inference** without extra type definitions.

---

## Logging

Structured logging is handled by **Winston** (`src/utils/logger.ts`). All console output is replaced with `logger.info|warn|error` calls.

**Log format** (JSON):
```json
{ "timestamp": "2026-09-15T20:00:00Z", "level": "info", "message": "User logged in", "userId": "abc123" }
```

- **Info** – successful operations (login, link creation).
- **Warn** – expected client errors (validation failures, 404s).
- **Error** – unexpected server errors, DB/Redis connection failures.

---

## Error Handling

- **ApiError** – custom error class with `statusCode` and `message`.
- **asyncHandler** – wraps async controllers to forward rejections.
- **Global error middleware** – formats all errors into a consistent JSON shape:

```json
{ "success": false, "message": "<error description>", "errors": [] }
```

---

## Database Indexes & Prisma Schema

The Prisma schema (`prisma/schema.prisma`) defines the following indexes:

```prisma
model Link {
  id          Int      @id @default(autoincrement())
  code        String   @unique
  originalUrl String
  createdAt   DateTime @default(now())
  // optional: userId for authenticated links
  @@index([code])
}

model User {
  id            Int      @id @default(autoincrement())
  email         String   @unique
  passwordHash  String
  refreshToken  String?  // stored for rotation validation
  createdAt     DateTime @default(now())
}
```

- **Unique index on `code`** guarantees no duplicate short codes.
- **Unique index on `email`** enforces one account per email.
- Additional indexes (e.g., on `createdAt`) support ordered queries for analytics.

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | ❌ | Register a new user (email + password) |
| `POST` | `/api/auth/login` | ❌ | Login, sets access & refresh token cookies |
| `POST` | `/api/auth/logout` | ✅ | Clears cookies and removes refresh token |
| `POST` | `/api/links` | ✅ | Create a short link (body: `{ originalUrl, customCode? }`) |
| `GET`  | `/api/links/:code` | ❌ | Resolve a short code and redirect to the original URL |
| `GET`  | `/api/links` | ✅ | Paginated list of user's links (`?page=1&limit=20`) |
| `DELETE` | `/api/links/:code` | ✅ | Delete a short link owned by the user |

All responses follow the **ApiResponse** shape:

```json
{ "success": true, "data": { … }, "message": "Operation successful" }
```

---

## Environment Variables

All variables are validated at startup (`src/validators/env_validator.ts`). Missing or malformed values cause the process to exit with a clear error.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default `3000`) | Server listening port |
| `DATABASE_URL` | Yes | Prisma connection string (Postgres/MySQL/SQLite) |
| `JWT_SECRET` | Yes | Secret for signing access JWTs |
| `JWT_EXPIRY` | Yes | Access token lifetime (e.g., `15m`) |
| `REFRESH_TOKEN_SECRET` | Yes | Secret for signing refresh JWTs |
| `REFRESH_TOKEN_EXPIRY` | Yes | Refresh token lifetime (e.g., `7d`) |
| `REDIS_HOST` | No (default `localhost`) | Redis host (Docker service name `redis` works) |
| `REDIS_PORT` | No (default `6379`) | Redis port |
| `REDIS_TTL` | No (default `86400`) | Cache TTL in seconds |
| `CORS_ORIGIN` | No | Allowed origin for CORS |

---

## Project Structure

```
src/
├─ app.ts                # Express app, global middlewares, route mounting
├─ index.ts              # Server entry point (DB connection + listen)
├─ swagger.ts            # OpenAPI spec (served at /api-docs)
├─ routes/
│   ├─ auth.route.ts
│   └─ link.route.ts
├─ controllers/
│   ├─ auth.controller.ts
│   └─ link.controller.ts
├─ services/
│   ├─ auth.service.ts
│   └─ link.service.ts
├─ models/               # Prisma schema lives in prisma/
├─ middleware/
│   ├─ auth.middleware.ts
│   └─ rate_limiter.ts
├─ utils/
│   ├─ logger.ts
│   ├─ async_handler.ts
│   ├─ redis_util.ts
│   └─ jwt_util.ts
├─ validators/
│   ├─ env_validator.ts
│   ├─ auth_validator.ts
│   └─ link_validator.ts
└─ types/
    └─ express.d.ts   # Extends Request with user info
```

---

## CI / GitHub Actions Workflow

The repository includes a **GitHub Actions** workflow (`.github/workflows/ci.yml`) that runs on every push to `main`:

1. **Checkout** code.
2. **Set up Node.js** (v20) with npm cache.
3. **Install dependencies** (`npm ci`).
4. **Build** the TypeScript project (`npm run build`).
5. **Run tests** (if a `test` script is defined).

This ensures that the project always compiles and passes its test suite before being merged.

---

## License

MIT License – see the `LICENSE` file for details.

---

*Feel free to open issues or pull requests for enhancements, bug fixes, or documentation improvements. Happy coding!*
