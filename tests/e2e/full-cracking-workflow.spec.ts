import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';
import path from 'path';

test.describe('Full Cracking Workflow E2E', () => {
  let testUtils: TestUtils;
  const knownCredentials = {
    filename: 'wpa2linkuppassphraseiswireshark.pcap',
    password: 'wireshark',
    essid: 'ikeriri-5g'
  };

  test.beforeAll(async () => {
    testUtils = new TestUtils('full-cracking-workflow');
    // Copy the pcap file to test directory
    testUtils.getLocalPcapFiles();
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  test('should upload pcap file and generate dictionaries for cracking', async ({ page }) => {
    await page.goto('/');

    // Verify page loaded
    await expect(page.locator('h2:has-text("Upload Captures")')).toBeVisible();

    // Step 1: Upload the pcap file
    const config = testUtils.getTestConfig();
    const pcapPath = path.join(config.testInputDir, knownCredentials.filename);

    const fileInput = page.locator('#file-upload');
    await fileInput.setInputFiles(pcapPath);

    // Wait for upload to complete
    await expect(page.locator('text=Successfully uploaded')).toBeVisible({ timeout: 15000 });
    console.log('✓ File uploaded successfully');

    // Step 2: Generate a dictionary that SHOULD work (contains the correct password)
    // Scroll to the wordlist generator section
    await page.locator('h2:has-text("Custom Wordlist Generator")').scrollIntoViewIfNeeded();

    // Wait for the textarea to be visible
    const baseWordsInput = page.locator('#base-words-textarea');
    await baseWordsInput.waitFor({ state: 'visible', timeout: 10000 });
    await baseWordsInput.fill('wireshark\npassword\nadmin\nwifi');

    // Keep defaults: includeNumbers, includeSpecialChars, includeCaps all checked
    // This should generate variations including the exact password "wireshark"

    await page.locator('#generate-wordlist-button').click();

    // Wait for wordlist generation to complete
    await expect(page.locator('#wordlist-result')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
    console.log('✓ First dictionary generated (should contain password)');

    // Get the filename of the successful dictionary
    const resultText1 = await page.locator('#wordlist-result').textContent();
    const filenameMatch1 = resultText1?.match(/File: (.+\.txt)/);
    const successDictFilename = filenameMatch1 ? filenameMatch1[1] : null;
    expect(successDictFilename).toBeTruthy();
    console.log(`  Dictionary filename: ${successDictFilename}`);

    // Step 3: Generate a dictionary that SHOULD fail (doesn't contain the correct password)
    await page.locator('h2:has-text("Custom Wordlist Generator")').scrollIntoViewIfNeeded();
    await baseWordsInput.fill('wrongpassword\nincorrect\nbadpass');

    await page.locator('#generate-wordlist-button').click();

    // Wait for second wordlist generation to complete
    await expect(page.locator('#wordlist-result')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
    console.log('✓ Second dictionary generated (should NOT contain password)');

    // Get the filename of the failing dictionary
    const resultText2 = await page.locator('#wordlist-result').textContent();
    const filenameMatch2 = resultText2?.match(/File: (.+\.txt)/);
    const failDictFilename = filenameMatch2 ? filenameMatch2[1] : null;
    expect(failDictFilename).toBeTruthy();
    console.log(`  Dictionary filename: ${failDictFilename}`);

    // Verify we generated two different dictionaries
    expect(successDictFilename).not.toBe(failDictFilename);

    console.log('\n✅ Full workflow test completed successfully!');
    console.log(`   - Uploaded: ${knownCredentials.filename}`);
    console.log(`   - Generated success dictionary: ${successDictFilename}`);
    console.log(`   - Generated fail dictionary: ${failDictFilename}`);
  });
});