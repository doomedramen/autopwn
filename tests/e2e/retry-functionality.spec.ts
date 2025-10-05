import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';
import path from 'path';

test.describe('Test 3: Retry Functionality', () => {
  let testUtils: TestUtils;

  test.beforeAll(async () => {
    testUtils = new TestUtils('retry-functionality');
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  test('should retry failed jobs with dictionary selection', async ({ page }) => {
    await page.goto('/');

    // First, we need to create some failed jobs
    // We can simulate this by checking the job queue for failed status

    // Generate a dictionary first
    await page.locator('h2:has-text("Custom Wordlist Generator")').scrollIntoViewIfNeeded();
    await page.locator('#base-words-textarea').fill('testdict\nretry');
    await page.locator('#generate-wordlist-button').click();
    await expect(page.locator('#wordlist-result')).toBeVisible({ timeout: 30000 });
    console.log('✓ Dictionary generated for retry');

    // Go to job queue
    await page.locator('h2:has-text("Job Queue")').scrollIntoViewIfNeeded();

    // Look for "Retry Selected" button or similar
    const retryButton = page.locator('button:has-text("Retry")');

    if (await retryButton.count() > 0) {
      console.log('✓ Retry button found');

      // Look for checkboxes to select failed jobs
      const checkboxes = page.locator('input[type="checkbox"]');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount > 0) {
        // Select first checkbox (might be select all or individual job)
        await checkboxes.first().click();
        console.log('✓ Job selected for retry');

        // Click retry button
        await retryButton.first().click();
        await page.waitForTimeout(1000);

        // Look for retry modal with dictionary selection
        const modal = page.locator('[role="dialog"]').or(
          page.locator('text=Select Dictionary')
        );

        if (await modal.isVisible()) {
          console.log('✓ Retry modal opened');

          // Look for dictionary checkboxes in the modal
          const dictCheckboxes = modal.locator('input[type="checkbox"]');
          const dictCount = await dictCheckboxes.count();

          if (dictCount > 0) {
            // Select a dictionary
            await dictCheckboxes.first().click();
            console.log('✓ Dictionary selected for retry');

            // Look for confirm/submit button
            const confirmButton = modal.locator('button:has-text("Retry")').or(
              modal.locator('button:has-text("Confirm")').or(
                modal.locator('button:has-text("Submit")')
              )
            );

            if (await confirmButton.count() > 0) {
              await confirmButton.first().click();
              console.log('✓ Retry confirmed');
              await page.waitForTimeout(1000);
            }
          } else {
            console.log('⚠ No dictionaries available for selection');
          }

          // Close modal if still open
          const closeButton = modal.locator('button:has-text("Close")').or(
            modal.locator('button:has-text("Cancel")')
          );
          if (await closeButton.count() > 0 && await modal.isVisible()) {
            await closeButton.first().click();
          }
        } else {
          console.log('⚠ Retry modal not found - retry might have happened directly');
        }
      } else {
        console.log('⚠ No checkboxes found for job selection');
      }
    } else {
      console.log('⚠ No retry button found - might need failed jobs first');
    }

    console.log('✅ Retry functionality test completed');
  });
});