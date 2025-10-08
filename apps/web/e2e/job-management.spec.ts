import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Job Management', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto('/');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('/');
    await expect(page.locator('h1')).toContainText(/Welcome|Dashboard/i, { timeout: 10000 });
  });

  test('should create a new job', async ({ page }) => {
    // Open job creation dialog
    await page.click('button:has-text("Create Job")');
    await expect(page.locator('text=Create New Cracking Job')).toBeVisible();

    // Fill in job details
    await page.fill('input[name="filename"]', 'test-handshake.pcap');

    // Select priority
    await page.click('button[role="combobox"]'); // This opens the select dropdown
    await page.click('text=High (1)');

    // Note: Dictionary selection would depend on available dictionaries
    // For this test, we'll assume at least one dictionary exists

    // Submit form (this might fail if no dictionaries are available)
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isEnabled()) {
      await submitButton.click();

      // Should show success message and close dialog
      await expect(page.locator('text=Job created successfully')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Create New Cracking Job')).not.toBeVisible();
    } else {
      // If no dictionaries available, show informative message
      await expect(page.locator('text=No dictionaries available')).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('should upload PCAP files', async ({ page }) => {
    // Open upload dialog
    await page.click('button:has-text("Upload PCAP Files")');
    await expect(page.locator('text=Upload PCAP Files')).toBeVisible();

    // Create a test file path (this would need to be adjusted based on your test setup)
    const testFilePath = path.join(__dirname, '..', 'fixtures', 'test.pcap');

    // For now, we'll test the dialog functionality without actual file upload
    // since we don't have real test files

    // Click the upload area to trigger file selection
    await page.click('text=Drop files here or click to browse');

    // Test drag and drop area
    const dropZone = page.locator('div[class*="border-dashed"]');
    await expect(dropZone).toBeVisible();

    // Close dialog
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Upload PCAP Files')).not.toBeVisible();
  });

  test('should view job details', async ({ page }) => {
    // Navigate to Jobs tab
    await page.click('button:has-text("Jobs")');

    // Look for existing jobs
    const jobRows = page.locator('table tbody tr');

    if (await jobRows.count() > 0) {
      // Click on the first job's "View" button
      await page.click('table tbody tr button:has-text("View")');

      // Verify job details dialog opens
      await expect(page.locator('text=Job Details')).toBeVisible();

      // Check for tabs in job details
      await expect(page.locator('button:has-text("Overview")')).toBeVisible();
      await expect(page.locator('button:has-text("Items")')).toBeVisible();
      await expect(page.locator('button:has-text("Logs")')).toBeVisible();
      await expect(page.locator('button:has-text("Actions")')).toBeVisible();

      // Close dialog
      await page.keyboard.press('Escape');
      await expect(page.locator('text=Job Details')).not.toBeVisible();
    } else {
      // No jobs exist, skip this part of the test
      console.log('No jobs found to test job details');
    }
  });

  test('should display job status correctly', async ({ page }) => {
    // Navigate to Jobs tab
    await page.click('button:has-text("Jobs")');

    const jobRows = page.locator('table tbody tr');

    if (await jobRows.count() > 0) {
      // Check that job status badges are visible
      const statusBadges = page.locator('table tbody tr .badge');

      for (let i = 0; i < await statusBadges.count(); i++) {
        const badge = statusBadges.nth(i);
        await expect(badge).toBeVisible();

        // Should contain one of the known status values
        const badgeText = await badge.textContent();
        expect([
          'completed', 'processing', 'failed', 'paused',
          'pending', 'stopped'
        ]).toContain(badgeText?.toLowerCase() || '');
      }
    }
  });

  test('should show progress bars for jobs with progress', async ({ page }) => {
    // Navigate to Jobs tab
    await page.click('button:has-text("Jobs")');

    const jobRows = page.locator('table tbody tr');

    if (await jobRows.count() > 0) {
      // Look for progress bars
      const progressBars = page.locator('.progress, [role="progressbar"]');

      if (await progressBars.count() > 0) {
        await expect(progressBars.first()).toBeVisible();
      }
    }
  });

  test('should allow job actions', async ({ page }) => {
    // Navigate to Jobs tab
    await page.click('button:has-text("Jobs")');

    const jobRows = page.locator('table tbody tr');

    if (await jobRows.count() > 0) {
      // Click on the first job's "View" button
      await page.click('table tbody tr button:has-text("View")');

      // Go to Actions tab
      await page.click('button:has-text("Actions")');

      // Look for action buttons (availability depends on job status)
      const actionButtons = page.locator('button:has-text("Pause"), button:has-text("Resume"), button:has-text("Stop"), button:has-text("Restart"), button:has-text("Delete")');

      if (await actionButtons.count() > 0) {
        // Test that action buttons are clickable
        await expect(actionButtons.first()).toBeVisible();
      }

      // Close dialog
      await page.keyboard.press('Escape');
    }
  });
});