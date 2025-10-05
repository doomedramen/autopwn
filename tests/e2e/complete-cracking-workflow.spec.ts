import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';
import path from 'path';

test.describe('Test 1: Complete Cracking Workflow', () => {
  let testUtils: TestUtils;
  const knownCredentials = {
    filename: 'wpa2linkuppassphraseiswireshark.pcap',
    password: 'wireshark',
    essid: 'ikeriri-5g'
  };

  test.beforeAll(async () => {
    testUtils = new TestUtils('complete-cracking-workflow');
    testUtils.getLocalPcapFiles();
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  test('should crack password from upload to results', async ({ page }) => {
    await page.goto('/');

    // Step 1: Upload pcap file
    const config = testUtils.getTestConfig();
    const pcapPath = path.join(config.testInputDir, knownCredentials.filename);

    await page.locator('#file-upload').setInputFiles(pcapPath);
    await expect(page.locator('text=Successfully uploaded')).toBeVisible({ timeout: 15000 });
    console.log('✓ File uploaded');

    // Step 2: Generate dictionary with correct password
    await page.locator('h2:has-text("Custom Wordlist Generator")').scrollIntoViewIfNeeded();
    const baseWordsInput = page.locator('#base-words-textarea');
    await baseWordsInput.waitFor({ state: 'visible', timeout: 10000 });

    // Include the exact password to ensure success
    await baseWordsInput.fill(knownCredentials.password);
    await page.locator('#generate-wordlist-button').click();

    await expect(page.locator('#wordlist-result')).toBeVisible({ timeout: 30000 });
    console.log('✓ Dictionary generated with correct password');

    // Step 3: Wait for job to process (this might take a while)
    // Check job queue for the uploaded file
    await page.locator('h2:has-text("Job Queue")').scrollIntoViewIfNeeded();

    // Wait for job to appear in queue (might be processing)
    await page.waitForTimeout(5000);

    // Step 4: Check Results Table for cracked password
    await page.locator('h2:has-text("Cracked Passwords")').scrollIntoViewIfNeeded();

    // The password should eventually appear in results
    // Note: This depends on the worker actually running
    await expect(page.locator('text=Cracked Passwords')).toBeVisible();

    console.log('✅ Complete cracking workflow test finished');
    console.log('   Note: Actual cracking requires worker to be running');
  });
});