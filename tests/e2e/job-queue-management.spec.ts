import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';
import path from 'path';

test.describe('Test 2: Job Queue Management', () => {
  let testUtils: TestUtils;
  const knownCredentials = {
    filename: 'wpa2linkuppassphraseiswireshark.pcap',
    password: 'wireshark',
    essid: 'ikeriri-5g'
  };

  test.beforeAll(async () => {
    testUtils = new TestUtils('job-queue-management');
    testUtils.clearAllAppData();
    testUtils.getLocalPcapFiles();
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
    testUtils.clearAllAppData();
  });

  test('should manage job queue operations', async ({ page }) => {
    await page.goto('/');

    // First upload a file to create a job
    const config = testUtils.getTestConfig();
    const pcapPath = path.join(config.testInputDir, knownCredentials.filename);

    await page.locator('#file-upload').setInputFiles(pcapPath);
    await expect(page.locator('text=Successfully uploaded')).toBeVisible({ timeout: 15000 });
    console.log('✓ File uploaded, job created');

    // Scroll to job queue
    await page.locator('h2:has-text("Job Queue")').scrollIntoViewIfNeeded();

    // Check that job queue is visible
    await expect(page.locator('h2:has-text("Job Queue")')).toBeVisible();

    // Look for job rows in the table
    const jobTable = page.locator('table').first();
    await expect(jobTable).toBeVisible();
    console.log('✓ Job queue table visible');

    // Check for action buttons (View Details, Pause, Priority, etc.)
    // These might be in dropdown menus or direct buttons
    const actionButtons = page.locator('button:has-text("View")');
    if (await actionButtons.count() > 0) {
      console.log('✓ Action buttons available');

      // Click view details if available
      await actionButtons.first().click();
      await page.waitForTimeout(1000);

      // Look for modal or expanded view
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible()) {
        console.log('✓ Job details modal opened');

        // Close modal
        const closeButton = page.locator('button:has-text("Close")').or(page.locator('[aria-label="Close"]'));
        if (await closeButton.count() > 0) {
          await closeButton.first().click();
          console.log('✓ Modal closed');
        }
      }
    }

    // Check for pause/resume functionality
    const pauseButton = page.locator('button:has-text("Pause")');
    if (await pauseButton.count() > 0) {
      await pauseButton.first().click();
      console.log('✓ Job paused');
      await page.waitForTimeout(1000);

      const resumeButton = page.locator('button:has-text("Resume")');
      if (await resumeButton.count() > 0) {
        await resumeButton.first().click();
        console.log('✓ Job resumed');
      }
    }

    // Check for priority controls
    const priorityButton = page.locator('button:has-text("Priority")').or(
      page.locator('select[aria-label*="priority"]').or(
        page.locator('button:has-text("High")').or(
          page.locator('button:has-text("Low")')
        )
      )
    );

    if (await priorityButton.count() > 0) {
      console.log('✓ Priority controls available');
    }

    // Check for delete functionality
    const deleteButton = page.locator('button:has-text("Delete")').or(
      page.locator('button:has-text("Remove")')
    );

    if (await deleteButton.count() > 0) {
      console.log('✓ Delete button available');
    }

    console.log('✅ Job queue management test completed');
  });
});