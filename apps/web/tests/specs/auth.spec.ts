import { test, expect } from '@playwright/test';
import { TEST_USER, TEST_ADMIN, loginViaUI, logout } from '../helpers/auth';

/**
 * Authentication E2E Tests
 * Tests sign-in, sign-out, and protected route access
 */
test.describe('Authentication', () => {
  test.describe('Sign In', () => {
    test('should display sign-in page', async ({ page }) => {
      await page.goto('/sign-in');
      await page.waitForLoadState('networkidle');

      // Verify we're on the sign-in page
      expect(page.url()).toContain('/sign-in');

      // Look for email and password inputs
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
    });

    test('should sign in with valid credentials', async ({ page }) => {
      await loginViaUI(page, TEST_USER.email, TEST_USER.password);

      // Should redirect away from sign-in page
      await expect(page).not.toHaveURL(/sign-in/);

      // Should show some authenticated content
      // This might be dashboard or home page depending on app config
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.goto('/sign-in');
      await page.waitForLoadState('networkidle');

      // Fill in invalid credentials
      await page.getByLabel(/email/i).fill('invalid@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');

      // Submit
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForLoadState('networkidle');

      // Should stay on sign-in page or show error
      // Check that we're still on sign-in or there's an error message
      const stillOnSignIn = page.url().includes('/sign-in');
      const hasError = await page.getByText(/invalid|error|wrong|incorrect/i).isVisible().catch(() => false);

      expect(stillOnSignIn || hasError).toBe(true);
    });
  });

  test.describe('Sign Up', () => {
    test('should display sign-up page', async ({ page }) => {
      await page.goto('/sign-up');
      await page.waitForLoadState('networkidle');

      // Verify we're on the sign-up page
      expect(page.url()).toContain('/sign-up');

      // Look for registration form elements
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i).first()).toBeVisible();
    });

    test('should navigate to sign-in from sign-up', async ({ page }) => {
      await page.goto('/sign-up');
      await page.waitForLoadState('networkidle');

      // Look for a link to sign-in
      const signInLink = page.getByRole('link', { name: /sign in|log in|already have/i });

      if (await signInLink.isVisible()) {
        await signInLink.click();
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/sign-in');
      }
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to sign-in when accessing settings unauthenticated', async ({ page }) => {
      // Clear any existing cookies
      await page.context().clearCookies();

      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Should redirect to sign-in
      expect(page.url()).toContain('/sign-in');
    });

    test('should access settings when authenticated', async ({ page }) => {
      // Login first
      await loginViaUI(page, TEST_USER.email, TEST_USER.password);

      // Navigate to settings
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Should stay on settings (not redirect to sign-in)
      expect(page.url()).toContain('/settings');
    });
  });

  test.describe('Sign Out', () => {
    test('should sign out successfully', async ({ page }) => {
      // Login first
      await loginViaUI(page, TEST_USER.email, TEST_USER.password);

      // Verify we're logged in (not on sign-in page)
      await expect(page).not.toHaveURL(/sign-in/);

      // Sign out
      await logout(page);

      // Should be redirected to sign-in or home page
      // After logout, accessing protected route should redirect to sign-in
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/sign-in');
    });
  });
});
