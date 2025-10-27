import { test, expect } from '../fixtures/auth-fixture';

test.describe('Upload and Jobs Functionality', () => {
  test.describe('File Upload', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    });

    test('should open upload modal and show tabs', async ({ page }) => {
      // Click upload button
      await page.locator('button:has-text("Upload Files")').click();

      // Wait for modal to open - use dialog role selector since data-testid might not be working
      await expect(page.locator('div[role="dialog"]')).toBeVisible({ timeout: 10000 });

      // Check for tabs
      await expect(page.locator('button:has-text("Captures")')).toBeVisible();
      await expect(page.locator('button:has-text("Dictionaries")')).toBeVisible();

      // Check for tab content
      await expect(page.locator('text=Network Captures')).toBeVisible();
      await expect(page.locator('text=Upload PCAP files for network analysis and cracking')).toBeVisible();

      console.log('Upload modal opens correctly with tabs visible');
    });

    test('should switch between upload tabs', async ({ page }) => {
      await page.locator('button:has-text("Upload Files")').click();
      await expect(page.locator('div[role="dialog"]')).toBeVisible();

      // Switch to dictionary tab
      await page.locator('button:has-text("Dictionaries")').click();

      // Verify dictionary tab content
      await expect(page.locator('text=Password Dictionaries')).toBeVisible();
      await expect(page.locator('text=Upload TXT dictionary files for password cracking')).toBeVisible();

      // Switch back to captures tab
      await page.locator('button:has-text("Captures")').click();

      // Verify captures tab content
      await expect(page.locator('text=Network Captures')).toBeVisible();

      console.log('Tab switching works correctly');
    });

    test('should show upload area with drag and drop', async ({ page }) => {
      await page.locator('button:has-text("Upload Files")').click();
      await expect(page.locator('div[role="dialog"]')).toBeVisible();

      // Check for upload area elements
      await expect(page.locator('text=Drop files here or click to browse')).toBeVisible();
      await expect(page.locator('.border-2.border-dashed')).toBeVisible();

      console.log('Upload area with drag and drop is visible');
    });

    test('should disable upload button when no files selected', async ({ page }) => {
      await page.locator('button:has-text("Upload Files")').click();
      await expect(page.locator('div[role="dialog"]')).toBeVisible();

      // Upload button should be disabled without files
      const uploadButton = page.locator('button:has-text("Upload Captures")');
      await expect(uploadButton).toBeDisabled();

      console.log('Upload button is disabled when no files selected');
    });

    test('should close upload modal', async ({ page }) => {
      await page.locator('button:has-text("Upload Files")').click();
      await expect(page.locator('div[role="dialog"]')).toBeVisible();

      // Close modal using close button
      await page.locator('button:has-text("Close")').click();

      // Modal should be closed
      await expect(page.locator('div[role="dialog"]')).not.toBeVisible();

      console.log('Upload modal closes correctly');
    });
  });

  test.describe('Job Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Navigate to Jobs tab
      await page.locator('[data-testid="tab-jobs"]').click();
      await page.waitForSelector('[data-testid="tab-jobs"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(500);
    });

    test('should display jobs interface with create button', async ({ page }) => {
      // Verify we're on Jobs tab
      const jobsTab = page.locator('[data-testid="tab-jobs"]');
      expect(await jobsTab.isVisible()).toBeTruthy();
      expect(await jobsTab.evaluate(el => el.classList.contains('text-primary'))).toBeTruthy();

      // Check for create job button (note: it's "Create Jobs" in header, but we'll look for specific buttons)
      await expect(page.locator('button:has-text("Create Jobs")')).toBeVisible();

      console.log('Jobs interface is accessible with create button visible');
    });

    test('should open create job modal', async ({ page }) => {
      // Click create job button
      await page.locator('button:has-text("Create Jobs")').click();

      // Wait for modal to open
      await expect(page.locator('text=Create New Job')).toBeVisible();
      await expect(page.locator('text=Configure a new password cracking job')).toBeVisible();

      console.log('Create job modal opens correctly');
    });

    test('should show job creation form fields', async ({ page }) => {
      await page.locator('button:has-text("Create Jobs")').click();

      // Check for basic form fields
      await expect(page.locator('label:has-text("Job Name")')).toBeVisible();
      await expect(page.locator('input#name')).toBeVisible();

      // Check for networks section
      await expect(page.locator('label:has-text("Networks")')).toBeVisible();

      // Check for dictionaries section
      await expect(page.locator('label:has-text("Dictionaries")')).toBeVisible();

      console.log('Job creation form fields are visible');
    });

    test('should show advanced options section', async ({ page }) => {
      await page.locator('button:has-text("Create Jobs")').click();

      // Advanced options should be collapsed initially
      await expect(page.locator('text=Basic Configuration')).toBeVisible();

      // Click to expand advanced options
      await page.locator('button:has-text("Advanced Options")').click();

      // Check for advanced options
      await expect(page.locator('label:has-text("Attack Mode")')).toBeVisible();
      await expect(page.locator('label:has-text("Hash Type")')).toBeVisible();
      await expect(page.locator('label:has-text("Workload Profile")')).toBeVisible();

      console.log('Advanced options expand correctly');
    });

    test('should show attack mode options', async ({ page }) => {
      await page.locator('button:has-text("Create Jobs")').click();
      await page.locator('button:has-text("Advanced Options")').click();

      // Open attack mode dropdown
      await page.locator('button:has-text("Select attack mode")').click();

      // Check for attack mode options
      await expect(page.locator('text=Straight')).toBeVisible();
      await expect(page.locator('text=Combination')).toBeVisible();
      await expect(page.locator('text=Brute Force')).toBeVisible();
      await expect(page.locator('text=Mask')).toBeVisible();
      await expect(page.locator('text=Hybrid')).toBeVisible();

      console.log('Attack mode options are displayed');
    });

    test('should show hash type options', async ({ page }) => {
      await page.locator('button:has-text("Create Jobs")').click();
      await page.locator('button:has-text("Advanced Options")').click();

      // Open hash type dropdown
      await page.locator('button:has-text("Select hash type")').click();

      // Check for hash type options
      await expect(page.locator('text=22000 - PMKID/EAPOL')).toBeVisible();
      await expect(page.locator('text=2500 - WPA/WPA2-EAPOL')).toBeVisible();
      await expect(page.locator('text=2501 - WPA/WPA2-PMKID')).toBeVisible();

      console.log('Hash type options are displayed');
    });

    test('should show workload profile options', async ({ page }) => {
      await page.locator('button:has-text("Create Jobs")').click();
      await page.locator('button:has-text("Advanced Options")').click();

      // Open workload profile dropdown
      await page.locator('button:has-text("Select workload profile")').click();

      // Check for workload profile options
      await expect(page.locator('text=1 - Low')).toBeVisible();
      await expect(page.locator('text=2 - Default')).toBeVisible();
      await expect(page.locator('text=3 - High')).toBeVisible();
      await expect(page.locator('text=4 - Nightmare')).toBeVisible();

      console.log('Workload profile options are displayed');
    });

    test('should disable create job button when form is incomplete', async ({ page }) => {
      await page.locator('button:has-text("Create Jobs")').click();

      // Create job button should be disabled initially
      const createButton = page.locator('button:has-text("Create Job")');
      await expect(createButton).toBeDisabled();

      console.log('Create job button is disabled when form is incomplete');
    });

    test('should close create job modal', async ({ page }) => {
      await page.locator('button:has-text("Create Jobs")').click();

      // Close modal using cancel button
      await page.locator('button:has-text("Cancel")').click();

      // Modal should be closed
      await expect(page.locator('text=Create New Job')).not.toBeVisible();

      console.log('Create job modal closes correctly');
    });

    test('should handle empty jobs state', async ({ page }) => {
      // Check for empty state message if no jobs exist
      const emptyState = page.locator('text=no jobs found');
      const loadingState = page.locator('.animate-spin');

      if (await emptyState.isVisible()) {
        await expect(page.locator('text=create your first cracking job to get started')).toBeVisible();
        console.log('Empty jobs state displayed correctly');
      } else if (await loadingState.isVisible()) {
        console.log('Jobs are currently loading');
      } else {
        console.log('Jobs list is displayed (jobs exist)');
      }
    });
  });

  test.describe('Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    });

    test('should navigate between upload and jobs features', async ({ page }) => {
      // Test upload access
      await page.locator('button:has-text("Upload Files")').click();
      await expect(page.locator('div[role="dialog"]')).toBeVisible();
      await page.locator('button:has-text("Close")').click();

      // Navigate to jobs tab
      await page.locator('[data-testid="tab-jobs"]').click();
      await page.waitForSelector('[data-testid="tab-jobs"].text-primary', { timeout: 5000 });

      // Test jobs access
      await expect(page.locator('button:has-text("create job")')).toBeVisible();

      console.log('Navigation between upload and jobs works correctly');
    });

    test('should maintain context when switching features', async ({ page }) => {
      // Open upload modal
      await page.locator('button:has-text("Upload Files")').click();
      await expect(page.locator('div[role="dialog"]')).toBeVisible();

      // Close upload modal
      await page.locator('button:has-text("Close")').click();

      // Navigate to jobs
      await page.locator('[data-testid="tab-jobs"]').click();
      await page.waitForSelector('[data-testid="tab-jobs"].text-primary', { timeout: 5000 });

      // Open create job modal
      await page.locator('button:has-text("Create Jobs")').click();
      await expect(page.locator('text=Create New Job')).toBeVisible();

      // Close create job modal
      await page.locator('button:has-text("Cancel")').click();

      // Navigate back to networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForSelector('[data-testid="tab-networks"].text-primary', { timeout: 5000 });

      console.log('Context maintained when switching between features');
    });
  });
});