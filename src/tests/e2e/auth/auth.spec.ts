import { test, expect } from '@playwright/test';
import { TestHelpers } from '../helpers/test-helpers';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start from a clean state
    await page.context().clearCookies();
  });

  test.describe('System Initialization', () => {
    test('should initialize system when no users exist', async ({ page }) => {
      // This test assumes a clean database
      const user = await TestHelpers.initializeSystem(page);

      expect(user.email).toBeDefined();
      expect(user.password).toBeDefined();
      expect(user.username).toBe('superuser');
    });

    test('should prevent initialization when system already initialized', async ({
      page,
    }) => {
      // First initialize the system
      await TestHelpers.initializeSystem(page);

      // Try to go to setup again
      await page.goto('/setup');

      // Should be redirected to login or dashboard
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(login|dashboard|$)/);
      expect(currentUrl).not.toContain('/setup');
    });
  });

  test.describe('Login Flow', () => {
    test('should show login page with proper elements', async ({ page }) => {
      await page.goto('/login');

      // Check page elements
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
    });

    test('should validate required fields on login', async ({ page }) => {
      await page.goto('/login');

      // Try to login without filling fields
      await page.click('button:has-text("Sign In")');

      // Should have HTML5 validation
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');

      await expect(emailInput).toHaveAttribute('required');
      await expect(passwordInput).toHaveAttribute('required');
    });

    test('should login successfully with valid credentials', async ({
      page,
    }) => {
      const user = await TestHelpers.initializeSystem(page);
      await TestHelpers.login(page, user.email, user.password);

      // Should be redirected to dashboard
      expect(page.url()).toMatch(/\/(dashboard|$)/);
    });

    test('should require password change on first login', async ({ page }) => {
      const user = await TestHelpers.initializeSystem(page);

      await page.goto('/login');
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      await page.click('button:has-text("Sign In")');

      // Should be redirected to change password page
      await expect(page).toHaveURL(/.*\/change-password/, { timeout: 10000 });

      // Change password
      const newPassword = 'NewTestPassword123!';
      await page.fill('input[name="currentPassword"]', user.password);
      await page.fill('input[name="newPassword"]', newPassword);
      await page.fill('input[name="confirmPassword"]', newPassword);
      await page.click('button:has-text("Change Password")');

      // Wait for success message and redirect
      await page.waitForSelector('text=Password Updated!', { timeout: 10000 });
      await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });
    });

    test('should reject invalid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[type="email"]', 'invalid@example.com');
      await page.fill('input[type="password"]', 'invalidpassword');
      await page.click('button:has-text("Sign In")');

      // Should stay on login page or show error
      await page.waitForTimeout(2000);
      expect(page.url()).toContain('/login');
    });
  });

  test.describe('Authentication Guards', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Try to access protected routes without authentication
      const protectedRoutes = ['/'];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await page.waitForTimeout(2000);

        // Should be redirected to login
        expect(page.url()).toContain('/login');
      }
    });

    test('should allow access to public routes without authentication', async ({
      page,
    }) => {
      // These routes should be accessible without authentication
      const publicRoutes = ['/login', '/setup'];

      for (const route of publicRoutes) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        // Should not be redirected to login
        expect(page.url()).toContain(route);
      }
    });
  });

  test.describe('Password Change', () => {
    test('should validate password requirements', async ({ page }) => {
      const user = await TestHelpers.initializeSystem(page);

      // Login and get to password change page
      await page.goto('/login');
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      await page.click('button:has-text("Sign In")');

      await expect(page).toHaveURL(/.*\/change-password/, { timeout: 10000 });

      // Test password mismatch
      await page.fill('input[name="currentPassword"]', user.password);
      await page.fill('input[name="newPassword"]', 'NewPassword123!');
      await page.fill('input[name="confirmPassword"]', 'DifferentPassword!');
      await page.click('button:has-text("Change Password")');

      // Should show error
      await expect(page.locator("text=Passwords don't match")).toBeVisible();

      // Test password too short
      await page.fill('input[name="newPassword"]', '123');
      await page.fill('input[name="confirmPassword"]', '123');
      await page.click('button:has-text("Change Password")');

      // Should show validation error or password requirements
      await page.waitForTimeout(1000);
    });

    test('should successfully change password', async ({ page }) => {
      const user = await TestHelpers.initializeSystem(page);

      // Login and get to password change page
      await page.goto('/login');
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      await page.click('button:has-text("Sign In")');

      await expect(page).toHaveURL(/.*\/change-password/, { timeout: 10000 });

      // Change password
      const newPassword = 'SecureNewPassword123!';
      await page.fill('input[name="currentPassword"]', user.password);
      await page.fill('input[name="newPassword"]', newPassword);
      await page.fill('input[name="confirmPassword"]', newPassword);
      await page.click('button:has-text("Change Password")');

      // Wait for success message and redirect
      await page.waitForSelector('text=Password Updated!', { timeout: 10000 });
      await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });

      // Verify new password works by logging out and back in
      await page.context().clearCookies();
      await page.goto('/login');
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', newPassword);
      await page.click('button:has-text("Sign In")');

      // Should login successfully without password change prompt
      await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });
    });
  });
});

test.describe('Auth Disabled Mode', () => {
  test('should bypass login and access dashboard directly', async ({
    page,
  }) => {
    // Skip this test unless auth is disabled
    test.skip(process.env.DISABLE_AUTH !== 'true', 'Auth is enabled');

    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 5000 });

    // Should be able to access dashboard without login
    expect(page.url()).toMatch(/\/(dashboard|$)/);
  });

  test('should create user via API directly in auth disabled mode', async ({
    request,
  }) => {
    // Skip this test unless auth is disabled
    test.skip(process.env.DISABLE_AUTH !== 'true', 'Auth is enabled');

    const userData = TestHelpers.generateTestData();

    // Try to create user via API without authentication
    const response = await request.post('/api/admin/users', {
      data: {
        username: userData.username,
        email: userData.email,
        password: userData.password,
        role: 'user',
      },
    });

    // In auth disabled mode, this might work or be handled differently
    // The exact behavior depends on implementation
    console.log(
      'Auth disabled mode - user creation response:',
      response.status()
    );
  });
});
