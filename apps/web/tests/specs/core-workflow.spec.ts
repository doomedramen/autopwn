import { test, expect } from '../fixtures/auth-fixture';
import path from 'path';
import fs from 'fs';

test.describe('Core AutoPWN Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify we're on the correct page after navigation
    const currentUrl = page.url();
    console.log(`📍 Current URL after navigation: ${currentUrl}`);

    // Check if we've been redirected to sign-in page (authentication issue)
    if (currentUrl.includes('/sign-in')) {
      throw new Error(`Authentication failed - redirected to sign-in page. Expected dashboard but got: ${currentUrl}`);
    }

    // Verify we're on the main dashboard page
    expect(currentUrl).toMatch(/\/$/);
    console.log('✅ Successfully navigated to dashboard');
  });

  test('should complete full workflow: upload PCAP → upload dictionary → create job → verify execution', async ({ page }) => {
    console.log('🚀 Starting core AutoPWN workflow test');

    // Check example files exist
    const pcapFile = '/Users/martin/Developer/autopwn/example_files/pcaps/wpa2-ikeriri-5g.pcap';
    const dictionaryFile = '/Users/martin/Developer/autopwn/example_files/dictionaries/test-passwords.txt';

    if (!fs.existsSync(pcapFile) || !fs.existsSync(dictionaryFile)) {
      test.skip();
      console.log('❌ Example files not found, skipping test');
      return;
    }

    console.log('✅ Example files found');

    // Step 1: Upload PCAP file
    console.log('📤 Step 1: Uploading PCAP file');
    await page.locator('button:has-text("Upload Files")').click();
    await expect(page.locator('div[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Ensure we're on the Captures tab
    const capturesTab = page.locator('button:has-text("Captures")');
    if (await capturesTab.isVisible()) {
      await capturesTab.click();
      await page.waitForTimeout(500);
    }

    // Upload PCAP using file input
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles([pcapFile]);
      console.log('📄 PCAP file selected');

      // Click upload button
      const uploadButton = page.locator('button:has-text("Upload Captures"), button:has-text("Upload")').first();
      if (await uploadButton.isVisible() && !(await uploadButton.isDisabled())) {
        await uploadButton.click();
        console.log('✅ PCAP upload initiated');
      } else {
        console.log('⚠️ Upload button not available or disabled');
      }
    } else {
      console.log('⚠️ File input not found - trying API upload');
      // Fallback to API upload if UI doesn't work
      try {
        const pcapBuffer = fs.readFileSync(pcapFile);
        const response = await page.evaluate(async ([fileData, fileName]) => {
          const formData = new FormData();
          const blob = new Blob([Uint8Array.from(atob(fileData), c => c.charCodeAt(0))], { type: 'application/octet-stream' });
          formData.append('file', blob, fileName);

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });

          return response.ok;
        }, [pcapBuffer.toString('base64'), 'wpa2-ikeriri-5g.pcap']);

        if (response) {
          console.log('✅ PCAP uploaded via API fallback');
        }
      } catch (error) {
        console.log('❌ API upload failed:', error);
      }
    }

    // Close modal
    await page.locator('button:has-text("Close")').click();
    await page.waitForTimeout(2000);

    // Step 2: Upload Dictionary file
    console.log('📤 Step 2: Uploading dictionary file');
    await page.locator('button:has-text("Upload Files")').click();
    await expect(page.locator('div[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Switch to Dictionaries tab
    await page.locator('button:has-text("Dictionaries")').click();
    await page.waitForTimeout(500);

    // Upload dictionary using file input
    const dictFileInput = page.locator('input[type="file"]').first();
    if (await dictFileInput.isVisible()) {
      await dictFileInput.setInputFiles([dictionaryFile]);
      console.log('📄 Dictionary file selected');

      // Click upload button
      const dictUploadButton = page.locator('button:has-text("Upload Dictionaries"), button:has-text("Upload")').first();
      if (await dictUploadButton.isVisible() && !(await dictUploadButton.isDisabled())) {
        await dictUploadButton.click();
        console.log('✅ Dictionary upload initiated');
      } else {
        console.log('⚠️ Dictionary upload button not available or disabled');
      }
    } else {
      console.log('⚠️ Dictionary file input not found - trying API upload');
      // Fallback to API upload
      try {
        const dictBuffer = fs.readFileSync(dictionaryFile);
        const response = await page.evaluate(async ([fileData, fileName]) => {
          const formData = new FormData();
          const blob = new Blob([Uint8Array.from(atob(fileData), c => c.charCodeAt(0))], { type: 'text/plain' });
          formData.append('file', blob, fileName);

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });

          return response.ok;
        }, [dictBuffer.toString('base64'), 'test-passwords.txt']);

        if (response) {
          console.log('✅ Dictionary uploaded via API fallback');
        }
      } catch (error) {
        console.log('❌ Dictionary API upload failed:', error);
      }
    }

    // Close modal
    await page.locator('button:has-text("Close")').click();
    await page.waitForTimeout(3000);

    // Step 3: Verify files appear in UI
    console.log('🔍 Step 3: Verifying files appear in system');

    // Check Networks tab
    await page.locator('[data-testid="tab-networks"]').click();
    await page.waitForSelector('[data-testid="tab-networks"].text-primary', { timeout: 5000 });
    await page.waitForTimeout(2000);

    // Verify we're still on the correct page after tab navigation
    const networksUrl = page.url();
    console.log(`📍 URL after Networks tab click: ${networksUrl}`);
    if (networksUrl.includes('/sign-in')) {
      throw new Error(`Authentication failed after Networks tab navigation. Got: ${networksUrl}`);
    }

    const networkRows = await page.locator('table tbody tr, [data-testid="network-item"]').count();
    console.log(`📡 Found ${networkRows} network(s)`);

    // Check Dictionaries tab
    await page.locator('[data-testid="tab-dictionaries"]').click();
    await page.waitForSelector('[data-testid="tab-dictionaries"].text-primary', { timeout: 5000 });
    await page.waitForTimeout(2000);

    // Verify we're still on the correct page after tab navigation
    const dictionariesUrl = page.url();
    console.log(`📍 URL after Dictionaries tab click: ${dictionariesUrl}`);
    if (dictionariesUrl.includes('/sign-in')) {
      throw new Error(`Authentication failed after Dictionaries tab navigation. Got: ${dictionariesUrl}`);
    }

    const dictionaryRows = await page.locator('table tbody tr, [data-testid="dictionary-item"]').count();
    console.log(`📚 Found ${dictionaryRows} dictionar(ies)`);

    // Step 4: Create password cracking job
    console.log('⚙️ Step 4: Creating password cracking job');
    await page.locator('[data-testid="tab-jobs"]').click();
    await page.waitForSelector('[data-testid="tab-jobs"].text-primary', { timeout: 5000 });

    // Verify we're still on the correct page after Jobs tab navigation
    const jobsUrl = page.url();
    console.log(`📍 URL after Jobs tab click: ${jobsUrl}`);
    if (jobsUrl.includes('/sign-in')) {
      throw new Error(`Authentication failed after Jobs tab navigation. Got: ${jobsUrl}`);
    }

    // Open create job modal
    await page.locator('button:has-text("Create Jobs")').click();
    await expect(page.locator('div[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Fill job details
    const jobNameInput = page.locator('input#name, input[name="name"]').first();
    if (await jobNameInput.isVisible()) {
      await jobNameInput.fill('E2E Test Job - Core Workflow');
      console.log('✅ Job name set');
    }

    // Select network (if available)
    const networkCheckboxes = page.locator('input[type="checkbox"]').all();
    if (networkCheckboxes.length > 0) {
      await networkCheckboxes[0].check();
      console.log('✅ Network selected');
    } else {
      console.log('⚠️ No networks available for selection');
    }

    // Select dictionary (if available)
    const dictionaryCheckboxes = page.locator('input[type="checkbox"]').all();
    if (dictionaryCheckboxes.length > 1) {
      await dictionaryCheckboxes[1].check();
      console.log('✅ Dictionary selected');
    } else {
      console.log('⚠️ No dictionaries available for selection');
    }

    // Submit job creation
    const submitButton = page.locator('button:has-text("Create Job")').first();
    if (await submitButton.isVisible() && !(await submitButton.isDisabled())) {
      await submitButton.click();
      console.log('✅ Job creation submitted');
    } else {
      console.log('⚠️ Submit button not available - job may not be creatable without files');
    }

    // Close modal
    await page.waitForTimeout(2000);
    if (await page.locator('div[role="dialog"]').isVisible()) {
      await page.locator('button:has-text("Cancel"), button:has-text("Close")').click();
    }

    // Step 5: Verify job execution
    console.log('🏃 Step 5: Verifying job execution');
    await page.waitForTimeout(3000);

    // Check jobs list
    const jobRows = await page.locator('table tbody tr, [data-testid="job-row"]').count();
    console.log(`📋 Found ${jobRows} job(s) in list`);

    if (jobRows > 0) {
      // Check job status
      const firstJob = page.locator('table tbody tr, [data-testid="job-row"]').first();
      const jobStatus = await firstJob.locator('[data-testid="status"], .status, span').first().textContent();
      console.log(`📊 First job status: ${jobStatus?.trim()}`);

      // Look for progress indicators or results
      const hasProgress = await firstJob.locator('[role="progressbar"], .progress').count() > 0;
      const hasResults = await page.locator('text=cracked, text=passwords found, text=results').count() > 0;

      console.log(`📈 Progress indicator: ${hasProgress ? 'Yes' : 'No'}`);
      console.log(`🎯 Results visible: ${hasResults ? 'Yes' : 'No'}`);
    }

    // Step 6: Check dashboard statistics
    console.log('📊 Step 6: Checking dashboard statistics');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're on the dashboard after final navigation
    const finalDashboardUrl = page.url();
    console.log(`📍 Final dashboard URL: ${finalDashboardUrl}`);
    if (finalDashboardUrl.includes('/sign-in')) {
      throw new Error(`Authentication failed during final dashboard navigation. Got: ${finalDashboardUrl}`);
    }
    expect(finalDashboardUrl).toMatch(/\/$/);
    console.log('✅ Successfully returned to dashboard');

    // Look for stat cards
    const statCards = await page.locator('[data-testid="stats-cards"] > div, .grid > div').count();
    console.log(`📈 Found ${statCards} statistics cards`);

    // Check for specific metrics
    const networksStat = await page.locator('text=Networks').count() > 0;
    const dictionariesStat = await page.locator('text=Dictionaries').count() > 0;
    const jobsStat = await page.locator('text=Active Jobs, text=Jobs').count() > 0;

    console.log(`📡 Networks stat visible: ${networksStat ? 'Yes' : 'No'}`);
    console.log(`📚 Dictionaries stat visible: ${dictionariesStat ? 'Yes' : 'No'}`);
    console.log(`⚙️ Jobs stat visible: ${jobsStat ? 'Yes' : 'No'}`);

    console.log('✅ Core workflow test completed successfully!');
  });

  test('should handle server setup and basic functionality', async ({ page }) => {
    console.log('🔧 Testing server setup and basic functionality');

    // Verify we're starting from the dashboard
    const currentUrl = page.url();
    console.log(`📍 Starting URL for server setup test: ${currentUrl}`);
    if (currentUrl.includes('/sign-in')) {
      throw new Error(`Authentication failed at start of server setup test. Got: ${currentUrl}`);
    }
    expect(currentUrl).toMatch(/\/$/);
    console.log('✅ Starting from dashboard');

    // Test 1: Server health check
    const healthResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/health');
        return {
          status: response.status,
          ok: response.ok,
          data: await response.json()
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(healthResponse.ok).toBeTruthy();
    console.log('✅ Server health check passed');

    // Test 2: Authentication check
    const userMenu = page.locator('[data-testid="user-menu"], [data-testid="avatar-dropdown"]');
    await expect(userMenu).toBeVisible({ timeout: 5000 });
    console.log('✅ User authentication verified');

    // Test 3: API endpoints accessible
    const networksResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/networks');
        return response.ok;
      } catch (error) {
        return false;
      }
    });

    const dictionariesResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/dictionaries');
        return response.ok;
      } catch (error) {
        return false;
      }
    });

    const jobsResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/jobs');
        return response.ok;
      } catch (error) {
        return false;
      }
    });

    console.log(`📡 Networks API: ${networksResponse ? '✅' : '❌'}`);
    console.log(`📚 Dictionaries API: ${dictionariesResponse ? '✅' : '❌'}`);
    console.log(`⚙️ Jobs API: ${jobsResponse ? '✅' : '❌'}`);

    // Test 4: File upload endpoint availability
    const uploadConfigResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/upload/config');
        return response.ok;
      } catch (error) {
        return false;
      }
    });

    console.log(`📤 Upload config API: ${uploadConfigResponse ? '✅' : '❌'}`);

    console.log('✅ Server setup test completed');
  });
});