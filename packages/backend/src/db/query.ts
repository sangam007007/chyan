import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "./pool.js";

export interface QueryOptions {
  /** Optional client to use (e.g. inside a transaction). Falls back to pool. */
  client?: PoolClient;
}

/**
 * Execute a parameterized query and return all rows typed as T.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  options?: QueryOptions,
): Promise<T[]> {
  const executor = options?.client ?? pool;
  const result = await executor.query<T>(text, params);
  return result.rows;
}

/**
 * Execute a query and return the first row, or null if no rows match.
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  options?: QueryOptions,
): Promise<T | null> {
  const executor = options?.client ?? pool;
  const result = await executor.query<T>(text, params);
  return result.rows[0] ?? null;
}

/**
 * Execute a query and return all rows (alias for clarity when many rows are expected).
 */
export async function queryMany<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  options?: QueryOptions,
): Promise<T[]> {
  return query<T>(text, params, options);
}
