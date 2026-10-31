import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests.
 * Tests authentication flows, session management, profile operations, etc.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Auth tests often depend on order
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : 'list',
  timeout: 30000,

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Run the frontend dev server before starting the tests */
  webServer: [
    {
      command: 'npm run dev:frontend',
      cwd: '../',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'npm run dev:backend',
      cwd: '../',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
