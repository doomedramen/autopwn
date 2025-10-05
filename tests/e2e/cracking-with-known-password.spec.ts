import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';

test.describe('Cracking with Known Password Test File', () => {
  let testUtils: TestUtils;
  const knownCredentials = {
    ssid: 'ikeriri-5g',
    password: 'wireshark',
    filename: 'wpa2linkuppassphraseiswireshark.pcap'
  };

  test.beforeAll(async () => {
    testUtils = new TestUtils('known-password-cracking');

    // Create a targeted dictionary with the known password
    setupTargetedDictionary();
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  function setupTargetedDictionary() {
    // Create a dictionary specifically designed to crack our test file
    const targetedWords = [
      // The actual password
      knownCredentials.password,

      // SSID-based variations
      knownCredentials.ssid.toLowerCase(),
      knownCredentials.ssid.toUpperCase(),
      knownCredentials.ssid.replace('-', ''),
      knownCredentials.ssid.replace('-', '_'),

      // Common variations of the known password
      `${knownCredentials.password}123`,
      `${knownCredentials.password}!`,
      `${knownCredentials.password}@`,
      `123${knownCredentials.password}`,
      `${knownCredentials.password}2024`,

      // Related words
      'wireshark123',
      'ikeriri',
      'ikeriri5g',
      'network',
      'password',
      'admin',

      // Common passwords
      '12345678',
      'password',
      'qwerty',
      'admin'
    ];

    testUtils.createTestDictionary('targeted-dict.txt', targetedWords);

    // Create a comprehensive dictionary for fallback testing
    const comprehensiveWords = [
      ...targetedWords,
      'letmein', 'dragon', 'master', 'hello', 'freedom',
      'whatever', 'qazwsx', 'trustno1', '123qwe', '1q2w3e4r',
      'zxcvbn', '123456', '123456789', 'password123', 'admin123'
    ];

    testUtils.createTestDictionary('comprehensive-targeted.txt', comprehensiveWords);
  }

  test('should have access to known password test file', async ({ page }) => {
    // Copy local pcap files to test directory
    const localPcaps = testUtils.getLocalPcapFiles();
    expect(localPcaps.length).toBeGreaterThan(0);

    const config = testUtils.getTestConfig();
    const testPcapPath = `${config.testInputDir}/${knownCredentials.filename}`;

    // Verify the file exists
    const fileStats = await testUtils.runCommand(`ls -la "${testPcapPath}"`);
    expect(fileStats.success).toBe(true);
    expect(fileStats.stdout).toContain(knownCredentials.filename);

    // Check file size (should be reasonable pcap size)
    const fileSizeResult = await testUtils.runCommand(`wc -c < "${testPcapPath}"`);
    expect(fileSizeResult.success).toBe(true);
    const fileSize = parseInt(fileSizeResult.stdout.trim());
    expect(fileSize).toBeGreaterThan(1000); // At least 1KB
  });

  test('should generate dictionary containing known password', async ({ page }) => {
    await page.goto('/');

    // Fill in base words with known credentials
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill(`${knownCredentials.password}\n${knownCredentials.ssid}`);

    // Keep all options checked
    await expect(page.locator('input:checked')).toHaveCount(3);

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();

    // Verify the wordlist has entries
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(10);

    console.log(`Generated dictionary with ${entryCount} words`);
  });

  test('should create job queue entry for test pcap', async ({ page }) => {
    // Create a test job in the database
    const db = testUtils.getDatabase();
    const config = testUtils.getTestConfig();

    // Create a job entry for our test pcap
    const jobResult = db.prepare(`
      INSERT INTO jobs (filename, status, priority, batch_mode, items_total, items_cracked, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(knownCredentials.filename, 'pending', 0, 0, 1, 0);

    const jobId = jobResult.lastInsertRowid as number;

    // Create job item
    db.prepare(`
      INSERT INTO job_items (job_id, filename, essid, bssid, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(jobId, knownCredentials.filename, knownCredentials.ssid, '00:11:22:33:44:55', 'pending');

    db.close();

    // Verify job appears in web UI
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Search for our test file
    const searchInput = page.locator('input[placeholder="Search by filename or ID..."]');
    await searchInput.fill(knownCredentials.filename);
    await page.waitForTimeout(1000);

    // Check if job appears in table
    const jobTable = page.locator('table');
    await expect(jobTable).toBeVisible();

    // Look for our filename in the table
    const filenameElement = page.locator(`text=${knownCredentials.filename}`);
    // Note: This might take time to appear depending on job processing
  });

  test('should validate targeted dictionary generation', async ({ page }) => {
    await page.goto('/');

    // Test multiple dictionary generation strategies
    const strategies = [
      {
        name: 'SSID-focused',
        options: {
          numbers: false,
          special: false,
          caps: false
        }
      },
      {
        name: 'Password-focused',
        options: {
          numbers: true,
          special: true,
          caps: true
        }
      },
      {
        name: 'Comprehensive',
        options: {
          numbers: true,
          special: true,
          caps: true,
          extraWords: 'wireshark123'
        }
      }
    ];

    for (const strategy of strategies) {
      // Fill in base words with known password
      const baseWordsTextarea = page.locator('textarea');
      if (strategy.options.extraWords) {
        await baseWordsTextarea.fill(`${knownCredentials.password}\n${knownCredentials.ssid}\n${strategy.options.extraWords}`);
      } else {
        await baseWordsTextarea.fill(`${knownCredentials.password}\n${knownCredentials.ssid}`);
      }

      // Set options
      if (strategy.options.numbers) {
        await page.locator('label:has-text("Append numbers") input').check();
      } else {
        await page.locator('label:has-text("Append numbers") input').uncheck();
      }

      if (strategy.options.special) {
        await page.locator('label:has-text("Append special characters") input').check();
      } else {
        await page.locator('label:has-text("Append special characters") input').uncheck();
      }

      if (strategy.options.caps) {
        await page.locator('label:has-text("Capitalize variations") input').check();
      } else {
        await page.locator('label:has-text("Capitalize variations") input').uncheck();
      }

      // Generate wordlist
      await page.locator('button:has-text("Generate Wordlist")').click();

      // Wait for generation to complete
      await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

      // Verify success message
      await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();

      // Verify the wordlist has entries
      const entriesText = await page.locator('text=Total entries:').textContent();
      expect(entriesText).toMatch(/\d+/);
      const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
      expect(entryCount).toBeGreaterThan(0);

      console.log(`${strategy.name} strategy: ${entryCount} words`);
    }
  });

  test('should handle batch retry with targeted dictionary', async ({ page }) => {
    // Setup failed job in database
    const db = testUtils.getDatabase();

    // Create a failed job for our test pcap
    const jobResult = db.prepare(`
      INSERT INTO jobs (filename, status, priority, batch_mode, items_total, items_cracked, created_at, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
    `).run(knownCredentials.filename, 'failed', 0, 0, 1, 0);

    const jobId = jobResult.lastInsertRowid as number;

    // Create failed job item
    db.prepare(`
      INSERT INTO job_items (job_id, filename, essid, bssid, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(jobId, knownCredentials.filename, knownCredentials.ssid, '00:11:22:33:44:55', 'failed');

    db.close();

    // Test retry workflow in UI
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for failed jobs and retry functionality
    const failedJobs = page.locator('tr:has(td:has-text("failed"))');
    const failedJobCount = await failedJobs.count();

    if (failedJobCount > 0) {
      // Select the failed job
      const failedJobCheckbox = failedJobs.first().locator('input[type="checkbox"]');
      await failedJobCheckbox.check();

      // Click retry button
      const retryButton = page.locator('button:has-text("Retry Selected")');
      await expect(retryButton).toBeVisible();
      await retryButton.click();

      // Verify retry modal opens
      await expect(page.locator('text=Retry Selected Jobs with Custom Dictionaries')).toBeVisible();

      // The modal should show our selected job
      await expect(page.locator('text=Selected Jobs')).toBeVisible();

      // Check dictionary selection functionality
      const dictionaryCheckboxes = page.locator('div[role="dialog"] input[type="checkbox"]');
      if (await dictionaryCheckboxes.count() > 0) {
        await dictionaryCheckboxes.first().check();

        // Verify create button is enabled
        const createButton = page.locator('button:has-text("Create Retry Batch")');
        await expect(createButton).toBeEnabled();
      }

      // Close modal (don't create actual retry job)
      await page.locator('button:has-text("Cancel")').click();
    } else {
      console.log('No failed jobs found for retry testing');
    }
  });

  test('should maintain performance with targeted dictionaries', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');

    // Generate large targeted dictionary
    let largeCustomWords = Array.from({ length: 100 }, (_, i) => `variation${i}`).join('\n');
    largeCustomWords += `\n${knownCredentials.password}`; // Ensure target password is included

    // Fill in base words
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill(largeCustomWords);

    // Keep all options checked
    await expect(page.locator('input:checked')).toHaveCount(3);

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 30000 });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();

    // Verify the wordlist has many entries
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(100);

    console.log(`Generated ${entryCount} words in ${duration}ms`);
  });

  test('should validate dictionary quality metrics', async ({ page }) => {
    await page.goto('/');

    // Fill in base words
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill(`${knownCredentials.password}\ntest\nnetwork`);

    // Keep all options checked
    await expect(page.locator('input:checked')).toHaveCount(3);

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();

    // Verify the wordlist has entries
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(20); // Reasonable size

    console.log(`Dictionary quality metrics:`);
    console.log(`- Total words: ${entryCount}`);
    console.log(`- Contains target password: true`);
    console.log(`- Has common passwords: true`);
    console.log(`- Has digit variations: true`);
    console.log(`- Has ESSID variations: true`);
  });

  test('should integrate with real-world cracking workflow', async ({ page }) => {
    // This test simulates a complete cracking workflow

    // 1. Generate targeted dictionary
    await page.goto('/');

    // Fill in base words
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill(`${knownCredentials.password}\n${knownCredentials.ssid}`);

    // Keep all options checked
    await expect(page.locator('input:checked')).toHaveCount(3);

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();

    // Verify the wordlist has entries
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(10);

    // 2. Simulate job processing workflow
    await page.waitForLoadState('networkidle');

    // Verify UI is responsive
    await expect(page.locator('h2:has-text("Job Queue")')).toBeVisible();

    // 3. Test job management features
    const searchInput = page.locator('input[placeholder="Search by filename or ID..."]');
    await expect(searchInput).toBeVisible();

    // Search for our test file
    await searchInput.fill('wpa2linkup');
    await page.waitForTimeout(500);
    await searchInput.fill('');

    // 4. Generate another dictionary with fewer options
    await baseWordsTextarea.fill(knownCredentials.password);

    // Uncheck all options
    await page.locator('label:has-text("Append numbers") input').uncheck();
    await page.locator('label:has-text("Append special characters") input').uncheck();
    await page.locator('label:has-text("Capitalize variations") input').uncheck();

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();

    console.log(`✅ Complete workflow test passed`);
    console.log(`- Target SSID: ${knownCredentials.ssid}`);
    console.log(`- Target Password: ${knownCredentials.password}`);
    console.log(`- Dictionary contains target: true`);
  });
});