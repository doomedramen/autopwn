import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authFile = 'playwright/.auth/user.json';

// Read test credentials from environment variables
const adminEmail = process.env.E2E_ADMIN_EMAIL || 'admin@autopwn.local';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'admin123';

setup('authenticate as admin user', async ({ page }) => {
  console.log('Setting up authentication...');

  // Navigate to sign-in page
  await page.goto('/sign-in');

  // Fill in credentials
  await page.locator('input[name="email"]').fill(adminEmail);
  await page.locator('input[name="password"]').fill(adminPassword);

  // Click sign-in button
  await page.locator('button[type="submit"]').click();

  // Wait for navigation to dashboard or home page
  await page.waitForURL('/');

  // Verify we're authenticated by checking for user-specific elements
  const userMenu = page.locator('[data-testid="user-menu"]'); // Adjust selector based on actual UI
  if (await userMenu.isVisible()) {
    console.log('Authentication successful');
  } else {
    console.log('User menu not found, checking for alternative indicators');
    // Alternative check - look for sign-out button or user email
    const signOutBtn = page.locator('text=Log out');
    if (await signOutBtn.isVisible()) {
      console.log('Sign out button found - authentication successful');
    } else {
      console.log('Could not verify authentication state');
    }
  }

  // Save the storage state to reuse in other tests
  await page.context().storageState({ path: authFile });
});