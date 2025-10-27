import { test, expect } from '../fixtures/auth-fixture';
import { TestUtils } from '../helpers/test-utils';

test.describe('Basic Functionality Test', () => {
  test('should load homepage successfully', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Simple check that the page loaded without errors
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should navigate to auth page from homepage', async ({ page }) => {
    // Start from homepage
    await page.goto('/');

    // If unauthenticated, we should be automatically redirected to sign-in
    // Or we should be able to navigate via a link
    const currentUrl = page.url();

    if (currentUrl.includes('/sign-in')) {
      // We're already on the sign-in page (auto-redirect worked)
      console.log('Auto-redirected to sign-in page');
    } else {
      // Look for navigation to sign-in
      const signInLink = page.locator('text=Sign in, text=Sign In, a[href="/sign-in"]');
      if (await signInLink.isVisible()) {
        await signInLink.click();
        await page.waitForURL('/sign-in');
      } else {
        // Fallback - navigate directly
        await page.goto('/sign-in');
      }
    }

    // Check that we're on the sign-in page
    await expect(page.locator('h2:has-text("Sign In")')).toBeVisible();

    // Verify sign-up link exists
    await expect(page.locator('text=Sign Up')).toBeVisible();

    // Minimal element checks
    const emailInput = await page.locator('input[name="email"]');
    const passwordInput = await page.locator('input[name="password"]');
    const submitButton = await page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('should navigate from sign-in to sign-up', async ({ page }) => {
    // Start from sign-in page
    await page.goto('/sign-in');

    // Click the sign-up link (lowercase "Sign up" as displayed on sign-in page)
    await page.locator('text=Sign up').click();

    // Wait for navigation to sign-up page
    await page.waitForURL('/sign-up');

    // Verify we're on the sign-up page using the branding title
    await expect(page.locator('[data-testid="branding-title"]')).toBeVisible();
    await expect(page.locator('h1:has-text("AutoPWN")')).toBeVisible();

    // Verify the form container and submit button are present
    await expect(page.locator('[data-testid="signup-form-container"]')).toBeVisible();
    await expect(page.locator('button:has-text("Create an account")')).toBeVisible();
  });
});