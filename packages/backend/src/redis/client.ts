import Redis from "ioredis";
import { env } from "@/config/env.js";

/**
 * Singleton Redis client for the application.
 * Handles connection lifecycle and provides a typed interface.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) return null; // Stop retrying after 10 attempts
    return Math.min(times * 200, 5000); // Exponential backoff, max 5s
  },
  enableOfflineQueue: false,
  lazyConnect: false,
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

redis.on("connect", () => {
  console.log("[Redis] Connected successfully");
});

/**
 * Gracefully disconnect Redis (for shutdown hooks / tests).
 */
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
