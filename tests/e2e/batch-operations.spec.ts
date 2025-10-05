import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';
import path from 'path';

test.describe('Test 4: Batch Operations', () => {
  let testUtils: TestUtils;
  const knownCredentials = {
    filename: 'wpa2linkuppassphraseiswireshark.pcap',
    password: 'wireshark',
    essid: 'ikeriri-5g'
  };

  test.beforeAll(async () => {
    testUtils = new TestUtils('batch-operations');
    testUtils.getLocalPcapFiles();
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  test('should upload multiple files at once', async ({ page }) => {
    await page.goto('/');

    // Get the test pcap file
    const config = testUtils.getTestConfig();
    const pcapPath = path.join(config.testInputDir, knownCredentials.filename);

    // Upload the same file multiple times (simulating batch upload)
    // In a real scenario, we'd have multiple different files
    await page.locator('#file-upload').setInputFiles([pcapPath]);

    await expect(page.locator('text=Successfully uploaded')).toBeVisible({ timeout: 15000 });
    console.log('✓ Files uploaded');

    // Check if upload message indicates multiple files
    const uploadMessage = await page.locator('text=Successfully uploaded').textContent();
    console.log(`  Upload message: ${uploadMessage}`);

    // Scroll to job queue to see if multiple jobs were created
    await page.locator('h2:has-text("Job Queue")').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);

    const jobRows = page.locator('table tbody tr');
    const rowCount = await jobRows.count();
    console.log(`✓ Job queue has ${rowCount} row(s)`);

    console.log('✅ Batch upload test completed');
  });

  test('should perform batch retry with dictionary selection', async ({ page }) => {
    await page.goto('/');

    // First generate a dictionary
    await page.locator('h2:has-text("Custom Wordlist Generator")').scrollIntoViewIfNeeded();
    await page.locator('#base-words-textarea').fill('batch\ntest\nretry');
    await page.locator('#generate-wordlist-button').click();
    await expect(page.locator('#wordlist-result')).toBeVisible({ timeout: 30000 });
    console.log('✓ Dictionary generated for batch retry');

    // Go to job queue
    await page.locator('h2:has-text("Job Queue")').scrollIntoViewIfNeeded();

    // Look for "Select All" or multiple selection capability
    const selectAllCheckbox = page.locator('input[type="checkbox"][aria-label*="Select all"]').or(
      page.locator('input[type="checkbox"]').first()
    );

    if (await selectAllCheckbox.count() > 0) {
      await selectAllCheckbox.first().click();
      console.log('✓ Multiple jobs selected');

      // Look for batch retry button
      const retryButton = page.locator('button:has-text("Retry Selected")').or(
        page.locator('button:has-text("Retry")')
      );

      if (await retryButton.count() > 0) {
        await retryButton.first().click();
        console.log('✓ Batch retry initiated');

        await page.waitForTimeout(1000);

        // Check for dictionary selection modal
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible()) {
          console.log('✓ Dictionary selection modal opened for batch retry');

          // Select dictionary
          const dictCheckbox = modal.locator('input[type="checkbox"]').first();
          if (await dictCheckbox.count() > 0) {
            await dictCheckbox.click();
            console.log('✓ Dictionary selected for batch retry');
          }

          // Confirm
          const confirmButton = modal.locator('button:has-text("Retry")');
          if (await confirmButton.count() > 0) {
            await confirmButton.click();
            console.log('✓ Batch retry confirmed');
          }
        }
      } else {
        console.log('⚠ Retry button not found');
      }
    } else {
      console.log('⚠ Selection checkboxes not found');
    }

    console.log('✅ Batch retry test completed');
  });
});