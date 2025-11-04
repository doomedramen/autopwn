import { test as base, expect } from '@playwright/test';

// This fixture will automatically use the authentication state saved by auth.setup.ts
export const test = base.extend({
  page: async ({ page }, use) => {
    // The authentication state will be automatically loaded from storageState
    // as specified in playwright.config.ts

    // Verify authentication is working before using the page
    await page.goto('/');

    // Wait a bit for any redirects
    await page.waitForLoadState('networkidle');

    // Check if we're redirected to sign-in (meaning authentication failed)
    const currentUrl = page.url();
    if (currentUrl.includes('/sign-in')) {
      throw new Error(`Authentication failed - redirected to sign-in page. Current URL: ${currentUrl}`);
    }

    // Verify we can access authenticated content
    // Look for dashboard elements that should only be visible to authenticated users
    try {
      await expect(page.locator('body')).not.toContainText('Sign In', { timeout: 5000 });

      // Check for navigation tabs (should be present in authenticated dashboard)
      const navTabs = page.locator('nav[aria-label="Tabs"], [data-testid="tab-networks"], [data-testid="tab-jobs"]');
      await expect(navTabs.first()).toBeVisible({ timeout: 5000 });

      console.log('✅ Authentication verified - dashboard elements found');
    } catch (error) {
      // Take screenshot for debugging
      await page.screenshot({ path: `test-failed-auth-${Date.now()}.png` });
      throw new Error(`Authentication verification failed: ${error.message}`);
    }

    await use(page);
  },
});

export { expect };