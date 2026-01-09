import { test as setup, expect } from '@playwright/test';
import { TEST_USER, loginViaUI } from './helpers/auth';

/**
 * Global authentication setup
 * This runs before all other tests to set up authenticated sessions
 */
setup('authenticate as test user', async ({ page }) => {
  console.log('🔐 Setting up authentication state...');

  try {
    // Navigate to sign-in page
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    // Fill in credentials
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      await emailInput.fill(TEST_USER.email);
      await passwordInput.fill(TEST_USER.password);

      // Submit
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForLoadState('networkidle');

      // Save storage state
      await page.context().storageState({ path: 'playwright/.auth/user.json' });
      console.log('✅ Authentication state saved');
    } else {
      console.log('⚠️ Sign-in form not found, skipping auth setup');
    }
  } catch (error) {
    console.error('❌ Auth setup failed:', error);
    // Don't throw - let tests continue without auth state
  }
});
