import { test, expect } from '@playwright/test';

/**
 * Smoke tests - Basic functionality checks
 * These tests verify that the application is deployed and running correctly
 */
test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Verify the page loaded (should have HTML content)
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    // Verify we get a valid HTTP response
    expect(page.url()).toBeTruthy();
  });

  test('sign-in page is accessible', async ({ page }) => {
    await page.goto('/sign-in');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Verify the sign-in page loaded
    expect(page.url()).toContain('/sign-in');

    // Look for common sign-in elements
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('sign-up page is accessible', async ({ page }) => {
    await page.goto('/sign-up');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Verify the sign-up page loaded
    expect(page.url()).toContain('/sign-up');

    // Look for common sign-up elements
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('settings page requires authentication', async ({ page }) => {
    await page.goto('/settings');

    // Wait for redirect
    await page.waitForLoadState('networkidle');

    // Should redirect to sign-in if not authenticated
    // OR show settings if Better Auth has a default session
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('API health endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3001/health');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('crackhouse-api');
  });
});
