import { test, expect } from '../../tests/helpers/test-client';
import { TestDatabase } from '../../tests/helpers/test-database';

test.describe('Authentication', () => {
  test.beforeEach(async ({ database }) => {
    // Ensure clean database state before each test
    await database.cleanupAllTestData();
  });

  test('should redirect unauthenticated users to signin page', async ({ page }) => {
    await page.goto('/');

    // Should redirect to signin page
    await expect(page).toHaveURL('**/auth/signin');

    // Should show signin form elements
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin');

    // Try to login with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ testUser, page }) => {
    await page.goto('/auth/signin');

    // Fill login form with valid credentials
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');

    // Should show authenticated content
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    await expect(page.locator('text=Welcome back')).toBeVisible();

    // Should show user menu
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should maintain authentication session across page reloads', async ({ authenticatedPage }) => {
    // Authenticated page should show dashboard
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();

    // Reload page
    await authenticatedPage.reload();

    // Should still be authenticated
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should allow users to sign up', async ({ page, database }) => {
    await page.goto('/auth/signup');

    // Fill signup form
    const newUserData = {
      name: 'New Test User',
      email: `new-test-${Date.now()}@example.com`,
      password: 'newpassword123'
    };

    await page.fill('input[name="name"]', newUserData.name);
    await page.fill('input[name="email"]', newUserData.email);
    await page.fill('input[name="password"]', newUserData.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard after signup
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

    // Verify user was created in database
    const users = await database.getUserByEmail(newUserData.email);
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe(newUserData.name);
  });

  test('should allow users to logout', async ({ authenticatedPage }) => {
    // Should be on dashboard when authenticated
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();

    // Click user menu and logout
    await authenticatedPage.click('[data-testid="user-menu"]');
    await authenticatedPage.click('text=Logout');

    // Should redirect to signin page
    await expect(authenticatedPage).toHaveURL('**/auth/signin');

    // Trying to access dashboard should redirect to signin
    await authenticatedPage.goto('/');
    await expect(authenticatedPage).toHaveURL('**/auth/signin');
  });

  test('should protect API routes with authentication', async ({ page, testUser }) => {
    // Try to access protected API without authentication
    const response = await page.request.get('http://localhost:3000/api/jobs');
    expect(response.status()).toBe(401);

    // Login and try again
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Wait for login to complete
    await page.waitForURL('/');

    // Now API should work
    const authenticatedResponse = await page.request.get('http://localhost:3000/api/jobs');
    expect(authenticatedResponse.status()).toBe(200);
  });

  test('should handle session expiration gracefully', async ({ authenticatedPage }) => {
    // Access dashboard while authenticated
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();

    // Clear cookies to simulate session expiration
    await authenticatedPage.context().clearCookies();

    // Try to access protected route
    await authenticatedPage.goto('/analytics');

    // Should redirect to signin page
    await expect(authenticatedPage).toHaveURL('**/auth/signin');
  });

  test('should show appropriate error states for network issues', async ({ page }) => {
    await page.goto('/auth/signin');

    // Fill form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');

    // Mock network failure by intercepting the request
    await page.route('**/api/auth/signin', route => route.abort('failed'));

    // Submit form
    await page.click('button[type="submit"]');

    // Should show network error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('text=Network error')).toBeVisible();
  });
});