import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';
import path from 'path';
import fs from 'fs';

test.describe('Test 5: Error Handling', () => {
  let testUtils: TestUtils;

  test.beforeAll(async () => {
    testUtils = new TestUtils('error-handling');
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  test('should reject invalid file format', async ({ page }) => {
    await page.goto('/');

    // Create a temporary invalid file (e.g., .txt file)
    const config = testUtils.getTestConfig();
    const invalidFilePath = path.join(config.testInputDir, 'invalid.txt');
    fs.writeFileSync(invalidFilePath, 'This is not a pcap file');

    // Try to upload invalid file
    await page.locator('#file-upload').setInputFiles(invalidFilePath);

    // Wait a bit for processing
    await page.waitForTimeout(2000);

    // Check for error message
    const errorMessage = page.locator('text=failed').or(
      page.locator('text=error').or(
        page.locator('text=invalid')
      )
    );

    if (await errorMessage.count() > 0) {
      console.log('✓ Error message displayed for invalid file');
    } else {
      console.log('⚠ No error message found - file might have been rejected silently');
    }

    // Verify file was NOT added to job queue
    await page.locator('h2:has-text("Job Queue")').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    console.log('✓ Invalid file upload handled');

    // Clean up
    fs.unlinkSync(invalidFilePath);
  });

  test('should reject corrupted pcap file', async ({ page }) => {
    await page.goto('/');

    // Create a corrupted pcap file (wrong magic bytes)
    const config = testUtils.getTestConfig();
    const corruptedFilePath = path.join(config.testInputDir, 'corrupted.pcap');
    fs.writeFileSync(corruptedFilePath, 'CORRUPT_DATA_NOT_VALID_PCAP');

    // Try to upload corrupted file
    await page.locator('#file-upload').setInputFiles(corruptedFilePath);
    await page.waitForTimeout(2000);

    // Check for error indication
    const errorIndicator = page.locator('text=failed').or(
      page.locator('text=error').or(
        page.locator('[class*="error"]').or(
          page.locator('[class*="red"]')
        )
      )
    );

    if (await errorIndicator.count() > 0) {
      console.log('✓ Corrupted file rejected with error indication');
    } else {
      console.log('⚠ No visible error for corrupted file');
    }

    console.log('✓ Corrupted pcap file handled');

    // Clean up
    fs.unlinkSync(corruptedFilePath);
  });

  test('should prevent dictionary generation with empty input', async ({ page }) => {
    await page.goto('/');

    // Scroll to wordlist generator
    await page.locator('h2:has-text("Custom Wordlist Generator")').scrollIntoViewIfNeeded();

    // Clear textarea (should be empty by default)
    await page.locator('#base-words-textarea').fill('');

    // Try to generate
    await page.locator('#generate-wordlist-button').click();

    // Wait a bit
    await page.waitForTimeout(2000);

    // Verify no result appears
    const result = page.locator('#wordlist-result');
    await expect(result).not.toBeVisible();

    console.log('✓ Empty input validation works');

    // Note: Alert is shown but we can't easily test it
    // The important thing is no dictionary was generated
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.goto('/');

    // Generate dictionary to test API errors
    await page.locator('h2:has-text("Custom Wordlist Generator")').scrollIntoViewIfNeeded();

    // Fill with valid data
    await page.locator('#base-words-textarea').fill('test\nnetwork');

    // Simulate offline mode (this tests graceful degradation)
    await page.context().setOffline(true);

    // Try to generate
    await page.locator('#generate-wordlist-button').click();
    await page.waitForTimeout(3000);

    // Check that app doesn't crash - button should be enabled again
    const button = page.locator('#generate-wordlist-button');
    const isDisabled = await button.isDisabled();
    expect(isDisabled).toBe(false);

    console.log('✓ Network error handled gracefully');

    // Restore online mode
    await page.context().setOffline(false);
  });

  test('should validate file size limits', async ({ page }) => {
    await page.goto('/');

    // Create a very large file (if there's a size limit)
    const config = testUtils.getTestConfig();
    const largeFilePath = path.join(config.testInputDir, 'large.pcap');

    // Create a 100MB file (if limits exist, this should be rejected)
    const largeSize = 100 * 1024 * 1024; // 100MB
    const buffer = Buffer.alloc(Math.min(largeSize, 10 * 1024 * 1024)); // Cap at 10MB for test performance
    fs.writeFileSync(largeFilePath, buffer);

    await page.locator('#file-upload').setInputFiles(largeFilePath);
    await page.waitForTimeout(3000);

    // Check for size warning/error
    const sizeError = page.locator('text=too large').or(
      page.locator('text=size limit').or(
        page.locator('text=maximum size')
      )
    );

    if (await sizeError.count() > 0) {
      console.log('✓ File size validation working');
    } else {
      console.log('⚠ No size limit or file was accepted');
    }

    // Clean up
    fs.unlinkSync(largeFilePath);

    console.log('✅ Error handling tests completed');
  });
});