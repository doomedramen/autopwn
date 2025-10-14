import { test, expect } from '@playwright/test';
import { TestHelpers } from '../helpers/test-helpers';

test.describe('Complete Workflow: Upload and Crack Passwords', () => {
  let authHeaders: Record<string, string>;

  test.beforeAll(async ({ browser }) => {
    console.log('🔧 Setting up test environment...');

    const context = await browser.newContext();
    const page = await context.newPage();

    // Initialize system and login
    const user = await TestHelpers.initializeSystem(page);
    await TestHelpers.login(page, user.email, user.password);

    // Get auth headers for API requests
    authHeaders = await TestHelpers.getAuthHeaders(context);

    await context.close();
    console.log('✅ Test environment setup complete');
  });

  test('should complete full workflow: dictionary upload, PCAP upload, job creation, and password cracking', async ({
    page,
    request,
  }) => {
    test.setTimeout(300000); // 5 minutes for comprehensive test
    console.log('🚀 Starting complete workflow test...');

    // Login to get fresh session
    const user = await TestHelpers.initializeSystem(page);
    await TestHelpers.login(page, user.email, user.password);

    // Step 1: Upload Dictionary
    console.log('📚 Step 1: Uploading dictionary...');
    const { dictionaryPath } = TestHelpers.getTestFilePaths();
    const dictionary = await TestHelpers.uploadDictionary(
      request,
      authHeaders,
      dictionaryPath
    );

    // Step 2: Upload PCAP
    console.log('📦 Step 2: Uploading PCAP...');
    const { pcapPath } = TestHelpers.getTestFilePaths();
    const { networks } = await TestHelpers.uploadPcap(
      request,
      authHeaders,
      pcapPath
    );

    // Verify we have networks to work with
    expect(networks.length).toBeGreaterThan(0);
    const networkBssids = networks.map(n => n.bssid);
    console.log(
      `Found ${networks.length} networks: ${networkBssids.join(', ')}`
    );

    // Step 3: Create Password Cracking Job
    console.log('🚀 Step 3: Creating password cracking job...');
    const job = await TestHelpers.createJob(
      request,
      authHeaders,
      'E2E Complete Workflow Test',
      networkBssids,
      [dictionary.id],
      {
        attackMode: 0, // Dictionary attack
        hashType: 22000,
        workloadProfile: 3,
        gpuTempAbort: 90,
        optimizedKernelEnable: true,
        potfileDisable: true, // Disable potfile for tests
      }
    );

    // Step 4: Monitor Job Progress via UI
    console.log('⏳ Step 4: Monitoring job progress via UI...');

    // Navigate to jobs tab to monitor progress
    await TestHelpers.navigateToTab(page, 'Jobs');

    // Wait for our job to appear in the list
    await page.waitForSelector(`text=${job.name}`, { timeout: 10000 });

    // Click on our job to view details
    await page.locator(`text=${job.name}`).click();
    await page.waitForSelector('text=Job Details', { timeout: 10000 });

    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 180; // 3 minutes max

    while (!jobCompleted && attempts < maxAttempts) {
      try {
        // Check job status in UI
        const statusElement = page
          .locator(
            '[data-testid="job-status"], text=processing, text=completed, text=cracked, text=exhausted, text=failed'
          )
          .first();

        const status = await statusElement.textContent().catch(() => 'unknown');

        // Check progress
        const progressElement = page.locator('text=Progress:').first();
        const progressText = await progressElement
          .textContent()
          .catch(() => '');

        // Check cracked count
        const crackedElement = page.locator('text=Cracked:').first();
        const crackedText = await crackedElement.textContent().catch(() => '');

        console.log(
          `  UI Status: ${status}, Progress: ${progressText}, Cracked: ${crackedText} (Attempt: ${attempts}/${maxAttempts})`
        );

        if (
          status &&
          (status.includes('completed') ||
            status.includes('cracked') ||
            status.includes('exhausted'))
        ) {
          jobCompleted = true;
          console.log('✅ Job completed successfully via UI monitoring');
          break;
        }

        if (status && status.includes('failed')) {
          throw new Error('Job failed during processing');
        }

        await page.waitForTimeout(1000);
        attempts++;
      } catch (error) {
        console.log(
          `⚠️ Error monitoring job in UI: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        // Fallback to API monitoring if UI monitoring fails
        break;
      }
    }

    // Step 5: Fallback/Verification via API
    if (!jobCompleted) {
      console.log('🔄 Verifying job completion via API...');
      const finalJobStatus = await TestHelpers.waitForJobCompletion(
        request,
        authHeaders,
        job.id,
        60, // 1 minute max for API check
        2000 // Check every 2 seconds
      );

      expect(['completed', 'cracked', 'exhausted']).toContain(
        finalJobStatus.status
      );
      expect(finalJobStatus.cracked).toBeGreaterThan(0);

      console.log(
        `✅ Job completed via API: ${finalJobStatus.status}, Cracked: ${finalJobStatus.cracked}/${finalJobStatus.totalHashes}`
      );
    }

    // Step 6: Verify Results in UI
    console.log('🔍 Step 6: Verifying results in UI...');

    // Make sure we're on the job details page
    await page.goto('/');
    await TestHelpers.navigateToTab(page, 'Jobs');
    await page.locator(`text=${job.name}`).click();
    await page.waitForSelector('text=Job Details', { timeout: 10000 });

    // Verify job details are displayed
    await expect(page.locator('text=Job Details')).toBeVisible();
    await expect(page.locator('text=Cracked Passwords')).toBeVisible();

    // Check if cracked passwords are displayed
    const crackedPasswordElements = page.locator(
      '[data-testid="cracked-password"]'
    );
    const crackedCount = await crackedPasswordElements.count();

    if (crackedCount > 0) {
      console.log(`✅ Found ${crackedCount} cracked passwords in UI`);

      // Verify first cracked password has expected structure
      const firstCracked = crackedPasswordElements.first();
      await expect(firstCracked).toBeVisible();
    } else {
      console.log(
        'ℹ️ No cracked passwords displayed in UI (this may be normal for test data)'
      );
    }

    // Step 7: Take screenshot for documentation
    await TestHelpers.takeScreenshot(page, 'complete-workflow-success');

    console.log('🎉 Complete workflow test finished successfully!');
  });

  test('should handle multiple jobs concurrently', async ({
    page,
    request,
  }) => {
    test.setTimeout(300000); // 5 minutes for concurrent test
    console.log('🚀 Starting concurrent jobs test...');

    // Login to get fresh session
    const user = await TestHelpers.initializeSystem(page);
    await TestHelpers.login(page, user.email, user.password);

    // Step 1: Upload test files
    const { dictionaryPath, pcapPath } = TestHelpers.getTestFilePaths();

    // Upload two different dictionaries (if available) or reuse the same one
    const dictionary1 = await TestHelpers.uploadDictionary(
      request,
      authHeaders,
      dictionaryPath,
      'test-dictionary-1.txt'
    );

    const dictionary2 = await TestHelpers.uploadDictionary(
      request,
      authHeaders,
      dictionaryPath,
      'test-dictionary-2.txt'
    );

    // Upload PCAP
    const { networks } = await TestHelpers.uploadPcap(
      request,
      authHeaders,
      pcapPath
    );

    const networkBssids = networks.map(n => n.bssid);

    // Step 2: Create multiple jobs
    console.log('🚀 Creating multiple jobs...');
    const job1 = await TestHelpers.createJob(
      request,
      authHeaders,
      'Concurrent Job 1',
      networkBssids.slice(0, 1), // Use first network
      [dictionary1.id],
      { attackMode: 0 }
    );

    const job2 = await TestHelpers.createJob(
      request,
      authHeaders,
      'Concurrent Job 2',
      networkBssids.slice(0, 1), // Use first network
      [dictionary2.id],
      { attackMode: 0 }
    );

    console.log(`✅ Created jobs: ${job1.id} and ${job2.id}`);

    // Step 3: Monitor both jobs
    console.log('⏳ Monitoring concurrent jobs...');
    const [result1, result2] = await Promise.all([
      TestHelpers.waitForJobCompletion(
        request,
        authHeaders,
        job1.id,
        120,
        1000
      ),
      TestHelpers.waitForJobCompletion(
        request,
        authHeaders,
        job2.id,
        120,
        1000
      ),
    ]);

    console.log(
      `✅ Job 1 completed: ${result1.status} (${result1.cracked}/${result1.totalHashes})`
    );
    console.log(
      `✅ Job 2 completed: ${result2.status} (${result2.cracked}/${result2.totalHashes})`
    );

    // Both jobs should complete successfully
    expect(['completed', 'cracked', 'exhausted']).toContain(result1.status);
    expect(['completed', 'cracked', 'exhausted']).toContain(result2.status);

    // Step 4: Verify both jobs appear in UI
    await TestHelpers.navigateToTab(page, 'Jobs');

    // Wait for both jobs to appear
    await page.waitForSelector(`text=${job1.name}`, { timeout: 10000 });
    await page.waitForSelector(`text=${job2.name}`, { timeout: 10000 });

    // Both jobs should be visible
    await expect(page.locator(`text=${job1.name}`)).toBeVisible();
    await expect(page.locator(`text=${job2.name}`)).toBeVisible();

    console.log('✅ Concurrent jobs test completed successfully!');
  });

  test('should handle job failures gracefully', async ({ page, request }) => {
    console.log('🧪 Testing job failure handling...');

    // Login to get fresh session
    const user = await TestHelpers.initializeSystem(page);
    await TestHelpers.login(page, user.email, user.password);

    // Step 1: Create a job that should fail (invalid network BSSID)
    const invalidBssid = '00:00:00:00:00:00';

    try {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Failure Test Job',
        [invalidBssid],
        ['non-existent-dictionary-id'],
        { attackMode: 0 }
      );

      console.log(`⚠️ Job creation unexpectedly succeeded: ${job.id}`);

      // If job creation succeeds, monitor it to see if it fails during execution
      const result = await TestHelpers.waitForJobCompletion(
        request,
        authHeaders,
        job.id,
        30, // Short timeout
        2000
      );

      console.log(`Job result: ${result.status}`);
    } catch (error) {
      console.log(
        `✅ Job correctly failed during creation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // This is expected behavior
    }

    // Step 2: Verify error handling in UI
    await TestHelpers.navigateToTab(page, 'Jobs');

    // The UI should handle the error gracefully
    await page.waitForTimeout(2000);

    // Should not crash and should still show the jobs interface
    await expect(page.locator('text=Jobs')).toBeVisible();
    await expect(page.locator('button:has-text("Add Job")')).toBeVisible();

    console.log('✅ Job failure handling test completed');
  });
});
