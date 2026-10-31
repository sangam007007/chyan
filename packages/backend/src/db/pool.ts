import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DB_URL,
  // Hosted free databases allow only a few connections: set DB_POOL_MAX to stay under that limit
  max: Math.max(2, Number(process.env.DB_POOL_MAX) || 20),
  idleTimeoutMillis: 30_000,
  // a request may have to wait for a free connection during a burst (e.g. everyone submitting at once)
  connectionTimeoutMillis: 15_000,
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err.message);
});

/**
 * Gracefully close the pool. Call this on process shutdown.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
