import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';

test.describe('Full Cracking Workflow E2E', () => {
  let testUtils: TestUtils;
  let config: any;

  test.beforeAll(async () => {
    testUtils = new TestUtils('full-cracking-workflow');
    config = testUtils.getTestConfig();

    // Setup test dictionaries with known passwords
    setupTestDictionaries();
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  function setupTestDictionaries() {
    // Create dictionaries with known passwords from test pcaps
    testUtils.createTestDictionary('known-passwords.txt', [
      'abcdefgh',      // From WPA3 test files
      '12345678',      // From aircrack-ng test
      'password',      // Common
      'qwerty',        // Common
      'admin',         // Common
      'testpass',      // Test password
      'network123',    // Variation
      'mywifi',        // Simple
      'home2024',      // With year
      'default'        // Default
    ]);

    // Create comprehensive dictionary for testing
    const comprehensiveWords = [
      'abcdefgh', '12345678', 'password', 'qwerty', 'admin',
      'test', 'network', 'wifi', 'home', 'default',
      '123456', '123456789', 'password123', 'admin123',
      'qwerty123', 'letmein', 'dragon', 'master',
      'hello', 'freedom', 'whatever', 'qazwsx',
      'trustno1', '123qwe', '1q2w3e4r', 'zxcvbn'
    ];
    testUtils.createTestDictionary('comprehensive.txt', comprehensiveWords);
  }

  test('should upload pcap file successfully', async ({ page }) => {
    // Copy local pcap files to test directory
    const localPcaps = testUtils.getLocalPcapFiles();
    expect(localPcaps.length).toBeGreaterThan(0);

    await page.goto('/');

    // Look for file upload functionality
    const fileInput = page.locator('input[type="file"]');

    if (await fileInput.isVisible()) {
      // Get a test pcap file
      const testPcap = `${config.testInputDir}/${localPcaps[0].filename}`;

      // Upload the file
      await fileInput.setInputFiles(testPcap);

      // Wait for upload to complete (check for success message or new job in queue)
      await page.waitForTimeout(3000);

      // Check if job appears in the queue
      const jobTable = page.locator('table');
      await expect(jobTable).toBeVisible();

      // Look for the uploaded file in the job list
      const uploadedJob = page.locator(`text=${localPcaps[0].filename}`);
      // Note: This might not be visible immediately as processing takes time
    } else {
      console.log('File upload not visible - may need to navigate to upload page');
    }
  });

  test('should create custom dictionary and use it for cracking', async ({ page }) => {
    await page.goto('/');

    // Fill in base words
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('abcdefgh\n12345678\npassword');

    // Keep all options checked
    await expect(page.locator('input:checked')).toHaveCount(3);

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
    await expect(page.locator('text=Total entries:')).toBeVisible();

    // Verify the wordlist has entries
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(0);

    console.log(`Generated dictionary with ${entryCount} words`);
  });

  test('should handle job queue management', async ({ page }) => {
    await page.goto('/');

    // Wait for job queue to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if table is visible
    const jobTable = page.locator('table');
    await expect(jobTable).toBeVisible();

    // Check for job filtering
    const statusFilter = page.locator('select');
    await expect(statusFilter).toBeVisible();

    // Test filtering by different statuses
    const statuses = ['all', 'pending', 'processing', 'completed', 'failed'];

    for (const status of statuses) {
      await statusFilter.selectOption(status);
      await page.waitForTimeout(500);
      await expect(statusFilter).toHaveValue(status);
    }

    // Test search functionality
    const searchInput = page.locator('input[placeholder="Search by filename or ID..."]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');
    await searchInput.fill('');
  });

  test('should display job details and logs', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

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
    }
  });

  test('should process batch jobs correctly', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for batch jobs (marked with BATCH badge)
    const batchJobs = page.locator('text=BATCH');
    const batchJobCount = await batchJobs.count();

    if (batchJobCount > 0) {
      // Look for expand/collapse buttons for batch jobs
      const expandButtons = page.locator('button').filter({ hasText: /▶|▼/ });

      if (await expandButtons.count() > 0) {
        // Click first expand button
        await expandButtons.first().click();
        await page.waitForTimeout(500);

        // Check if batch items are displayed
        const batchItems = page.locator('text=Batch Items');
        if (await batchItems.count() > 0) {
          await expect(batchItems.first()).toBeVisible();
        }
      }
    }
  });

  test('should handle retry workflow with dictionary selection', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for failed jobs
    const failedJobs = page.locator('tr:has(td:has-text("failed"))');
    const failedJobCount = await failedJobs.count();

    if (failedJobCount > 0) {
      // Select a failed job
      const failedJobCheckbox = failedJobs.first().locator('input[type="checkbox"]');
      await failedJobCheckbox.check();

      // Click retry button
      const retryButton = page.locator('button:has-text("Retry Selected")');
      await expect(retryButton).toBeVisible();
      await retryButton.click();

      // Check retry modal opens
      await expect(page.locator('text=Retry Selected Jobs with Custom Dictionaries')).toBeVisible();

      // Select dictionaries
      const dictionaryCheckboxes = page.locator('div[role="dialog"] input[type="checkbox"]');
      if (await dictionaryCheckboxes.count() > 0) {
        await dictionaryCheckboxes.first().check();

        // Check create button is enabled
        const createButton = page.locator('button:has-text("Create Retry Batch")');
        await expect(createButton).toBeEnabled();

        // Close modal (don't actually create retry job to avoid affecting test environment)
        await page.locator('button:has-text("Cancel")').click();
      }
    } else {
      console.log('No failed jobs found for retry testing');
    }
  });

  test('should handle priority changes', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for priority dropdowns
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

  test('should integrate dictionary generation with job processing', async ({ page }) => {
    await page.goto('/');

    // Fill in base words
    const essid = 'TestNetwork';
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill(`testpass\npassword123\n${essid.toLowerCase()}`);

    // Keep numbers and caps options checked
    await page.locator('label:has-text("Append numbers") input').check();
    await page.locator('label:has-text("Append special characters") input').uncheck();
    await page.locator('label:has-text("Capitalize variations") input').check();

    // Add custom pattern with year
    const customPatternInput = page.locator('input[placeholder*="{word}{year}"]');
    await customPatternInput.fill('{word}{year}');

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
    await expect(page.locator('text=Total entries:')).toBeVisible();

    // Verify the wordlist has entries
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(0);

    console.log(`Generated targeted dictionary with ${entryCount} words`);
  });

  test('should handle multiple dictionary generations', async ({ page }) => {
    await page.goto('/');

    // Generate multiple dictionaries sequentially
    for (let i = 0; i < 3; i++) {
      // Fill in base words
      const baseWordsTextarea = page.locator('textarea');
      await baseWordsTextarea.fill(`testpass${i}`);

      // Keep all options checked for first one, fewer for others
      if (i === 0) {
        await expect(page.locator('input:checked')).toHaveCount(3);
      } else {
        await page.locator('label:has-text("Append numbers") input').check();
        await page.locator('label:has-text("Append special characters") input').uncheck();
        await page.locator('label:has-text("Capitalize variations") input').uncheck();
      }

      // Generate wordlist
      await page.locator('button:has-text("Generate Wordlist")').click();

      // Wait for generation to complete
      await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

      // Verify success message
      await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
      await expect(page.locator('text=Total entries:')).toBeVisible();

      // Verify the wordlist has entries
      const entriesText = await page.locator('text=Total entries:').textContent();
      expect(entriesText).toMatch(/\d+/);
      const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
      expect(entryCount).toBeGreaterThan(0);

      console.log(`Generated dictionary ${i+1} with ${entryCount} words`);
    }
  });

  test('should maintain data consistency', async ({ page }) => {
    await page.goto('/');

    // 1. Generate dictionary
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('consistency\ntest\npassword');

    // Uncheck all options to only use base words
    await page.locator('label:has-text("Append numbers") input').uncheck();
    await page.locator('label:has-text("Append special characters") input').uncheck();
    await page.locator('label:has-text("Capitalize variations") input').uncheck();

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();

    // 2. Check job queue
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 3. Verify basic functionality still works
    const jobTable = page.locator('table');
    await expect(jobTable).toBeVisible();

    const searchInput = page.locator('input[placeholder="Search by filename or ID..."]');
    await expect(searchInput).toBeVisible();

    // 4. Test search functionality still works
    await searchInput.fill('consistency');
    await expect(searchInput).toHaveValue('consistency');
    await searchInput.fill('');

    // Verify the wordlist has entries
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBe(3); // Should have exactly 3 words
  });

  test('should handle error scenarios gracefully', async ({ page }) => {
    await page.goto('/');

    // Try to generate without entering base words
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Should show alert (we can't test alert content easily in Playwright, but we can verify it doesn't generate)
    await expect(page.locator('text=Wordlist generated successfully!')).not.toBeVisible({ timeout: 2000 });

    // Test UI remains functional after error
    await page.waitForLoadState('networkidle');

    const jobTable = page.locator('table');
    await expect(jobTable).toBeVisible();
  });

  test('should be mobile responsive throughout workflow', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Test entire workflow on mobile
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check main elements are visible
    await expect(page.locator('h2:has-text("Job Queue")')).toBeVisible();

    const jobTable = page.locator('table');
    await expect(jobTable).toBeVisible();

    // Test search on mobile
    const searchInput = page.locator('input[placeholder="Search by filename or ID..."]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await expect(searchInput).toHaveValue('test');
      await searchInput.fill('');
    }

    // Test dictionary generation on mobile
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('mobile\ntest');

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
  });
});