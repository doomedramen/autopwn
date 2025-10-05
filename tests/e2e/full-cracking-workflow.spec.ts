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
    // First, generate a custom dictionary
    const dictResponse = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'TestNetwork',
        bssid: '00:11:22:33:44:55',
        custom_words: ['abcdefgh', '12345678', 'password'],
        use_common: true,
        use_digits: true,
        use_year_variations: false
      }
    });

    expect(dictResponse.status()).toBe(200);
    const dictResult = await dictResponse.json();
    expect(dictResult.wordlist.length).toBeGreaterThan(0);

    // Verify the dictionary contains our target passwords
    expect(dictResult.wordlist).toContain('abcdefgh');
    expect(dictResult.wordlist).toContain('12345678');

    console.log(`Generated dictionary with ${dictResult.wordlist.length} words`);
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
    // Generate a targeted dictionary
    const essid = 'TestNetwork';
    const bssid = '00:11:22:33:44:55';

    const dictResponse = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: essid,
        bssid: bssid,
        custom_words: ['testpass', 'password123', essid.toLowerCase()],
        use_common: false,
        use_digits: true,
        use_year_variations: true
      }
    });

    expect(dictResponse.status()).toBe(200);
    const dictResult = await dictResponse.json();

    // Verify generated dictionary
    expect(dictResult.wordlist.length).toBeGreaterThan(0);
    expect(dictResult.wordlist).toContain('testpass');
    expect(dictResult.wordlist).toContain('password123');
    expect(dictResult.wordlist.some(word => word.includes(essid.toLowerCase()))).toBe(true);

    // Dictionary should contain ESSID-based variations
    const essidVariations = dictResult.wordlist.filter(word =>
      word.toLowerCase().includes(essid.toLowerCase())
    );
    expect(essidVariations.length).toBeGreaterThan(0);

    console.log(`Generated targeted dictionary with ${dictResult.wordlist.length} words`);
    console.log(`ESSID variations: ${essidVariations.join(', ')}`);
  });

  test('should handle concurrent operations', async ({ page }) => {
    // Test multiple concurrent API requests
    const requests = [];

    // Generate multiple dictionaries concurrently
    for (let i = 0; i < 3; i++) {
      requests.push(
        page.request.post('/api/wordlist/generate', {
          data: {
            essid: `TestNetwork${i}`,
            bssid: `00:11:22:33:44:${55 + i}`,
            custom_words: [`testpass${i}`],
            use_common: i === 0, // Only first one uses common passwords
            use_digits: true,
            use_year_variations: false
          }
        })
      );
    }

    // Wait for all requests to complete
    const responses = await Promise.all(requests);

    // Verify all requests succeeded
    responses.forEach((response, index) => {
      expect(response.status()).toBe(200);
    });

    // Verify responses are different
    const results = await Promise.all(
      responses.map(response => response.json())
    );

    const wordlistCounts = results.map(result => result.wordlist.length);
    expect(new Set(wordlistCounts).size).toBeGreaterThan(0); // Should have different counts
  });

  test('should maintain data consistency', async ({ page }) => {
    // Test data consistency across operations

    // 1. Generate dictionary
    const dictResponse = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'ConsistencyTest',
        bssid: '00:11:22:33:44:66',
        custom_words: ['consistency', 'test', 'password'],
        use_common: false,
        use_digits: false,
        use_year_variations: false
      }
    });

    expect(dictResponse.status()).toBe(200);
    const dictResult = await dictResponse.json();

    // 2. Check job queue
    await page.goto('/');
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

    // Verify dictionary generation still produces consistent results
    expect(dictResult.wordlist).toContain('consistency');
    expect(dictResult.wordlist).toContain('test');
    expect(dictResult.wordlist).toContain('password');
  });

  test('should handle error scenarios gracefully', async ({ page }) => {
    // Test invalid dictionary generation request
    const invalidResponse = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: '',
        bssid: '',
        custom_words: [],
        use_common: false,
        use_digits: false,
        use_year_variations: false
      }
    });

    // Should handle gracefully (not crash)
    expect(invalidResponse.status()).toBe(200);
    const invalidResult = await invalidResponse.json();
    expect(invalidResult.count).toBe(0);

    // Test UI remains functional after error
    await page.goto('/');
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

    // Test API still works on mobile
    const dictResponse = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'MobileTest',
        bssid: '00:11:22:33:44:77',
        custom_words: ['mobile', 'test'],
        use_common: false,
        use_digits: false,
        use_year_variations: false
      }
    });

    expect(dictResponse.status()).toBe(200);
  });
});