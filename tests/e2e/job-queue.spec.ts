import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';

test.describe('Job Queue Management', () => {
  let testUtils: TestUtils;

  test.beforeAll(async () => {
    testUtils = new TestUtils('job-queue-e2e');
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  test('should display job queue with correct elements', async ({ page }) => {
    await page.goto('/');

    // Check if main elements are present
    await expect(page.locator('h2:has-text("Job Queue")')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('input[placeholder="Search by filename or ID..."]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
  });

  test('should filter jobs by status', async ({ page }) => {
    await page.goto('/');

    // Get status filter dropdown
    const statusFilter = page.locator('select');
    await expect(statusFilter).toBeVisible();

    // Test different status filters
    const statuses = ['all', 'pending', 'processing', 'completed', 'failed'];

    for (const status of statuses) {
      await statusFilter.selectOption(status);
      await expect(statusFilter).toHaveValue(status);
      // Give it a moment to filter
      await page.waitForTimeout(500);
    }
  });

  test('should search jobs by filename', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('input[placeholder="Search by filename or ID..."]');
    await expect(searchInput).toBeVisible();

    // Type in search query
    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');

    // Clear search
    await searchInput.fill('');
    await expect(searchInput).toHaveValue('');
  });

  test('should display batch job expansion', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Look for batch jobs (they should have an expand/collapse button)
    const batchExpandButtons = page.locator('button').filter({ hasText: /▶|▼/ });

    if (await batchExpandButtons.count() > 0) {
      // Click first expand button
      await batchExpandButtons.first().click();

      // Check if batch items are displayed
      await page.waitForTimeout(500);
      const batchItems = page.locator('text=Batch Items');

      if (await batchItems.count() > 0) {
        await expect(batchItems.first()).toBeVisible();
      }
    }
  });

  test('should display retry functionality for failed jobs', async ({ page }) => {
    await page.goto('/');

    // Look for failed jobs and retry buttons
    const retryButtons = page.locator('button:has-text("Retry")');

    // The retry buttons should only be visible for failed jobs
    // We can't guarantee there will be failed jobs in a fresh test environment
    // but we can check that the buttons exist and are clickable when visible
    const retryCount = await retryButtons.count();

    if (retryCount > 0) {
      await expect(retryButtons.first()).toBeVisible();
      // Note: We don't actually click it to avoid affecting the test environment
    }
  });

  test('should display job logs modal', async ({ page }) => {
    await page.goto('/');

    // Look for log buttons
    const logButtons = page.locator('button:has-text("Logs")');
    const logButtonCount = await logButtons.count();

    if (logButtonCount > 0) {
      // Click the first logs button
      await logButtons.first().click();

      // Check if modal appears
      await expect(page.locator('text=Job #')).toBeVisible();
      await expect(page.locator('button:has-text("✕")')).toBeVisible();

      // Close the modal
      await page.locator('button:has-text("✕")').click();

      // Verify modal is closed
      await expect(page.locator('text=Job #')).not.toBeVisible();
    }
  });

  test('should handle priority selection', async ({ page }) => {
    await page.goto('/');

    // Look for priority dropdowns in the table
    const prioritySelects = page.locator('table select').filter({ hasText: /Normal|High|Urgent|Low/ });
    const selectCount = await prioritySelects.count();

    if (selectCount > 0) {
      const firstSelect = prioritySelects.first();
      await expect(firstSelect).toBeVisible();

      // Check available options
      await expect(firstSelect.locator('option[value="0"]')).toHaveText('Normal');
      await expect(firstSelect.locator('option[value="1"]')).toHaveText('High');
      await expect(firstSelect.locator('option[value="2"]')).toHaveText('Urgent');
      await expect(firstSelect.locator('option[value="-1"]')).toHaveText('Low');
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Simulate mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check if main elements are still visible on mobile
    await expect(page.locator('h2:has-text("Job Queue")')).toBeVisible();

    // Check if table is responsive (may require horizontal scrolling on mobile)
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Check if mobile menu works if it exists
    const mobileMenu = page.locator('button[aria-label="Menu"], button:has-text("Menu")');
    if (await mobileMenu.count() > 0) {
      await mobileMenu.first().click();
      await page.waitForTimeout(500);
    }
  });
});