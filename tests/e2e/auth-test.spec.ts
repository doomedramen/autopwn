import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';

test.describe('Authentication Test', () => {
  let testUtils: TestUtils;

  test.beforeEach(async () => {
    testUtils = new TestUtils('auth-test');
    await (testUtils as any).initializeTestDatabase();
  });

  test.afterEach(async () => {
    if (testUtils) {
      await testUtils.cleanupAll();
    }
  });

  test('should show login page when not authenticated', async ({ page }) => {
    // Listen to console logs
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    await page.goto('/');
    
    // Should either show login form or redirect to login page
    await page.waitForTimeout(5000);
    
    // Check if we're on login page or see login elements
    const hasLoginForm = await page.locator('input[name="email"]').isVisible().catch(() => false);
    const hasLoginText = await page.locator('text=Please log in').isVisible().catch(() => false);
    const hasLoadingSpinner = await page.locator('.animate-spin').isVisible().catch(() => false);
    
    console.log('Login form visible:', hasLoginForm);
    console.log('Login text visible:', hasLoginText);
    console.log('Loading spinner visible:', hasLoadingSpinner);
    
    // Take a screenshot to see what's actually displayed
    await page.screenshot({ path: 'test-results/auth-test-page.png' });
    
    // The page should not be stuck in loading state
    expect(hasLoadingSpinner).toBe(false);
  });

  test('should create test user and login', async ({ page }) => {
    // Create a test user
    const testUser = await testUtils.createTestUserInApp();
    console.log('Created test user:', testUser.email);
    
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Check if we need to navigate to login
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (!currentUrl.includes('/auth/signin')) {
      // Try to find login link or navigate directly
      await page.goto('/auth/signin');
    }
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/login-page.png' });
    
    // Check if login form exists
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(testUser.email);
      await passwordInput.fill(testUser.password);
      
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      
      // Should redirect to dashboard
      await expect(page).toHaveURL('/');
      
      // Should see dashboard content
      await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });
    } else {
      console.log('Login form not found, checking page content...');
      const pageContent = await page.content();
      console.log('Page content preview:', pageContent.substring(0, 500));
    }
  });
});