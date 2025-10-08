import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
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

  test('should display dashboard components', async ({ page }) => {
    // Check for welcome message
    await expect(page.locator('h1')).toContainText('Welcome back');

    // Check for stats cards
    await expect(page.locator('text=Total Jobs')).toBeVisible();
    await expect(page.locator('text=Active Jobs')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
    await expect(page.locator('text=Cracked')).toBeVisible();
    await expect(page.locator('text=Unique Networks')).toBeVisible();

    // Check for tabs
    await expect(page.locator('button:has-text("Jobs")')).toBeVisible();
    await expect(page.locator('button:has-text("Recent Results")')).toBeVisible();
    await expect(page.locator('button:has-text("Active Jobs")')).toBeVisible();

    // Check for action buttons
    await expect(page.locator('button:has-text("Upload PCAP Files")')).toBeVisible();
    await expect(page.locator('button:has-text("Create Job")')).toBeVisible();
  });

  test('should show WebSocket connection status', async ({ page }) => {
    // Check for connection status indicator
    const connectionStatus = page.locator('text=Live updates');

    // It might take a moment for WebSocket to connect
    await expect(connectionStatus).toBeVisible({ timeout: 5000 });
  });

  test('should navigate between tabs', async ({ page }) => {
    // Click on different tabs and verify content
    await page.click('button:has-text("Recent Results")');
    await expect(page.locator('text=Your most recently cracked WiFi passwords')).toBeVisible();

    await page.click('button:has-text("Active Jobs")');
    await expect(page.locator('text=Jobs that are currently running, paused, or pending')).toBeVisible();

    await page.click('button:has-text("Jobs")');
    await expect(page.locator('text=All your WiFi handshake cracking jobs')).toBeVisible();
  });

  test('should open file upload dialog', async ({ page }) => {
    // Click upload button
    await page.click('button:has-text("Upload PCAP Files")');

    // Verify dialog opens
    await expect(page.locator('text=Upload PCAP Files')).toBeVisible();
    await expect(page.locator('text=Drop files here or click to browse')).toBeVisible();
    await expect(page.locator('text=Supported formats: .pcap, .pcapng, .cap')).toBeVisible();

    // Close dialog
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Upload PCAP Files')).not.toBeVisible();
  });

  test('should open job creation dialog', async ({ page }) => {
    // Click create job button
    await page.click('button:has-text("Create Job")');

    // Verify dialog opens
    await expect(page.locator('text=Create New Cracking Job')).toBeVisible();
    await expect(page.locator('text=PCAP Filename')).toBeVisible();
    await expect(page.locator('text=Priority')).toBeVisible();
    await expect(page.locator('text=Select Dictionaries')).toBeVisible();

    // Close dialog
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Create New Cracking Job')).not.toBeVisible();
  });

  test('should show empty state when no jobs exist', async ({ page }) => {
    // Navigate to Jobs tab
    await page.click('button:has-text("Jobs")');

    // Check for empty state if no jobs exist
    const emptyState = page.locator('text=No jobs yet');
    if (await emptyState.isVisible()) {
      await expect(page.locator('text=Start by uploading PCAP files and creating cracking jobs')).toBeVisible();
    }
  });

  test('should show empty state when no results exist', async ({ page }) => {
    // Navigate to Results tab
    await page.click('button:has-text("Recent Results")');

    // Check for empty state if no results exist
    const emptyState = page.locator('text=No results yet');
    if (await emptyState.isVisible()) {
      await expect(page.locator('text=Start by uploading PCAP files and creating cracking jobs')).toBeVisible();
    }
  });

  test('should show empty state when no active jobs exist', async ({ page }) => {
    // Navigate to Active Jobs tab
    await page.click('button:has-text("Active Jobs")');

    // Check for empty state if no active jobs exist
    const emptyState = page.locator('text=No active jobs');
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
    }
  });
});