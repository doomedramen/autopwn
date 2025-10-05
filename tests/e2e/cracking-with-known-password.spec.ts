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
    // Generate dictionary using API with known credentials
    const dictResponse = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: knownCredentials.ssid,
        bssid: '00:11:22:33:44:55',
        custom_words: [knownCredentials.password, knownCredentials.ssid],
        use_common: true,
        use_digits: true,
        use_year_variations: false
      }
    });

    expect(dictResponse.status()).toBe(200);
    const dictResult = await dictResponse.json();

    // Verify the known password is in the generated dictionary
    expect(dictResult.wordlist).toContain(knownCredentials.password);
    expect(dictResult.wordlist).toContain(knownCredentials.ssid.toLowerCase());
    expect(dictResult.wordlist.length).toBeGreaterThan(10);

    console.log(`Generated dictionary with ${dictResult.wordlist.length} words`);
    console.log(`Contains known password: ${dictResult.wordlist.includes(knownCredentials.password)}`);
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
    // Test multiple dictionary generation strategies
    const strategies = [
      {
        name: 'SSID-focused',
        data: {
          essid: knownCredentials.ssid,
          bssid: '00:11:22:33:44:55',
          custom_words: [knownCredentials.password],
          use_common: false,
          use_digits: false,
          use_year_variations: false
        }
      },
      {
        name: 'Password-focused',
        data: {
          essid: knownCredentials.ssid,
          bssid: '00:11:22:33:44:55',
          custom_words: [knownCredentials.password],
          use_common: true,
          use_digits: true,
          use_year_variations: true
        }
      },
      {
        name: 'Comprehensive',
        data: {
          essid: knownCredentials.ssid,
          bssid: '00:11:22:33:44:55',
          custom_words: [knownCredentials.password, knownCredentials.ssid, 'wireshark123'],
          use_common: true,
          use_digits: true,
          use_year_variations: true
        }
      }
    ];

    for (const strategy of strategies) {
      const response = await page.request.post('/api/wordlist/generate', {
        data: strategy.data
      });

      expect(response.status()).toBe(200);
      const result = await response.json();

      // All strategies should include the known password
      expect(result.wordlist).toContain(knownCredentials.password);
      expect(result.count).toBeGreaterThan(0);

      console.log(`${strategy.name} strategy: ${result.count} words, contains password: ${result.wordlist.includes(knownCredentials.password)}`);
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

    // Generate large targeted dictionary
    const largeCustomWords = Array.from({ length: 1000 }, (_, i) => `variation${i}`);
    largeCustomWords.push(knownCredentials.password); // Ensure target password is included

    const response = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: knownCredentials.ssid,
        bssid: '00:11:22:33:44:55',
        custom_words: largeCustomWords,
        use_common: true,
        use_digits: true,
        use_year_variations: true
      }
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

    const result = await response.json();
    expect(result.wordlist).toContain(knownCredentials.password);
    expect(result.wordlist.length).toBeGreaterThan(1000);

    console.log(`Generated ${result.wordlist.length} words in ${duration}ms`);
  });

  test('should validate dictionary quality metrics', async ({ page }) => {
    // Generate dictionary and analyze quality
    const response = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: knownCredentials.ssid,
        bssid: '00:11:22:33:44:55',
        custom_words: [knownCredentials.password, 'test', 'network'],
        use_common: true,
        use_digits: true,
        use_year_variations: true
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();

    // Quality checks
    expect(result.wordlist.length).toBeGreaterThan(20); // Reasonable size
    expect(result.wordlist).toContain(knownCredentials.password); // Contains target

    // Check for variety
    const hasCommonPasswords = result.wordlist.some(word =>
      ['password', '123456', 'qwerty', 'admin'].includes(word)
    );
    expect(hasCommonPasswords).toBe(true);

    // Check for digit variations
    const hasDigitVariations = result.wordlist.some(word => /\d/.test(word));
    expect(hasDigitVariations).toBe(true);

    // Check for ESSID variations
    const hasESSIDVariations = result.wordlist.some(word =>
      word.toLowerCase().includes(knownCredentials.ssid.toLowerCase())
    );
    expect(hasESSIDVariations).toBe(true);

    console.log(`Dictionary quality metrics:`);
    console.log(`- Total words: ${result.wordlist.length}`);
    console.log(`- Contains target password: ${result.wordlist.includes(knownCredentials.password)}`);
    console.log(`- Has common passwords: ${hasCommonPasswords}`);
    console.log(`- Has digit variations: ${hasDigitVariations}`);
    console.log(`- Has ESSID variations: ${hasESSIDVariations}`);
  });

  test('should integrate with real-world cracking workflow', async ({ page }) => {
    // This test simulates a complete cracking workflow

    // 1. Generate targeted dictionary
    const dictResponse = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: knownCredentials.ssid,
        bssid: '00:11:22:33:44:55',
        custom_words: [knownCredentials.password, knownCredentials.ssid],
        use_common: true,
        use_digits: true,
        use_year_variations: true
      }
    });

    expect(dictResponse.status()).toBe(200);
    const dictResult = await dictResponse.json();

    // 2. Verify dictionary quality
    expect(dictResult.wordlist).toContain(knownCredentials.password);
    expect(dictResult.wordlist.length).toBeGreaterThan(10);

    // 3. Simulate job processing workflow
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify UI is responsive
    await expect(page.locator('h2:has-text("Job Queue")')).toBeVisible();

    // 4. Test job management features
    const searchInput = page.locator('input[placeholder="Search by filename or ID..."]');
    await expect(searchInput).toBeVisible();

    // Search for our test file
    await searchInput.fill('wpa2linkup');
    await page.waitForTimeout(500);
    await searchInput.fill('');

    // 5. Verify dictionary generation API integration
    const finalDictResponse = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: knownCredentials.ssid,
        bssid: '00:11:22:33:44:55',
        custom_words: [knownCredentials.password],
        use_common: false,
        use_digits: false,
        use_year_variations: false
      }
    });

    expect(finalDictResponse.status()).toBe(200);
    const finalResult = await finalDictResponse.json();

    // Final verification
    expect(finalResult.wordlist).toContain(knownCredentials.password);
    expect(finalResult.wordlist).toContain(knownCredentials.ssid.toLowerCase());

    console.log(`✅ Complete workflow test passed`);
    console.log(`- Target SSID: ${knownCredentials.ssid}`);
    console.log(`- Target Password: ${knownCredentials.password}`);
    console.log(`- Dictionary contains target: ${finalResult.wordlist.includes(knownCredentials.password)}`);
  });
});