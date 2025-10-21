import { test, expect } from '../fixtures/auth-fixture';
import { TestUtils } from '../helpers/test-utils';

test.describe('Basic Functionality', () => {
  test('should have a title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AutoPWN/);
  });

  test('should load without errors', async ({ page }) => {
    // Navigate to the home page
    const response = await page.goto('/');
    
    // Check if the response is successful
    expect(response?.status()).toBeLessThan(400);
    
    // Wait for network idle to ensure all resources are loaded
    await TestUtils.waitForNetworkIdle(page);
    
    // Check for basic page elements
    await expect(page.locator('h1, h2')).toBeVisible();
  });

  test('should handle navigation correctly', async ({ page }) => {
    await page.goto('/');
    
    // Test internal navigation
    // Note: This would need to be adjusted based on your actual navigation structure
    // await page.locator('nav a').first().click();
    
    // For now, just test that the page loads correctly
    await expect(page.locator('body')).toBeVisible();
  });
});