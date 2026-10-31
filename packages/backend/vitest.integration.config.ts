import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 60000, // Integration tests may need longer for container startup
    hookTimeout: 60000,
    pool: 'forks', // Use forks for isolation with testcontainers
    poolOptions: {
      forks: {
        singleFork: true, // Run sequentially to avoid container port conflicts
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
