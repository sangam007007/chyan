/**
 * Redis testcontainer fixture for integration tests.
 * Provides a fresh Redis instance for each test suite.
 */

import { GenericContainer, type StartedTestContainer } from 'testcontainers';

let container: StartedTestContainer | null = null;

/**
 * Start a Redis container for integration testing.
 * Returns the connection URL to use with ioredis.
 */
export async function startRedis(): Promise<{
  host: string;
  port: number;
  url: string;
  container: StartedTestContainer;
}> {
  container = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(6379);

  return {
    host,
    port,
    url: `redis://${host}:${port}`,
    container,
  };
}

/**
 * Stop the Redis container and clean up resources.
 */
export async function stopRedis(): Promise<void> {
  if (container) {
    await container.stop();
    container = null;
  }
}
