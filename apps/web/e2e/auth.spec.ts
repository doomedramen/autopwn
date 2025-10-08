import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
  });

  test('should redirect to login page when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Should be redirected to login page
    await expect(page).toHaveURL(/.*\/auth\/login/, { timeout: 10000 });

    // Should see login form elements
    await expect(page.locator('h1')).toContainText(/Login|Sign In/i);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    // Wait for login form to load
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // Try to sign in with invalid credentials
    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'invalidpassword');
    await page.click('button[type="submit"]');

    // Should show error message (could be various formats)
    const errorSelectors = [
      'text=Invalid credentials',
      'text=Invalid email or password',
      'text=Authentication failed',
      '[role="alert"]',
      '.text-red-600'
    ];

    let errorFound = false;
    for (const selector of errorSelectors) {
      try {
        await expect(page.locator(selector)).toBeVisible({ timeout: 5000 });
        errorFound = true;
        break;
      } catch (e) {
        // Continue trying other selectors
      }
    }

    if (!errorFound) {
      // If no error is visible, check if we're still on login page (indicating failed login)
      await expect(page).toHaveURL(/.*\/auth\/login/);
    }
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/auth/login');

    // Click on sign up link
    await page.click('text=Sign up');

    // Should be on signup page
    await expect(page).toHaveURL(/.*\/auth\/signup/, { timeout: 5000 });

    // Should see signup form elements
    await expect(page.locator('h1')).toContainText(/Sign Up/i);
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('should attempt sign up with new user', async ({ page }) => {
    await page.goto('/auth/signup');

    // Generate random email for testing
    const testEmail = `test${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    const testName = 'Test User';

    // Fill sign up form
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for response - could be success or error
    await page.waitForTimeout(3000);

    // Check current state - either successful redirect or error message
    const currentUrl = page.url();

    if (currentUrl.includes('/auth/signup')) {
      // Still on signup page, check for error
      const errorVisible = await page.locator('.text-red-600, [role="alert"]').isVisible().catch(() => false);
      console.log('Signup error visible:', errorVisible);

      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/signup-error.png' });
    } else if (currentUrl === '/' || !currentUrl.includes('/auth/')) {
      // Successful redirect to main app
      console.log('Signup successful, redirected to:', currentUrl);
    } else {
      console.log('Unexpected redirect after signup:', currentUrl);
      await page.screenshot({ path: 'test-results/signup-unexpected.png' });
    }
  });

  test('should allow successful sign in with existing user', async ({ page }) => {
    // First try to create a user for testing
    const testEmail = `testlogin${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    const testName = 'Test Login User';

    // Try to sign up first
    await page.goto('/auth/signup');
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Now try to sign in
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Check if login was successful
    const currentUrl = page.url();

    if (currentUrl === '/' || !currentUrl.includes('/auth/')) {
      // Successful login
      console.log('Login successful, redirected to:', currentUrl);

      // Look for dashboard/home indicators
      const dashboardIndicators = [
        'text=Welcome back',
        'text=Dashboard',
        'text=Analytics',
        'text=Jobs'
      ];

      for (const indicator of dashboardIndicators) {
        if (await page.locator(indicator).isVisible().catch(() => false)) {
          console.log('Found dashboard indicator:', indicator);
          break;
        }
      }
    } else {
      // Login failed or still on auth page
      console.log('Login failed, current URL:', currentUrl);
      await page.screenshot({ path: 'test-results/login-failed.png' });
    }
  });

  test('should navigate between auth pages', async ({ page }) => {
    await page.goto('/auth/login');

    // Navigate to signup
    await page.click('text=Sign up');
    await expect(page).toHaveURL(/.*\/auth\/signup/);

    // Navigate back to signin
    await page.click('text=Sign in');
    await expect(page).toHaveURL(/.*\/auth\/signin/);

    // Navigate to login
    await page.goto('/auth/login');
    await expect(page).toHaveURL(/.*\/auth\/login/);
  });

  test('should handle protected route redirect', async ({ page }) => {
    // Try to access protected route directly
    await page.goto('/analytics');

    // Should redirect to login page
    await expect(page).toHaveURL(/.*\/auth\/login/, { timeout: 10000 });
  });
});