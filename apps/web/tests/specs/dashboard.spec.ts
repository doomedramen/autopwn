import { test, expect } from '../fixtures/auth-fixture';
import { DashboardPage } from '../pages/dashboard-page';
import { TestUtils } from '../helpers/test-utils';

test.describe('Dashboard Functionality', () => {
  test('should display dashboard elements when authenticated', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    // Navigate to dashboard - this will use the stored authentication state from auth.setup.ts
    await dashboardPage.navigate('/dashboard');

    // Verify dashboard specific elements
    expect(await dashboardPage.isOnDashboard()).toBeTruthy();
    expect(await dashboardPage.isNavigationAvailable()).toBeTruthy();
    expect(await dashboardPage.isUserMenuVisible()).toBeTruthy();

    // Use test utils to wait for network idle
    await TestUtils.waitForNetworkIdle(page);
  });

  test('should allow user to navigate between sections', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    // Start at dashboard
    await dashboardPage.navigate('/dashboard');
    expect(await dashboardPage.isOnDashboard()).toBeTruthy();

    // Navigate to another section (using a generic approach)
    // Replace 'networks' with an actual section from your app
    await dashboardPage.navigateTo('networks');
    
    // Wait for navigation to complete
    await page.waitForURL('**/networks', { timeout: 10000 });
  });
});