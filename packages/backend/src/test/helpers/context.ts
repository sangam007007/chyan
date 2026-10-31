/**
 * Test context utilities for setting up and tearing down test environments.
 * Provides abstractions over Redis/PostgreSQL test instances.
 */

export interface TestContext {
  /** Clean up resources after tests */
  teardown: () => Promise<void>;
}

/**
 * Creates a minimal test context for unit tests.
 * For integration tests, use the testcontainers setup in fixtures/.
 */
export function createTestContext(): TestContext {
  return {
    teardown: async () => {
      // No-op for unit tests; integration tests override this
    },
  };
}
