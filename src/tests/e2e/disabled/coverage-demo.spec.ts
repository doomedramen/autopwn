// Example test showing how to use playwright-coverage-reporter
import { test, expect } from '../fixtures/coverage-fixture';

test.describe('Coverage Demo', () => {
  test('demonstrates coverage tracking with login flow', async ({ page }) => {
    await page.goto('/login');

    // These interactions will be tracked for coverage
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Fill in the form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword');

    // Try to submit (will fail but still tracks coverage)
    await page.click('button:has-text("Sign In")');

    // All the above interactions are automatically tracked for coverage analysis
  });

  test('demonstrates coverage of navigation elements', async ({ page }) => {
    await page.goto('/login');

    // Look for navigation or other interactive elements
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Any click or interaction here would be tracked
    // This demonstrates the coverage fixture is working
  });
});
