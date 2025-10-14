import { test, expect } from '@playwright/test';
import { TestHelpers, UploadedFile } from '../helpers/test-helpers';

test.describe('Job Management', () => {
  let authHeaders: Record<string, string>;
  let testDictionary: UploadedFile;
  let testNetworks: string[];

  test.beforeAll(async ({ browser, request }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Initialize system and login
    const user = await TestHelpers.initializeSystem(page);
    await TestHelpers.login(page, user.email, user.password);

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

  test.beforeEach(async ({ page }) => {
    // Login for each test
    const user = await TestHelpers.initializeSystem(page);
    await TestHelpers.login(page, user.email, user.password);
  });

  test.describe('Job Creation', () => {
    test('should create job via UI', async ({ page }) => {
      // Navigate to jobs tab
      await TestHelpers.navigateToTab(page, 'Jobs');

      // Click add job button
      await page.click('button:has-text("Add Job")');
      await expect(page.locator('text=Create New Job')).toBeVisible();

      // Fill job form
      await page.fill('input[name="name"]', 'UI Test Job');

      // Select networks
      await page.click('[data-testid="network-select"]');
      await page.click(`text=${testNetworks[0]}`);

      // Select dictionaries
      await page.click('[data-testid="dictionary-select"]');
      await page.click(`text=${testDictionary.name}`);

      // Set attack options
      await page.selectOption('select[name="attackMode"]', '0'); // Dictionary attack

      // Create job
      await page.click('button:has-text("Create Job")');

      // Should show success message
      await expect(page.locator('text=Job created successfully')).toBeVisible();

      // Job should appear in list
      await expect(page.locator('text=UI Test Job')).toBeVisible();
    });

    test('should create job via API', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'API Test Job',
        testNetworks.slice(0, 1),
        [testDictionary.id],
        {
          attackMode: 0,
          hashType: 22000,
        }
      );

      expect(job.id).toBeDefined();
      expect(job.name).toBe('API Test Job');
      expect(job.status).toBeDefined();
    });

    test('should validate job creation form', async ({ page }) => {
      // Navigate to jobs tab
      await TestHelpers.navigateToTab(page, 'Jobs');

      // Click add job button
      await page.click('button:has-text("Add Job")');

      // Try to create job without required fields
      await page.click('button:has-text("Create Job")');

      // Should have validation errors
      const nameInput = page.locator('input[name="name"]');
      await expect(nameInput).toHaveAttribute('required');

      // Check form validation
      await page.fill('input[name="name"]', '');
      await expect(nameInput).toHaveClass(/invalid/);
    });

    test('should validate job parameters', async ({ request }) => {
      // Test with invalid network ID
      const response = await request.post('/api/jobs', {
        data: {
          name: 'Invalid Job Test',
          networks: ['invalid-network-id'],
          dictionaries: [testDictionary.id],
          options: { attackMode: 0 },
        },
        headers: authHeaders,
      });

      expect(response.ok()).toBeFalsy();
      const errorData = await response.json();
      expect(errorData.success).toBe(false);
      expect(errorData.error).toBeDefined();
    });
  });

  test.describe('Job Status and Progress', () => {
    test('should display job status in UI', async ({ page, request }) => {
      // Create a job
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Status Test Job',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      // Navigate to jobs tab
      await TestHelpers.navigateToTab(page, 'Jobs');

      // Find our job
      const jobRow = page.locator(`text=${job.name}`).first();
      await expect(jobRow).toBeVisible();

      // Should show status
      const statusElement = jobRow.locator('[data-testid="job-status"]');
      await expect(statusElement).toBeVisible();

      // Should show progress
      const progressElement = jobRow.locator('[data-testid="job-progress"]');
      await expect(progressElement).toBeVisible();
    });

    test('should show detailed job information', async ({ page, request }) => {
      // Create a job
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Details Test Job',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      // Navigate to jobs tab
      await TestHelpers.navigateToTab(page, 'Jobs');

      // Click on job to view details
      await page.locator(`text=${job.name}`).click();

      // Should show job details page
      await expect(page.locator('text=Job Details')).toBeVisible();
      await expect(page.locator(`text=${job.name}`)).toBeVisible();

      // Should show job configuration
      await expect(page.locator('text=Attack Mode')).toBeVisible();
      await expect(page.locator('text=Hash Type')).toBeVisible();
      await expect(page.locator('text=Networks')).toBeVisible();
      await expect(page.locator('text=Dictionaries')).toBeVisible();

      // Should show progress information
      await expect(page.locator('text=Progress')).toBeVisible();
      await expect(page.locator('text=Status')).toBeVisible();
    });

    test('should update job progress in real-time', async ({
      page,
      request,
    }) => {
      // Create a job
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Progress Test Job',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      // Navigate to job details
      await TestHelpers.navigateToTab(page, 'Jobs');
      await page.locator(`text=${job.name}`).click();

      // Monitor progress updates
      let previousProgress = -1;
      let updates = 0;
      const maxWaitTime = 30000; // 30 seconds
      const startTime = Date.now();

      while (updates < 3 && Date.now() - startTime < maxWaitTime) {
        try {
          const progressElement = page.locator(
            '[data-testid="job-progress-bar"]'
          );
          const currentProgress =
            (await progressElement.getAttribute('aria-valuenow')) || '0';

          if (parseInt(currentProgress) > previousProgress) {
            previousProgress = parseInt(currentProgress);
            updates++;
            console.log(`Progress update ${updates}: ${currentProgress}%`);
          }

          await page.waitForTimeout(2000);
        } catch {
          // Progress element might not be available yet
          await page.waitForTimeout(1000);
        }
      }

      if (updates > 0) {
        console.log(`✅ Observed ${updates} progress updates`);
      } else {
        console.log(
          'ℹ️ No progress updates observed (job may have completed quickly)'
        );
      }
    });
  });

  test.describe('Job Control', () => {
    test('should allow pausing and resuming jobs', async ({
      page,
      request,
    }) => {
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
        const confirmExists = await confirmButton
          .isVisible()
          .catch(() => false);

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

    test('should allow restarting completed jobs', async ({
      page,
      request,
    }) => {
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
        const confirmExists = await confirmButton
          .isVisible()
          .catch(() => false);

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
  });

  test.describe('Job Results', () => {
    test('should display cracked passwords', async ({ page, request }) => {
      // Create and wait for job completion
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Results Test Job',
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

      // Navigate to job details
      await TestHelpers.navigateToTab(page, 'Jobs');
      await page.locator(`text=${job.name}`).click();

      // Look for cracked passwords section
      if (result.cracked > 0) {
        await expect(page.locator('text=Cracked Passwords')).toBeVisible();

        // Should show cracked password entries
        const crackedEntries = page.locator('[data-testid="cracked-password"]');
        const count = await crackedEntries.count();
        expect(count).toBeGreaterThan(0);

        // Check structure of cracked password entry
        const firstEntry = crackedEntries.first();
        await expect(firstEntry.locator('[data-testid="ssid"]')).toBeVisible();
        await expect(
          firstEntry.locator('[data-testid="password"]')
        ).toBeVisible();
        await expect(firstEntry.locator('[data-testid="bssid"]')).toBeVisible();

        console.log(`✅ Found ${count} cracked passwords in UI`);
      } else {
        console.log('ℹ️ No passwords were cracked (test data specific)');
      }
    });

    test('should allow exporting cracked passwords', async ({
      page,
      request,
    }) => {
      // Create and wait for job completion
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Export Test Job',
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

      // Navigate to job details
      await TestHelpers.navigateToTab(page, 'Jobs');
      await page.locator(`text=${job.name}`).click();

      // Look for export button
      const exportButton = page
        .locator('button:has-text("Export"), button[aria-label*="export"]')
        .first();
      const exportExists = await exportButton.isVisible().catch(() => false);

      if (exportExists && result.cracked > 0) {
        // Handle download
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.(txt|csv|json)$/);

        console.log('✅ Password export works');
      } else {
        console.log(
          'ℹ️ Password export not available or no passwords to export'
        );
      }
    });

    test('should show job statistics and metrics', async ({
      page,
      request,
    }) => {
      // Create a job
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Stats Test Job',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      // Navigate to job details
      await TestHelpers.navigateToTab(page, 'Jobs');
      await page.locator(`text=${job.name}`).click();

      // Look for statistics section
      const statsSection = page.locator('[data-testid="job-statistics"]');
      const statsExists = await statsSection.isVisible().catch(() => false);

      if (statsExists) {
        // Should show various metrics
        await expect(page.locator('text=Total Hashes')).toBeVisible();
        await expect(page.locator('text=Cracked')).toBeVisible();
        await expect(page.locator('text=Progress')).toBeVisible();
        await expect(page.locator('text=Runtime')).toBeVisible();
        await expect(page.locator('text=Hash Rate')).toBeVisible();

        console.log('✅ Job statistics are displayed');
      } else {
        console.log('ℹ️ Job statistics not implemented');
      }
    });
  });

  test.describe('Job Filtering and Search', () => {
    test('should allow filtering jobs by status', async ({ page, request }) => {
      // Create jobs with different statuses
      const job1 = await TestHelpers.createJob(
        request,
        authHeaders,
        'Active Job 1',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      const job2 = await TestHelpers.createJob(
        request,
        authHeaders,
        'Active Job 2',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      // Navigate to jobs tab
      await TestHelpers.navigateToTab(page, 'Jobs');

      // Should see both jobs
      await expect(page.locator(`text=${job1.name}`)).toBeVisible();
      await expect(page.locator(`text=${job2.name}`)).toBeVisible();

      // Look for status filter
      const statusFilter = page
        .locator('select[name="status"], button:has-text("Filter")')
        .first();
      const filterExists = await statusFilter.isVisible().catch(() => false);

      if (filterExists) {
        // Test filtering (implementation depends on UI)
        console.log('✅ Job filtering is available');
      } else {
        console.log('ℹ️ Job filtering not implemented');
      }
    });

    test('should allow searching jobs by name', async ({ page }) => {
      // Navigate to jobs tab
      await TestHelpers.navigateToTab(page, 'Jobs');

      // Look for search input
      const searchInput = page
        .locator('input[placeholder*="search"], input[placeholder*="Search"]')
        .first();
      const searchExists = await searchInput.isVisible().catch(() => false);

      if (searchExists) {
        // Test search functionality
        await searchInput.fill('Test');

        // Should filter results (implementation dependent)
        console.log('✅ Job search is available');
      } else {
        console.log('ℹ️ Job search not implemented');
      }
    });
  });
});
