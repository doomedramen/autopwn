import { test, expect } from '../fixtures/auth-fixture';
import { AuthPage } from '../pages/auth-page';
import { TestUtils } from '../helpers/test-utils';

test.describe('Authentication', () => {
  test('should protect authenticated routes', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL('/auth/sign-in', { timeout: 5000 });
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('authenticated session should work correctly after setup', async ({ page }) => {
    // Since auth.setup.ts runs first and stores auth state, 
    // all pages in this test should already be authenticated
    
    // Verify we can access protected content
    await page.goto('/dashboard');
    await expect(page.locator('body')).toBeVisible();

    // Verify session is active
    const cookies = await page.context().cookies();
    expect(cookies.length).toBeGreaterThan(0);

    // Test navigation within authenticated area
    await page.goto('/');
    await expect(page.locator('h1, text=AutoPWN')).toBeVisible();
  });
});