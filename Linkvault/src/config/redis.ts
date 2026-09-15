import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const client = createClient({ url: redisUrl });

client.on("error", (err) => {
  console.error("Redis client error", err);
});

// Connect on import; any failure is logged but does not crash the app.
client.connect().catch((e) => console.error("Redis connection failed", e));

export default client;
