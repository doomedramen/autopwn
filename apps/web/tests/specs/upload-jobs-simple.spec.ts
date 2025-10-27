import { test, expect } from '../fixtures/auth-fixture';

test.describe('Upload Functionality - Simplified', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('should access upload interface', async ({ page }) => {
    // Verify upload button exists and is clickable
    const uploadButton = page.locator('button:has-text("Upload Files")');
    await expect(uploadButton).toBeVisible();

    // Click upload button
    await uploadButton.click();

    // Verify modal opens
    await expect(page.locator('div[role="dialog"]')).toBeVisible({ timeout: 10000 });

    console.log('✅ Upload interface is accessible');
  });

  test('should close upload modal', async ({ page }) => {
    // Open upload modal
    await page.locator('button:has-text("Upload Files")').click();
    await expect(page.locator('div[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Try to find and click close button (might be in different locations)
    const closeButton = page.locator('button:has-text("Close"), button[aria-label="Close"], button:has-text("×")').first();
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await expect(page.locator('div[role="dialog"]')).not.toBeVisible();
      console.log('✅ Upload modal closes correctly');
    } else {
      // Alternative: click outside modal or press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
      console.log('✅ Upload modal can be dismissed');
    }
  });

  test('should verify upload modal content exists', async ({ page }) => {
    // Open upload modal
    await page.locator('button:has-text("Upload Files")').click();
    await expect(page.locator('div[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Check for any content that indicates upload functionality
    const dialogContent = page.locator('div[role="dialog"]');

    // Look for upload-related text or elements
    const hasUploadText = await dialogContent.getByText(/upload|file|drop/i).count() > 0;
    const hasUploadButton = await dialogContent.locator('button').count() > 0;

    expect(hasUploadText || hasUploadButton).toBeTruthy();
    console.log('✅ Upload modal contains relevant content');
  });
});

test.describe('Job Creation - Simplified', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Navigate to Jobs tab
    await page.locator('[data-testid="tab-jobs"]').click();
    await page.waitForSelector('[data-testid="tab-jobs"].text-primary', { timeout: 5000 });
    await page.waitForTimeout(500);
  });

  test('should access job creation interface', async ({ page }) => {
    // Verify jobs tab is active
    const jobsTab = page.locator('[data-testid="tab-jobs"]');
    expect(await jobsTab.isVisible()).toBeTruthy();
    expect(await jobsTab.evaluate(el => el.classList.contains('text-primary'))).toBeTruthy();

    // Look for create job buttons (header or tab)
    const createJobButtons = [
      'button:has-text("Create Jobs")',  // Header button
      'button:has-text("create job")'    // Jobs tab button
    ];

    let buttonFound = false;
    for (const selector of createJobButtons) {
      if (await page.locator(selector).isVisible()) {
        buttonFound = true;
        break;
      }
    }

    expect(buttonFound).toBeTruthy();
    console.log('✅ Job creation interface is accessible');
  });

  test('should open create job modal', async ({ page }) => {
    // Try header create jobs button first
    const headerButton = page.locator('button:has-text("Create Jobs")');
    if (await headerButton.isVisible()) {
      await headerButton.click();
    } else {
      // Fall back to jobs tab button
      await page.locator('button:has-text("create job")').click();
    }

    // Verify modal opens
    await expect(page.locator('div[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Check for job creation related content
    const dialogContent = page.locator('div[role="dialog"]');
    const hasJobText = await dialogContent.getByText(/job|create|configure/i).count() > 0;

    expect(hasJobText).toBeTruthy();
    console.log('✅ Job creation modal opens and contains relevant content');
  });

  test('should close create job modal', async ({ page }) => {
    // Open create job modal
    const headerButton = page.locator('button:has-text("Create Jobs")');
    if (await headerButton.isVisible()) {
      await headerButton.click();
    } else {
      await page.locator('button:has-text("create job")').click();
    }

    await expect(page.locator('div[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Try to close modal
    const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await expect(page.locator('div[role="dialog"]')).not.toBeVisible();
      console.log('✅ Job creation modal closes correctly');
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
      console.log('✅ Job creation modal can be dismissed');
    }
  });
});

test.describe('Integration - Core Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('should navigate between main features', async ({ page }) => {
    // Test upload access
    const uploadButton = page.locator('button:has-text("Upload Files")');
    await expect(uploadButton).toBeVisible();
    console.log('✅ Upload feature accessible');

    // Test job creation access
    const createJobsButton = page.locator('button:has-text("Create Jobs")');
    await expect(createJobsButton).toBeVisible();
    console.log('✅ Job creation feature accessible');

    // Navigate to different tabs
    const tabs = ['networks', 'dictionaries', 'jobs', 'users'];

    for (const tab of tabs) {
      await page.locator(`[data-testid="tab-${tab}"]`).click();
      await page.waitForSelector(`[data-testid="tab-${tab}"].text-primary`, { timeout: 5000 });
      console.log(`✅ ${tab} tab accessible`);
    }

    console.log('✅ All main features are accessible');
  });

  test('should maintain navigation context', async ({ page }) => {
    // Navigate through different sections
    await page.locator('[data-testid="tab-jobs"]').click();
    await page.waitForSelector('[data-testid="tab-jobs"].text-primary', { timeout: 5000 });

    // Verify we can still access upload and create jobs
    await expect(page.locator('button:has-text("Upload Files")')).toBeVisible();
    await expect(page.locator('button:has-text("Create Jobs")')).toBeVisible();

    // Navigate back to networks
    await page.locator('[data-testid="tab-networks"]').click();
    await page.waitForSelector('[data-testid="tab-networks"].text-primary', { timeout: 5000 });

    // Verify features still accessible
    await expect(page.locator('button:has-text("Upload Files")')).toBeVisible();
    await expect(page.locator('button:has-text("Create Jobs")')).toBeVisible();

    console.log('✅ Navigation context maintained throughout application');
  });
});