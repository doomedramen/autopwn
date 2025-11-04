import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authFile = 'playwright/.auth/user.json';

// Test user credentials for sign-up (first user becomes admin automatically)
const testEmail = process.env.E2E_ADMIN_EMAIL || 'admin@autopwn.local';
const testPassword = process.env.E2E_ADMIN_PASSWORD || 'admin123';

setup('create admin user via sign-up and authenticate', async ({ page }) => {
  console.log('Setting up authentication via sign-up...');

  // Start from sign-in page to access sign-up
  await page.goto('/sign-in');

  // Look for sign-up link on sign-in page
  const signUpLink = page.locator('[data-testid="signup-link"]');

  if (await signUpLink.isVisible()) {
    await signUpLink.click();
    console.log('Navigated to sign-up page');
  } else {
    // Fallback: navigate directly to sign-up if we know the URL
    await page.goto('/sign-up');
    console.log('Navigated directly to sign-up page');
  }

  // Verify we're on the sign-up page
  await expect(page.locator('h2:has-text("Create Account")')).toBeVisible();

  // Fill in sign-up form (including name field)
  await page.locator('input[name="name"]').fill('Test Admin');
  await page.locator('input[name="email"]').fill(testEmail);
  await page.locator('input[name="password"]').fill(testPassword);

  // Click sign-up button
  await page.locator('[data-testid="signup-submit-button"]').click();

  // Better Auth automatically signs in users after successful sign-up and redirects to dashboard
  console.log('📧 Sign-up completed, waiting for automatic redirect to dashboard');

  // Wait for automatic redirect to dashboard/home page
  await page.waitForURL('/', { timeout: 10000 });
  console.log('✅ Successfully signed up and signed in (first user is now admin)');

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
    console.log('✅ Authentication successful - user menu found (first user is now admin)');
  } else if (isAutoPWNVisible && areTabsVisible) {
    console.log('✅ Authentication successful - dashboard elements found (first user is now admin)');
  } else {
    console.log('❌ Could not verify authentication state after sign-up');
    console.log(`  User menu visible: ${isUserMenuVisible}`);
    console.log(`  AutoPWN header visible: ${isAutoPWNVisible}`);
    console.log(`  Network tabs visible: ${areTabsVisible}`);

    // Debug: take screenshot to see what's on the page
    await page.screenshot({ path: 'auth-debug.png' });
    console.log('📸 Saved debug screenshot to auth-debug.png');

    throw new Error('Failed to authenticate after sign-up');
  }

  // Save the storage state to reuse in other tests
  await page.context().storageState({ path: authFile });
  console.log('✅ Authentication state saved for subsequent tests');
});