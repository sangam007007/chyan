/**
 * PostgreSQL testcontainer fixture for integration tests.
 * Provides a fresh PostgreSQL instance for each test suite.
 */

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer | null = null;

/**
 * Start a PostgreSQL container for integration testing.
 * Returns the connection URI to use with pg Pool.
 */
export async function startPostgres(): Promise<{
  connectionUri: string;
  container: StartedPostgreSqlContainer;
}> {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_password')
    .start();

  return {
    connectionUri: container.getConnectionUri(),
    container,
  };
}

/**
 * Stop the PostgreSQL container and clean up resources.
 */
export async function stopPostgres(): Promise<void> {
  if (container) {
    await container.stop();
    container = null;
  }
}
