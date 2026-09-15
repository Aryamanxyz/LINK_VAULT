LinkVault — Project Context & Roadmap

Purpose of this document: Give a coding agent (Antigravity) full context on the LinkVault project — what it is, current state, architecture decisions, and the exact remaining build order. Read this fully before writing/modifying any code.

1. Project Overview

LinkVault is a production-grade URL shortener with built-in AI-based malicious URL detection. It is not a toy project — auth, caching, analytics, and security are all first-class requirements.

Core features:

Shorten long URLs into unique short codes
Redirect short codes to original URLs (fast, cached)
Click analytics per link (timestamp, referrer, etc.)
User accounts (JWT auth) — links can be tied to a user
AI-based malicious/phishing URL detection before a link goes live (via Groq API)
2. Tech Stack
Layer	Technology
Language	TypeScript
Backend framework	Express.js
Database	PostgreSQL (hosted on Supabase)
ORM	Prisma v6
Cache	Redis
Validation	Zod
Auth	JWT
Short code generation	nanoid
AI / malicious URL detection	Groq API
3. Current Status — ✅ Completed So Far
Project folder structure — standard layered backend structure (routes / controllers / services / middleware / validators / config)
TypeScript configuration — tsconfig.json set up
Express server bootstrap — base server + middleware chain running
Prisma schema — three models defined:
User
Link (stores original URL, short code, owner, metadata, malicious-check status)
Click (analytics: one row per click on a link)
Zod validators — request validation schemas for link creation
Validation middleware — generic middleware that runs a Zod schema against req.body and returns 400 with formatted errors on failure
Short code generation service — nanoid-based unique short code generator (with collision handling logic)
4. Remaining Work — Build Order (Do NOT skip order; each step depends on the previous)
Step 1 — POST /api/links/shorten (Controller + Route) — NEXT IMMEDIATE STEP
Accepts { originalUrl, customAlias? } in body, validated by existing Zod schema
Calls short-code generation service (or uses customAlias if provided and available)
Saves new row in Link table via Prisma
Returns { shortCode, shortUrl, originalUrl, createdAt }
Handle: duplicate custom alias (409 Conflict), invalid URL format (400)
Step 2 — GET /:shortCode (Redirect Endpoint)
Looks up shortCode in DB (Redis cache first, see Step 3)
If not found → 404
If found → log a Click record (async/non-blocking — don't delay redirect) and issue 302 redirect to originalUrl
Capture on click: timestamp, IP (or hashed IP), user-agent, referrer
Step 3 — Redis Caching Layer
Cache shortCode → originalUrl mapping on creation and on first lookup
Redirect endpoint checks Redis before hitting Postgres
Set sensible TTL or cache invalidation strategy (e.g., invalidate on link deletion/update)
Consider caching click-count aggregates too (write-behind or periodic flush) to avoid hammering Postgres on high-traffic links
Step 4 — Auth (JWT)
POST /api/auth/signup — hash password (bcrypt), create User
POST /api/auth/login — verify password, issue JWT (access token; consider refresh token later)
Auth middleware — verifies JWT from Authorization: Bearer <token> header, attaches req.user
Protect relevant routes: link creation tied to logged-in user (guest shortening can still be allowed, but tagged differently), user's link list/dashboard, delete/update link (must own the link)
Step 5 — Groq API Integration (Malicious URL Detection)
Before saving a new link (Step 1 flow) or as an async post-creation check, call Groq API with the originalUrl to classify it as safe/suspicious/malicious
Store result on Link (e.g., status: PENDING | SAFE | FLAGGED)
Decide UX: block malicious links outright at creation, or allow but flag + warn on redirect page
Handle Groq API failure gracefully (don't block link creation entirely on an API timeout — fallback strategy needed)
Step 6 — Analytics Endpoints (not yet scoped in detail, but expected)
GET /api/links/:shortCode/analytics — click count, click-over-time, top referrers (owner-only, JWT protected)
GET /api/links — list all links for logged-in user
Step 7 — Hardening / Production Readiness
Rate limiting (per IP and/or per user) on shorten + redirect endpoints
Input sanitization beyond Zod (e.g., block javascript: URLs, localhost/internal IP targets to prevent SSRF via redirect abuse)
Centralized error handler middleware
Logging (structured, e.g., pino/winston)
Environment config validation on boot (fail fast if .env vars missing)
Dockerfile + docker-compose (Postgres + Redis for local dev)
API documentation (Swagger, consistent with prior project style)
5. Architectural Notes / Conventions to Follow
Keep controllers thin — business logic lives in services/, controllers just orchestrate request → service → response
All external input validated via Zod before touching DB
Prisma client should be a singleton (avoid connection exhaustion — this bit the developer before on a prior project with Socket.io/Axios duplication bugs, so be deliberate here)
Redis client also singleton, initialized once at boot
Consistent error response shape across the API: { error: { message, code } }
Async route handlers wrapped to forward errors to centralized error middleware (avoid unhandled promise rejections)
6. Known Developer Context (for tone/expectations)
Developer is a final-year B.Tech CSE student, preparing for TCS NQT technical interviews — code should be interview-defensible: no obvious security holes (IDOR, missing awaits on bcrypt, ineffective rate limiters — mistakes caught in a prior project's review should NOT be repeated here)
Prior related projects: Blog API (Express/MongoDB/Redis/JWT), AI Disaster Response Platform (Groq API experience already exists — reuse patterns where sensible)
Preference: clean, production-grade patterns over quick hacks, since these projects double as resume/interview talking points
7. Immediate Action Item

Build Step 1: POST /api/links/shorten — controller + route — using the existing Prisma Link schema, Zod validator, and short-code service already in the codebase. Do not modify the Prisma schema unless a genuinely missing field is discovered.