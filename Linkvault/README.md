# LINK_VAULT

A lightweight URL‑shortening service built with **Node.js**, **TypeScript**, **Express**, **Prisma**, and **Redis**. It provides secure authentication, rate‑limiting, and short‑code generation.

---

## ✨ Features

- ✅ **User authentication** with JWT + bcrypt
- ✅ **Short URL creation** with nanoid‑based codes
- ✅ **Rate limiting** to prevent abuse
- ✅ **Redis cache** for fast look‑ups
- ✅ **Prisma ORM** for PostgreSQL/MySQL/SQLite support
- ✅ **Typed validation** using Zod

---

## 📋 Prerequisites

- Node.js ≥ 20
- npm ≥ 10 (or yarn)
- Redis server (local or remote)
- A relational database supported by Prisma (Postgres/MySQL/SQLite)

---

## 🔧 Installation

```bash
# Clone the repository (already done)
git clone https://github.com/Aryamanxyz/LINK_VAULT.git
cd LINK_VAULT/Linkvault

# Install dependencies
npm ci
```

---

## ⚙️ Configuration

Create a `.env` file in the `Linkvault` directory. Example:

```env
# Server
PORT=3000

# JWT secret key
JWT_SECRET=your-super-secret-key

# Database URL (Prisma)
DATABASE_URL="postgresql://user:password@localhost:5432/linkvault"

# Redis connection
REDIS_URL=redis://localhost:6379
```

---

## 🚀 Running the project

### Development

```bash
npm run dev
```

The server will start on `http://localhost:3000` with hot‑reloading.

### Production build

```bash
npm run build   # Compile TypeScript to ./dist
npm start       # Run the compiled server
```

---

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Register a new user (email & password) |
| `POST` | `/api/auth/login`    | Authenticate and receive a JWT |
| `POST` | `/api/links/shorten` | Create a short URL (protected, requires JWT) |
| `GET`  | `/api/links/:code`   | Resolve a short code to the original URL |

All routes under `/api/links` are protected by the `authMiddleware` and rate‑limited.

---

## 🧪 Testing

Unit/integration tests are located under `src/**/*.test.ts`. To run them (once a test runner is added), you can use:

```bash
npm test
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/awesome-feature`)
3. Commit your changes (`git commit -am 'Add awesome feature'`)
4. Push to your fork (`git push origin feature/awesome-feature`)
5. Open a Pull Request

Please follow the existing code style and run `npm run build` before submitting.

---

## 📄 License

MIT License – see the `LICENSE` file for details.

---

## 📦 Deployment

The app can be deployed to any Node‑compatible platform (Vercel, Railway, Azure, Render, Docker, etc.). Ensure the environment variables from `.env` are provided in the host environment.
