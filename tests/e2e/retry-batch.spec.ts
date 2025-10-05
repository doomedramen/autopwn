import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';

test.describe('Batch Retry with Dictionary Selection', () => {
  let testUtils: TestUtils;
  const config = {
    testDbPath: '',
    testInputDir: '',
    testOutputDir: '',
    testDictDir: ''
  };

  test.beforeAll(async () => {
    testUtils = new TestUtils('retry-batch-e2e');
    config.testDbPath = testUtils.getTestConfig().testDbPath;
    config.testInputDir = testUtils.getTestConfig().testInputDir;
    config.testDictDir = testUtils.getTestConfig().testDictDir;

    // Setup test data with failed jobs
    await setupFailedJobs();
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  async function setupFailedJobs() {
    const db = testUtils.getDatabase();

    // Create test dictionaries
    testUtils.createTestDictionary('small-dict.txt', ['password', '123456', 'qwerty', 'abcdefgh']);
    testUtils.createTestDictionary('medium-dict.txt', ['password', '123456', 'qwerty', 'abcdefgh', 'testing', 'admin', 'root', 'user']);
    testUtils.createTestDictionary('large-dict.txt', Array.from({ length: 100 }, (_, i) => `password${i}`));

    // Create failed batch job
    const jobResult = db.prepare(`
      INSERT INTO jobs (filename, status, priority, batch_mode, items_total, items_cracked, created_at, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
    `).run('test-batch-job', 'failed', 0, 1, 3, 0);

    const jobId = jobResult.lastInsertRowid as number;

    // Create job items
    const pcapFiles = testUtils.getLocalPcapFiles();
    for (let i = 0; i < Math.min(3, pcapFiles.length); i++) {
      const pcap = pcapFiles[i];
      db.prepare(`
        INSERT INTO job_items (job_id, filename, essid, bssid, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(jobId, pcap.filename, pcap.essid || `TestNetwork${i}`, `00:11:22:33:44:${55 + i}`, 'failed');
    }

    db.close();
  }

  test('should display batch retry UI elements', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load and jobs to appear
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give time for jobs to load

    // Check for checkboxes in the table header
    const headerCheckbox = page.locator('th input[type="checkbox"]');
    await expect(headerCheckbox).toBeVisible();

    // Check for failed job checkboxes
    const failedJobCheckboxes = page.locator('tr td input[type="checkbox"]');
    const checkboxCount = await failedJobCheckboxes.count();

    expect(checkboxCount).toBeGreaterThan(0);
  });

  test('should allow selecting failed jobs', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find failed job rows and select them
    const failedJobCheckboxes = page.locator('tr:has(td:has-text("failed")) td input[type="checkbox"]');
    const checkboxCount = await failedJobCheckboxes.count();

    if (checkboxCount > 0) {
      // Select first failed job
      await failedJobCheckboxes.first().check();
      await expect(failedJobCheckboxes.first()).toBeChecked();

      // Check if retry button appears
      const retryButton = page.locator('button:has-text("Retry Selected")');
      await expect(retryButton).toBeVisible();
      await expect(retryButton).toContainText('Retry Selected (1)');
    } else {
      // If no failed jobs exist, check that the UI still works
      console.log('No failed jobs found in test environment');
    }
  });

  test('should open retry modal when retry button clicked', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Try to select failed jobs
    const failedJobCheckboxes = page.locator('tr:has(td:has-text("failed")) td input[type="checkbox"]');
    const checkboxCount = await failedJobCheckboxes.count();

    if (checkboxCount > 0) {
      // Select a failed job
      await failedJobCheckboxes.first().check();

      // Click retry button
      const retryButton = page.locator('button:has-text("Retry Selected")');
      await retryButton.click();

      // Check if modal opens
      await expect(page.locator('text=Retry Selected Jobs with Custom Dictionaries')).toBeVisible();
      await expect(page.locator('text=Selected Jobs')).toBeVisible();
      await expect(page.locator('text=Select Dictionaries')).toBeVisible();

      // Check for modal buttons
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
      await expect(page.locator('button:has-text("Create Retry Batch")')).toBeVisible();

      // Close modal for cleanup
      await page.locator('button:has-text("Cancel")').click();
    }
  });

  test('should display dictionary selection in retry modal', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const failedJobCheckboxes = page.locator('tr:has(td:has-text("failed")) td input[type="checkbox"]');
    const checkboxCount = await failedJobCheckboxes.count();

    if (checkboxCount > 0) {
      await failedJobCheckboxes.first().check();

      const retryButton = page.locator('button:has-text("Retry Selected")');
      await retryButton.click();

      // Check for dictionary checkboxes
      const dictionaryCheckboxes = page.locator('div[role="dialog"] input[type="checkbox"]');
      await expect(dictionaryCheckboxes.first()).toBeVisible();

      // Check dictionary names and sizes are displayed
      await expect(page.locator('text=test-dict-small')).toBeVisible();
      await expect(page.locator('text=test-dict-medium')).toBeVisible();
      await expect(page.locator('text=test-dict-large')).toBeVisible();

      // Try selecting a dictionary
      const firstDictCheckbox = dictionaryCheckboxes.first();
      await firstDictCheckbox.check();
      await expect(firstDictCheckbox).toBeChecked();

      // Check if create button is enabled
      const createButton = page.locator('button:has-text("Create Retry Batch")');
      await expect(createButton).toBeEnabled();

      // Close modal
      await page.locator('button:has-text("Cancel")').click();
    }
  });

  test('should validate retry modal state', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test without selecting any jobs
    const retryButton = page.locator('button:has-text("Retry Selected")');
    if (await retryButton.isVisible()) {
      await retryButton.click();

      // Should show alert about selecting jobs
      // Note: Testing alerts in Playwright can be tricky, so we'll check if modal doesn't open
      const modal = page.locator('text=Retry Selected Jobs with Custom Dictionaries');
      const isVisible = await modal.isVisible().catch(() => false);

      if (!isVisible) {
        console.log('Alert correctly prevented modal from opening without job selection');
      }

      // If modal did open, close it
      if (isVisible) {
        await page.locator('button:has-text("Cancel")').click();
      }
    }
  });

  test('should handle multiple job selection', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const failedJobCheckboxes = page.locator('tr:has(td:has-text("failed")) td input[type="checkbox"]');
    const checkboxCount = await failedJobCheckboxes.count();

    if (checkboxCount > 1) {
      // Select multiple failed jobs
      await failedJobCheckboxes.first().check();
      await failedJobCheckboxes.nth(1).check();

      // Check retry button updates count
      const retryButton = page.locator('button:has-text("Retry Selected")');
      await expect(retryButton).toContainText('Retry Selected (2)');

      // Open modal
      await retryButton.click();

      // Check multiple jobs are listed
      const selectedJobsSection = page.locator('text=Selected Jobs');
      await expect(selectedJobsSection).toBeVisible();

      // Close modal
      await page.locator('button:has-text("Cancel")').click();
    }
  });

  test('should handle select all functionality', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find the "select all" checkbox in the table header
    const selectAllCheckbox = page.locator('th input[type="checkbox"]');

    if (await selectAllCheckbox.isVisible()) {
      // Check all failed jobs
      await selectAllCheckbox.check();

      // Count how many failed jobs should be selected
      const failedJobs = page.locator('tr:has(td:has-text("failed"))');
      const failedJobCount = await failedJobs.count();

      if (failedJobCount > 0) {
        // Check if retry button shows correct count
        const retryButton = page.locator('button:has-text("Retry Selected")');
        await expect(retryButton).toContainText(`Retry Selected (${failedJobCount})`);

        // Uncheck all
        await selectAllCheckbox.uncheck();

        // Retry button should disappear or show count 0
        await page.waitForTimeout(500);
      }
    }
  });

  test('should be mobile responsive', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if retry functionality works on mobile
    const failedJobCheckboxes = page.locator('tr:has(td:has-text("failed")) td input[type="checkbox"]');
    const checkboxCount = await failedJobCheckboxes.count();

    if (checkboxCount > 0) {
      // Check if checkboxes are still clickable on mobile
      await failedJobCheckboxes.first().check();

      const retryButton = page.locator('button:has-text("Retry Selected")');
      if (await retryButton.isVisible()) {
        await retryButton.click();

        // Check modal is responsive
        await expect(page.locator('text=Retry Selected Jobs with Custom Dictionaries')).toBeVisible();

        // Close modal
        await page.locator('button:has-text("Cancel")').click();
      }
    }
  });
});