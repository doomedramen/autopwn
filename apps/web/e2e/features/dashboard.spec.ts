import { test, expect } from '../../tests/helpers/test-client';
import { navigateToAnalytics, isElementVisible } from '../../tests/helpers/test-client';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to dashboard
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
  });

  test('should display dashboard with key metrics', async ({ authenticatedPage }) => {
    // Should show welcome message
    await expect(authenticatedPage.locator('text=Welcome back')).toBeVisible();

    // Should show stats cards
    await expect(authenticatedPage.locator('[data-testid="stats-cards"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="total-jobs-card"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="completed-jobs-card"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="total-cracks-card"]')).toBeVisible();

    // Should show recent activity section
    await expect(authenticatedPage.locator('[data-testid="recent-activity"]')).toBeVisible();
  });

  test('should show empty state when no data exists', async ({ authenticatedPage, database, testUser }) => {
    // Ensure user has no jobs
    const jobCount = await database.getJobCount(testUser.id);
    expect(jobCount).toBe(0);

    // Should show empty state
    await expect(authenticatedPage.locator('[data-testid="empty-state"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=No jobs yet')).toBeVisible();

    // Should show call-to-action to create first job
    await expect(authenticatedPage.locator('[data-testid="create-first-job-btn"]')).toBeVisible();
  });

  test('should display recent jobs list', async ({ authenticatedPage, database, testUser }) => {
    // Create some test jobs
    await database.createTestData(testUser.id, { jobCount: 3 });

    await authenticatedPage.reload();
    await authenticatedPage.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });

    // Should show recent jobs section
    await expect(authenticatedPage.locator('[data-testid="recent-jobs"]')).toBeVisible();

    // Should show job items
    await expect(authenticatedPage.locator('[data-testid^="job-item-"]')).toHaveCount(3);
  });

  test('should allow navigation to analytics page', async ({ authenticatedPage }) => {
    // Click analytics link/button
    await authenticatedPage.click('[data-testid="analytics-link"], a[href="/analytics"]');

    // Should navigate to analytics page
    await expect(authenticatedPage).toHaveURL('**/analytics');
    await expect(authenticatedPage.locator('[data-testid="analytics-container"]')).toBeVisible();
  });

  test('should allow navigation to jobs page', async ({ authenticatedPage }) => {
    // Click jobs link/button
    await authenticatedPage.click('[data-testid="jobs-link"], a[href="/jobs"]');

    // Should navigate to jobs page
    await expect(authenticatedPage).toHaveURL('**/jobs');
    await expect(authenticatedPage.locator('[data-testid="jobs-container"]')).toBeVisible();
  });

  test('should show job creation dialog', async ({ authenticatedPage }) => {
    // Click create job button
    await authenticatedPage.click('[data-testid="create-job-btn"]');

    // Should show job creation dialog
    await expect(authenticatedPage.locator('[data-testid="job-creation-dialog"]')).toBeVisible();
    await expect(authenticatedPage.locator('input[name="filename"]')).toBeVisible();
    await expect(authenticatedPage.locator('input[type="file"]')).toBeVisible();
  });

  test('should handle real-time updates', async ({ authenticatedPage, database, testUser }) => {
    // Start with empty dashboard
    await expect(authenticatedPage.locator('[data-testid="empty-state"]')).toBeVisible();

    // Create a job via database (simulating background process)
    const { job } = await database.createTestData(testUser.id);

    // Wait for WebSocket update
    await authenticatedPage.waitForFunction(
      (expectedJobId) => {
        const jobElement = document.querySelector(`[data-job-id="${expectedJobId}"]`);
        return jobElement !== null;
      },
      { expectedJobId: job.jobId },
      { timeout: 10000 }
    );

    // Should show the new job
    await expect(authenticatedPage.locator(`[data-job-id="${job.jobId}"]`)).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="empty-state"]')).not.toBeVisible();
  });

  test('should show user menu with profile options', async ({ authenticatedPage, testUser }) => {
    // Click user menu
    await authenticatedPage.click('[data-testid="user-menu"]');

    // Should show dropdown menu
    await expect(authenticatedPage.locator('[data-testid="user-dropdown"]')).toBeVisible();

    // Should show user information
    await expect(authenticatedPage.locator(`text=${testUser.name}`)).toBeVisible();
    await expect(authenticatedPage.locator(`text=${testUser.email}`)).toBeVisible();

    // Should show menu options
    await expect(authenticatedPage.locator('text=Profile')).toBeVisible();
    await expect(authenticatedPage.locator('text=Settings')).toBeVisible();
    await expect(authenticatedPage.locator('text=Logout')).toBeVisible();
  });

  test('should handle responsive design correctly', async ({ authenticatedPage }) => {
    // Test desktop view
    await authenticatedPage.setViewportSize({ width: 1200, height: 800 });
    await expect(authenticatedPage.locator('[data-testid="sidebar-navigation"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="main-content"]')).toBeVisible();

    // Test tablet view
    await authenticatedPage.setViewportSize({ width: 768, height: 1024 });
    await expect(authenticatedPage.locator('[data-testid="sidebar-navigation"]')).not.toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="mobile-menu-btn"]')).toBeVisible();

    // Test mobile view
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await expect(authenticatedPage.locator('[data-testid="sidebar-navigation"]')).not.toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="mobile-menu-btn"]')).toBeVisible();

    // Mobile menu should work
    await authenticatedPage.click('[data-testid="mobile-menu-btn"]');
    await expect(authenticatedPage.locator('[data-testid="mobile-navigation"]')).toBeVisible();
  });

  test('should show loading states during data fetching', async ({ authenticatedPage }) => {
    // Navigate to dashboard fresh
    await authenticatedPage.goto('/');

    // Should show loading indicators
    await expect(authenticatedPage.locator('[data-testid="loading-spinner"]')).toBeVisible();

    // Wait for loading to complete
    await authenticatedPage.waitForSelector('[data-testid="dashboard"]', {
      state: 'visible',
      timeout: 10000
    });

    // Loading indicators should be gone
    await expect(authenticatedPage.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
  });

  test('should handle errors gracefully', async ({ authenticatedPage }) => {
    // Mock API failure
    await authenticatedPage.route('**/api/stats', route => route.abort('failed'));

    // Reload dashboard
    await authenticatedPage.reload();

    // Should show error state
    await expect(authenticatedPage.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Failed to load dashboard data')).toBeVisible();

    // Should provide retry option
    await expect(authenticatedPage.locator('[data-testid="retry-btn"]')).toBeVisible();
  });
});