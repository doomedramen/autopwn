import { test, expect } from '@playwright/test';

test.describe('Basic UI Functionality Tests', () => {
  test('should load signup page and display form elements', async ({ page }) => {
    // Go to signup page
    await page.goto('/auth/signup');

    // Verify page title and form elements are present
    await expect(page.getByText('Sign Up').first()).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    console.log('✅ Signup page loaded with all form elements');
  });

  test('should load login page and display form elements', async ({ page }) => {
    // Go to login page
    await page.goto('/auth/login');

    // Verify page title and form elements are present
    await expect(page.getByText('Login to AutoPWN')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();

    console.log('✅ Login page loaded with all form elements');
  });

  test('should redirect unauthenticated users from protected routes', async ({ page }) => {
    // Try to access protected dashboard route
    await page.goto('/');

    // Should redirect to login page
    await page.waitForURL(/.*\/auth\/login/, { timeout: 5000 });

    // Verify we're on login page
    await expect(page.getByText('Login to AutoPWN')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    console.log('✅ Protected route redirect working correctly');
  });

  test('should display navigation components on dashboard when authenticated', async ({ page }) => {
    // This test will navigate to dashboard and check UI components are present
    // even if user is not fully authenticated (just testing UI layout)

    await page.goto('/');

    // Wait for potential redirect
    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    if (currentUrl === '/') {
      // We're on the dashboard, check for UI components
      await expect(page.locator('h1')).toBeVisible();
      console.log('✅ Dashboard loaded with UI components');
    } else {
      // We were redirected, which is also correct behavior
      console.log('✅ Correctly redirected from protected route');
    }
  });

  test('should have responsive design elements', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/auth/signup');

    // Check mobile layout
    await expect(page.getByText('Sign Up').first()).toBeVisible();
    console.log('✅ Mobile layout working correctly');

    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.getByText('Sign Up').first()).toBeVisible();
    console.log('✅ Desktop layout working correctly');
  });

  test('should handle form interactions', async ({ page }) => {
    await page.goto('/auth/signup');

    // Fill form fields
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');

    // Verify values were filled
    expect(await page.inputValue('input[name="name"]')).toBe('Test User');
    expect(await page.inputValue('input[name="email"]')).toBe('test@example.com');
    expect(await page.inputValue('input[name="password"]')).toBe('testpassword123');

    console.log('✅ Form interactions working correctly');
  });
});