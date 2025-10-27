import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authFile = 'playwright/.auth/user.json';

// Read test credentials from environment variables
const adminEmail = process.env.E2E_ADMIN_EMAIL || 'admin@autopwn.local';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'admin123';

setup('authenticate as admin user', async ({ page }) => {
  console.log('Setting up authentication...');

  // Start from homepage to simulate real user flow
  await page.goto('/');

  // Check if we're already redirected to login (due to unauthenticated state)
  // If not, navigate to login page
  const currentUrl = page.url();
  if (currentUrl === '/' || currentUrl.endsWith('/')) {
    // Look for a "Sign In" link or redirect
    const signInLink = page.locator('text=Sign in, text=Sign In, a[href="/sign-in"], a[href="/login"]');
    if (await signInLink.isVisible()) {
      await signInLink.click();
      // Wait for either /sign-in or /login URL
      await page.waitForURL(url => url.includes('/sign-in') || url.includes('/login'));
    } else {
      // Fallback: If no link found, navigate directly to /login (this handles auto-redirect case)
      await page.goto('/login');
    }
  }

  // Verify we're on the sign-in page (check for both Sign In and possible h1/h2 variations)
  await expect(page.locator('h2:has-text("Sign In"), h1:has-text("Sign In")')).toBeVisible();

  // Fill in credentials
  await page.locator('input[name="email"]').fill(adminEmail);
  await page.locator('input[name="password"]').fill(adminPassword);

  // Click sign-in button
  await page.locator('button[type="submit"]').click();

  // Wait for automatic redirect to dashboard/home page
  await page.waitForURL('/', { timeout: 10000 });

  // Wait for page to fully load
  await page.waitForLoadState('networkidle', { timeout: 10000 });

  // Verify we're authenticated by checking for user-specific elements
  const userMenu = page.locator('[data-testid="user-menu"]');
  const autoPWNHeader = page.locator('text=AutoPWN');
  const networkTabs = page.locator('nav[aria-label="Tabs"]');

  // Try multiple indicators of successful authentication
  const isUserMenuVisible = await userMenu.isVisible({ timeout: 3000 }).catch(() => false);
  const isAutoPWNVisible = await autoPWNHeader.isVisible({ timeout: 3000 }).catch(() => false);
  const areTabsVisible = await networkTabs.isVisible({ timeout: 3000 }).catch(() => false);

  if (isUserMenuVisible) {
    console.log('✅ Authentication successful - user menu found');
  } else if (isAutoPWNVisible && areTabsVisible) {
    console.log('✅ Authentication successful - dashboard elements found');
  } else {
    console.log('❌ Could not verify authentication state');
    console.log(`  User menu visible: ${isUserMenuVisible}`);
    console.log(`  AutoPWN header visible: ${isAutoPWNVisible}`);
    console.log(`  Network tabs visible: ${areTabsVisible}`);

    // Debug: take screenshot to see what's on the page
    await page.screenshot({ path: 'auth-debug.png' });
    console.log('📸 Saved debug screenshot to auth-debug.png');
  }

  // Save the storage state to reuse in other tests
  await page.context().storageState({ path: authFile });
});