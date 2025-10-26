import { test, expect } from '../fixtures/auth-fixture';
import { TestUtils } from '../helpers/test-utils';

test.describe('Basic Functionality Test', () => {
  test('should load homepage successfully', async ({ page }) => {
    // Very simple test to verify basic functionality without heavy setup
    await page.goto('/');
    await expect(page).toHaveTitle(/AutoPWN/);
    
    // Simple check that the page loaded without errors
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should navigate to auth page', async ({ page }) => {
    // Very simple test to verify auth page loads
    await page.goto('/sign-in');
    
    // Check that we're on the sign-in page
    const title = await page.title();
    expect(title).toContain('Sign In');
    
    // Minimal element checks
    const emailInput = await page.locator('input[name="email"]');
    const passwordInput = await page.locator('input[name="password"]');
    const submitButton = await page.locator('button[type="submit"]');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });
});