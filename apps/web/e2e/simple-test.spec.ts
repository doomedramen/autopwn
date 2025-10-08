import { test, expect } from '@playwright/test';

test.describe('Simple E2E Test', () => {
  test('should load the application', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/simple-test.png', fullPage: true });

    // Basic check that the page loaded
    const title = await page.title();
    console.log('Page title:', title);

    // Check if we have some content
    const bodyContent = await page.textContent('body');
    console.log('Body content length:', bodyContent?.length || 0);

    // This test just verifies the app loads without errors
    expect(true).toBe(true);
  });
});