import { test, expect } from '../fixtures/auth-fixture';
import { DashboardPage } from '../pages/dashboard-page';
import { TestUtils } from '../helpers/test-utils';

test.describe('Dashboard Functionality', () => {
  test('should display dashboard elements when authenticated', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    // Navigate to main page - the dashboard is at root path (/)
    await page.goto('/');

    // Wait for page to fully load and session to be established
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Allow React to render

    // Verify dashboard specific elements with retry logic
    let isDashboardVisible = false;
    for (let i = 0; i < 3; i++) {
      isDashboardVisible = await dashboardPage.isOnDashboard();
      if (isDashboardVisible) break;
      await page.waitForTimeout(1000); // Wait and retry
    }

    expect(isDashboardVisible).toBeTruthy();
    expect(await dashboardPage.isNavigationAvailable()).toBeTruthy();
    expect(await dashboardPage.isUserMenuVisible()).toBeTruthy();

    // Use test utils to wait for network idle
    await TestUtils.waitForNetworkIdle(page);
  });

  test('should allow user to navigate between sections using tab navigation', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    // Start at dashboard (root path)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Wait for dashboard to be visible with retry logic
    let isDashboardVisible = false;
    for (let i = 0; i < 3; i++) {
      isDashboardVisible = await dashboardPage.isOnDashboard();
      if (isDashboardVisible) break;
      await page.waitForTimeout(1000);
    }
    expect(isDashboardVisible).toBeTruthy();

    // Initially, Networks tab should be active
    expect(await dashboardPage.isTabActive('networks')).toBeTruthy();

    // Navigate to Dictionaries tab
    await dashboardPage.navigateTo('dictionaries');
    expect(await dashboardPage.isTabActive('dictionaries')).toBeTruthy();

    // Navigate to Jobs tab
    await dashboardPage.navigateTo('jobs');
    expect(await dashboardPage.isTabActive('jobs')).toBeTruthy();

    // Navigate to Users tab
    await dashboardPage.navigateTo('users');
    expect(await dashboardPage.isTabActive('users')).toBeTruthy();

    // Navigate back to Networks tab
    await dashboardPage.navigateTo('networks');
    expect(await dashboardPage.isTabActive('networks')).toBeTruthy();
  });

  test('should logout using user menu', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    // Start at dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Wait for dashboard to be visible with retry logic
    let isDashboardVisible = false;
    for (let i = 0; i < 3; i++) {
      isDashboardVisible = await dashboardPage.isOnDashboard();
      if (isDashboardVisible) break;
      await page.waitForTimeout(1000);
    }
    expect(isDashboardVisible).toBeTruthy();

    // Use dashboard page logout method for consistency
    await dashboardPage.logout();

    // Should be redirected to sign-in page
    await page.waitForURL('/sign-in', { timeout: 15000 });
    await expect(page.locator('h2:has-text("Sign In")')).toBeVisible();
  });
});