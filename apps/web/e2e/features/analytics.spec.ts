import { test, expect } from '../../tests/helpers/test-client';
import { navigateToAnalytics } from '../../tests/helpers/test-client';

test.describe('Analytics', () => {
  test.beforeEach(async ({ authenticatedPage, database, testUser }) => {
    // Create test data for analytics
    await database.createTestData(testUser.id, { jobCount: 5, resultCount: 10 });

    // Navigate to analytics page
    await navigateToAnalytics(authenticatedPage);
  });

  test('should display analytics page with overview', async ({ authenticatedPage }) => {
    // Should show analytics container
    await expect(authenticatedPage.locator('[data-testid="analytics-container"]')).toBeVisible();

    // Should show date range selector
    await expect(authenticatedPage.locator('[data-testid="date-range-selector"]')).toBeVisible();

    // Should show key metrics
    await expect(authenticatedPage.locator('[data-testid="total-jobs-metric"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="success-rate-metric"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="avg-completion-time-metric"]')).toBeVisible();

    // Should show charts
    await expect(authenticatedPage.locator('[data-testid="jobs-over-time-chart"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="cracks-over-time-chart"]')).toBeVisible();
  });

  test('should allow changing date ranges', async ({ authenticatedPage }) => {
    // Should default to 30 days
    await expect(authenticatedPage.locator('[data-testid="date-range-selector"]')).toHaveValue('30d');

    // Change to 7 days
    await authenticatedPage.selectOption('[data-testid="date-range-selector"]', '7d');
    await authenticatedPage.waitForTimeout(1000); // Wait for data reload

    // Should update charts
    await expect(authenticatedPage.locator('[data-testid="jobs-over-time-chart"]')).toBeVisible();

    // Change to 90 days
    await authenticatedPage.selectOption('[data-testid="date-range-selector"]', '90d');
    await authenticatedPage.waitForTimeout(1000); // Wait for data reload

    // Should update charts
    await expect(authenticatedPage.locator('[data-testid="jobs-over-time-chart"]')).toBeVisible();

    // Change to all time
    await authenticatedPage.selectOption('[data-testid="date-range-selector"]', 'all');
    await authenticatedPage.waitForTimeout(1000); // Wait for data reload

    // Should update charts
    await expect(authenticatedPage.locator('[data-testid="jobs-over-time-chart"]')).toBeVisible();
  });

  test('should show status distribution', async ({ authenticatedPage }) => {
    // Should show status distribution chart
    await expect(authenticatedPage.locator('[data-testid="status-distribution-chart"]')).toBeVisible();

    // Should show status breakdown
    await expect(authenticatedPage.locator('[data-testid="completed-jobs-count"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="failed-jobs-count"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="processing-jobs-count"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="pending-jobs-count"]')).toBeVisible();
  });

  test('should show dictionary effectiveness', async ({ authenticatedPage }) => {
    // Should show dictionary effectiveness section
    await expect(authenticatedPage.locator('[data-testid="dictionary-effectiveness"]')).toBeVisible();

    // Should show top dictionaries
    await expect(authenticatedPage.locator('[data-testid="dictionary-list"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toBeVisible();

    // Should show success rates
    await expect(authenticatedPage.locator('[data-testid="dictionary-success-rate"]')).toBeVisible();
  });

  test('should export analytics data', async ({ authenticatedPage }) => {
    // Click export button
    await authenticatedPage.click('[data-testid="export-analytics-btn"]');

    // Should show export dialog
    await expect(authenticatedPage.locator('[data-testid="export-dialog"]')).toBeVisible();

    // Should have format options
    await expect(authenticatedPage.locator('[data-testid="json-format"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="csv-format"]')).toBeVisible();

    // Export as JSON
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('[data-testid="json-format"]');
    await authenticatedPage.click('[data-testid="confirm-export-btn"]');

    // Should download JSON file
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    // Show success message
    await expect(authenticatedPage.locator('[data-testid="export-success-message"]')).toBeVisible();
  });

  test('should export as CSV format', async ({ authenticatedPage }) => {
    // Click export button
    await authenticatedPage.click('[data-testid="export-analytics-btn"]');

    // Select CSV format
    await authenticatedPage.click('[data-testid="csv-format"]');

    // Start export
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('[data-testid="confirm-export-btn"]');

    // Should download CSV file
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);

    // Show success message
    await expect(authenticatedPage.locator('[data-testid="export-success-message"]')).toBeVisible();
  });

  test('should show loading states during data fetching', async ({ authenticatedPage }) => {
    // Navigate fresh to analytics
    await authenticatedPage.goto('/analytics');

    // Should show loading indicators
    await expect(authenticatedPage.locator('[data-testid="loading-spinner"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="loading-charts"]')).toBeVisible();

    // Wait for data to load
    await authenticatedPage.waitForSelector('[data-testid="analytics-container"]', {
      state: 'visible',
      timeout: 15000
    });

    // Loading indicators should be gone
    await expect(authenticatedPage.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="loading-charts"]')).not.toBeVisible();
  });

  test('should handle empty analytics data', async ({ authenticatedPage, database, testUser }) => {
    // Clean up all data for this user
    await database.cleanupUserData(testUser.id);

    await authenticatedPage.reload();
    await navigateToAnalytics(authenticatedPage);

    // Should show empty state
    await expect(authenticatedPage.locator('[data-testid="empty-analytics-state"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=No data available for the selected time range')).toBeVisible();

    // Should still show date range selector
    await expect(authenticatedPage.locator('[data-testid="date-range-selector"]')).toBeVisible();

    // Should still show export option
    await expect(authenticatedPage.locator('[data-testid="export-analytics-btn"]')).toBeVisible();
  });

  test('should show detailed job statistics', async ({ authenticatedPage }) => {
    // Should show job statistics section
    await expect(authenticatedPage.locator('[data-testid="job-statistics"]')).toBeVisible();

    // Should show detailed metrics
    await expect(authenticatedPage.locator('[data-testid="total-jobs-stat"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="completed-jobs-stat"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="failed-jobs-stat"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="processing-jobs-stat"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="pending-jobs-stat"]')).toBeVisible();

    // Should show average metrics
    await expect(authenticatedPage.locator('[data-testid="avg-completion-time"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="success-rate-percentage"]')).toBeVisible();
  });

  test('should show result statistics', async ({ authenticatedPage }) => {
    // Should show result statistics section
    await expect(authenticatedPage.locator('[data-testid="result-statistics"]')).toBeVisible();

    // Should show total cracks
    await expect(authenticatedPage.locator('[data-testid="total-cracks-stat"]')).toBeVisible();

    // Should show unique networks
    await expect(authenticatedPage.locator('[data-testid="unique-networks-stat"]')).toBeVisible();

    // Should show average cracks per job
    await expect(authenticatedPage.locator('[data-testid="avg-cracks-per-job-stat"]')).toBeVisible();
  });

  test('should handle errors gracefully', async ({ authenticatedPage }) => {
    // Mock API failure
    await authenticatedPage.route('**/api/analytics**', route => route.abort('failed'));

    await authenticatedPage.reload();

    // Should show error state
    await expect(authenticatedPage.locator('[data-testid="analytics-error"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Failed to load analytics data')).toBeVisible();

    // Should provide retry option
    await expect(authenticatedPage.locator('[data-testid="retry-analytics-btn"]')).toBeVisible();

    // Retry should work
    await authenticatedPage.unroute('**/api/analytics**');
    await authenticatedPage.click('[data-testid="retry-analytics-btn"]');

    // Should load successfully
    await expect(authenticatedPage.locator('[data-testid="analytics-container"]')).toBeVisible();
  });

  test('should show real-time updates', async ({ authenticatedPage, database, testUser }) => {
    // Get initial metrics
    const initialJobsText = await authenticatedPage.locator('[data-testid="total-jobs-metric"]').textContent();

    // Create new job
    await database.createTestData(testUser.id);

    // Wait for WebSocket update
    await authenticatedPage.waitForTimeout(2000);

    // Should update metrics
    const updatedJobsText = await authenticatedPage.locator('[data-testid="total-jobs-metric"]').textContent();
    expect(updatedJobsText).not.toBe(initialJobsText);
  });

  test('should be responsive', async ({ authenticatedPage }) => {
    // Test desktop view
    await authenticatedPage.setViewportSize({ width: 1200, height: 800 });
    await expect(authenticatedPage.locator('[data-testid="analytics-sidebar"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="main-charts"]')).toBeVisible();

    // Test tablet view
    await authenticatedPage.setViewportSize({ width: 768, height: 1024 });
    await expect(authenticatedPage.locator('[data-testid="analytics-sidebar"]')).not.toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="mobile-menu-btn"]')).toBeVisible();

    // Test mobile view
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await expect(authenticatedPage.locator('[data-testid="analytics-sidebar"]')).not.toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="mobile-menu-btn"]')).toBeVisible();

    // Charts should still be visible on mobile
    await expect(authenticatedPage.locator('[data-testid="jobs-over-time-chart"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="status-distribution-chart"]')).toBeVisible();
  });

  test('should have keyboard navigation support', async ({ authenticatedPage }) => {
    // Focus date range selector
    await authenticatedPage.focus('[data-testid="date-range-selector"]');
    await authenticatedPage.keyboard.press('ArrowDown');
    await authenticatedPage.keyboard.press('Enter');

    // Should change selection
    expect(await authenticatedPage.locator('[data-testid="date-range-selector"]').inputValue()).not.toBe('30d');

    // Focus export button
    await authenticatedPage.focus('[data-testid="export-analytics-btn"]');
    await authenticatedPage.keyboard.press('Enter');

    // Should open export dialog
    await expect(authenticatedPage.locator('[data-testid="export-dialog"]')).toBeVisible();

    // Close with Escape
    await authenticatedPage.keyboard.press('Escape');
    await expect(authenticatedPage.locator('[data-testid="export-dialog"]')).not.toBeVisible();
  });
});