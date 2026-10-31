/**
 * E2E tests for login flow.
 * Placeholder test file — will be implemented in task 14.1.
 */

import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should display login page with phone input and Google button', async ({ page }) => {
    await page.goto('/');
    // Placeholder — implementation in task 14.1
    expect(true).toBe(true);
  });
});
