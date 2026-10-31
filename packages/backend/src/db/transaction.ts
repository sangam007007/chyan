import type { PoolClient } from "pg";
import { pool } from "./pool.js";

/**
 * Run a callback inside a database transaction.
 * Automatically issues BEGIN, COMMIT on success, and ROLLBACK on error.
 * The PoolClient is passed to the callback for use with query helpers.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
