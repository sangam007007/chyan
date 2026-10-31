/**
 * Shared test fixtures for integration tests.
 * Exports container management utilities for PostgreSQL and Redis.
 */

export { startPostgres, stopPostgres } from './postgres.fixture';
export { startRedis, stopRedis } from './redis.fixture';
