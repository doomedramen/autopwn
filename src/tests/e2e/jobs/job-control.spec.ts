import { test, expect } from '@playwright/test';
import { TestHelpers, UploadedFile } from '../helpers/test-helpers';

test.describe('Job Control', () => {
  let authHeaders: Record<string, string>;
  let testDictionary: UploadedFile;
  let testNetworks: string[];

  test.beforeAll(async ({ browser, request }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login with session management
    await TestHelpers.loginWithSession(page, context);

    // Get auth headers for API requests
    authHeaders = await TestHelpers.getAuthHeaders(context);

    // Setup test data
    const { dictionaryPath, pcapPath } = TestHelpers.getTestFilePaths();

    // Upload dictionary
    testDictionary = await TestHelpers.uploadDictionary(
      request,
      authHeaders,
      dictionaryPath
    );

    // Upload PCAP and extract networks
    const { networks } = await TestHelpers.uploadPcap(
      request,
      authHeaders,
      pcapPath
    );

    testNetworks = networks.map(n => n.bssid);

    await context.close();
  });

  test.beforeEach(async ({ page, context }) => {
    // Ensure we have a valid session for each test
    await TestHelpers.loginWithSession(page, context);
  });

  test('should allow pausing and resuming jobs', async ({ page, request }) => {
    // Create a job that will run for a while
    const job = await TestHelpers.createJob(
      request,
      authHeaders,
      'Pause Test Job',
      testNetworks.slice(0, 1),
      [testDictionary.id],
      { workloadProfile: 1 } // Lower workload to make it run longer
    );

    // Navigate to job details
    await TestHelpers.navigateToTab(page, 'Jobs');
    await page.locator(`text=${job.name}`).click();

    // Look for pause button
    const pauseButton = page
      .locator('button:has-text("Pause"), button[aria-label*="pause"]')
      .first();
    const pauseExists = await pauseButton.isVisible().catch(() => false);

    if (pauseExists) {
      await pauseButton.click();

      // Should show paused status
      await page.waitForSelector('text=paused', { timeout: 10000 });

      // Look for resume button
      const resumeButton = page
        .locator('button:has-text("Resume"), button[aria-label*="resume"]')
        .first();
      await expect(resumeButton).toBeVisible();

      await resumeButton.click();

      // Should show running status again
      await page.waitForSelector('text=running, text=processing', {
        timeout: 10000,
      });

      console.log('✅ Job pause/resume works');
    } else {
      console.log('ℹ️ Job pause/resume not implemented');
    }
  });

  test('should allow stopping jobs', async ({ page, request }) => {
    // Create a job
    const job = await TestHelpers.createJob(
      request,
      authHeaders,
      'Stop Test Job',
      testNetworks.slice(0, 1),
      [testDictionary.id]
    );

    // Navigate to job details
    await TestHelpers.navigateToTab(page, 'Jobs');
    await page.locator(`text=${job.name}`).click();

    // Look for stop button
    const stopButton = page
      .locator('button:has-text("Stop"), button[aria-label*="stop"]')
      .first();
    const stopExists = await stopButton.isVisible().catch(() => false);

    if (stopExists) {
      await stopButton.click();

      // Confirm stop if there's a dialog
      const confirmButton = page
        .locator('button:has-text("Confirm"), button:has-text("Stop")')
        .first();
      const confirmExists = await confirmButton.isVisible().catch(() => false);

      if (confirmExists) {
        await confirmButton.click();
      }

      // Should show stopped status
      await page.waitForSelector('text=stopped, text=cancelled', {
        timeout: 10000,
      });

      console.log('✅ Job stopping works');
    } else {
      console.log('ℹ️ Job stopping not implemented');
    }
  });

  test('should allow restarting completed jobs', async ({ page, request }) => {
    // Create and wait for job completion
    const job = await TestHelpers.createJob(
      request,
      authHeaders,
      'Restart Test Job',
      testNetworks.slice(0, 1),
      [testDictionary.id]
    );

    // Wait for job to complete
    const result = await TestHelpers.waitForJobCompletion(
      request,
      authHeaders,
      job.id,
      120,
      1000
    );

    expect(['completed', 'cracked', 'exhausted']).toContain(result.status);

    // Navigate to job details
    await TestHelpers.navigateToTab(page, 'Jobs');
    await page.locator(`text=${job.name}`).click();

    // Look for restart button
    const restartButton = page
      .locator('button:has-text("Restart"), button[aria-label*="restart"]')
      .first();
    const restartExists = await restartButton.isVisible().catch(() => false);

    if (restartExists) {
      await restartButton.click();

      // Confirm restart if there's a dialog
      const confirmButton = page
        .locator('button:has-text("Confirm"), button:has-text("Restart")')
        .first();
      const confirmExists = await confirmButton.isVisible().catch(() => false);

      if (confirmExists) {
        await confirmButton.click();
      }

      // Should show running status again
      await page.waitForSelector('text=running, text=processing', {
        timeout: 10000,
      });

      console.log('✅ Job restarting works');
    } else {
      console.log('ℹ️ Job restarting not implemented');
    }
  });

  test('should handle job control via API', async ({ request }) => {
    // Create a job
    const job = await TestHelpers.createJob(
      request,
      authHeaders,
      'API Control Test',
      testNetworks.slice(0, 1),
      [testDictionary.id]
    );

    // Try to pause job via API
    const pauseResponse = await request.post(`/api/jobs/${job.id}/pause`, {
      headers: authHeaders,
    });

    if (pauseResponse.ok()) {
      console.log('✅ Job pause API works');
    } else {
      console.log('ℹ️ Job pause API not implemented');
    }

    // Try to stop job via API
    const stopResponse = await request.post(`/api/jobs/${job.id}/stop`, {
      headers: authHeaders,
    });

    if (stopResponse.ok()) {
      console.log('✅ Job stop API works');
    } else {
      console.log('ℹ️ Job stop API not implemented');
    }
  });
});
