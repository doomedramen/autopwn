import { Page, BrowserContext, expect } from '@playwright/test';
import { createTestUser, deleteTestUser } from './database';

/**
 * Auth helpers for E2E tests
 * Provides utilities for authentication flows
 */

// Test user credentials
export const TEST_USER = {
  email: 'e2e-test@example.com',
  password: 'TestPassword123!',
  name: 'E2E Test User',
  role: 'user',
};

export const TEST_ADMIN = {
  email: 'e2e-admin@example.com',
  password: 'AdminPassword123!',
  name: 'E2E Admin User',
  role: 'admin',
};

/**
 * Setup test users in the database
 */
export async function setupTestUsers() {
  console.log('👤 Creating test users...');

  // Clean up any existing test users first
  await deleteTestUser(TEST_USER.email);
  await deleteTestUser(TEST_ADMIN.email);

  // Create fresh test users
  await createTestUser(TEST_USER);
  await createTestUser(TEST_ADMIN);

  console.log('✅ Test users created');
}

/**
 * Login via the UI
 */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');

  // Fill in credentials
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);

  // Submit the form
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for navigation (either to dashboard or error)
  await page.waitForLoadState('networkidle');
}

/**
 * Login and save authentication state to a file
 */
export async function loginAndSaveState(
  page: Page,
  context: BrowserContext,
  email: string,
  password: string,
  storageStatePath: string
) {
  await loginViaUI(page, email, password);

  // Verify we're logged in by checking we're not on sign-in page
  const url = page.url();
  if (url.includes('/sign-in')) {
    throw new Error(`Login failed for ${email} - still on sign-in page`);
  }

  // Save authentication state
  await context.storageState({ path: storageStatePath });
  console.log(`✅ Saved auth state for ${email} to ${storageStatePath}`);
}

/**
 * Logout via the UI
 */
export async function logout(page: Page) {
  // Click on user avatar/dropdown
  const avatarButton = page.getByRole('button', { name: /user|account|avatar/i }).first();

  if (await avatarButton.isVisible()) {
    await avatarButton.click();
    await page.getByRole('menuitem', { name: /sign out|logout/i }).click();
    await page.waitForLoadState('networkidle');
  } else {
    // Fallback: navigate directly to sign-out endpoint
    await page.goto('/api/auth/sign-out');
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Check if user is authenticated by checking for auth-specific elements
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Navigate to a protected page
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  // If we stay on settings, we're authenticated
  return !page.url().includes('/sign-in');
}

/**
 * Wait for auth to be ready (cookies set, session established)
 */
export async function waitForAuth(page: Page, timeout = 10000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await isAuthenticated(page)) {
      return true;
    }
    await page.waitForTimeout(500);
  }

  return false;
}
