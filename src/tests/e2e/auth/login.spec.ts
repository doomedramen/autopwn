import { test, expect } from '@playwright/test';
import { TestHelpers } from '../helpers/test-helpers';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start from a clean state
    await page.context().clearCookies();
  });

  test('should show login page with proper elements', async ({ page }) => {
    await page.goto('/login');

    // Check page elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('should validate required fields on login', async ({ page }) => {
    await page.goto('/login');

    // Try to login without filling fields
    await page.click('button:has-text("Sign In")');

    // Should have HTML5 validation
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('required');
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const user = await TestHelpers.initializeSystem(page);
    await TestHelpers.login(page, user.email, user.password);

    // Should be redirected to dashboard
    expect(page.url()).toMatch(/\/(dashboard|$)/);
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'invalidpassword');
    await page.click('button:has-text("Sign In")');

    // Should stay on login page or show error
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });

  test('should maintain session across page reloads', async ({
    page,
    context,
  }) => {
    // Skip cookie clearing for this test by using loginWithSession after clearing
    await page.context().clearCookies();

    // Login using session management to handle password changes
    await TestHelpers.loginWithSession(page, context);

    // Should be logged in now
    expect(page.url()).toMatch(/\/(dashboard|$)/);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be logged in after reload
    expect(page.url()).toMatch(/\/(dashboard|$)/);
  });
});
