import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
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

  test.describe('Desktop View', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('should display properly on desktop', async ({ page }) => {
      // Check that all desktop elements are visible
      await expect(page.locator('h1')).toContainText('Welcome back');
      await expect(page.locator('text=Live updates')).toBeVisible();

      // Stats cards should be in a row
      const statsContainer = page.locator('.grid:has-text("Total Jobs")');
      await expect(statsContainer).toBeVisible();

      // Action buttons should be visible
      await expect(page.locator('button:has-text("Upload PCAP Files")')).toBeVisible();
      await expect(page.locator('button:has-text("Create Job")')).toBeVisible();
    });
  });

  test.describe('Tablet View', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('should display properly on tablet', async ({ page }) => {
      // Welcome message should be visible
      await expect(page.locator('h1')).toContainText('Welcome back');

      // Stats cards might wrap to multiple rows
      await expect(page.locator('text=Total Jobs')).toBeVisible();
      await expect(page.locator('text=Active Jobs')).toBeVisible();

      // Tabs should be visible and functional
      await expect(page.locator('button:has-text("Jobs")')).toBeVisible();
      await expect(page.locator('button:has-text("Recent Results")')).toBeVisible();
      await expect(page.locator('button:has-text("Active Jobs")')).toBeVisible();
    });
  });

  test.describe('Mobile View', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should display properly on mobile', async ({ page }) => {
      // Welcome message should wrap properly
      const welcomeHeading = page.locator('h1');
      await expect(welcomeHeading).toContainText('Welcome back');

      // Stats cards should stack vertically
      await expect(page.locator('text=Total Jobs')).toBeVisible();
      await expect(page.locator('text=Active Jobs')).toBeVisible();

      // Action buttons might stack or be in a hamburger menu
      const uploadButton = page.locator('button:has-text("Upload PCAP Files")');
      const createButton = page.locator('button:has-text("Create Job")');

      // Check if buttons are visible or if there's a menu button
      if (await uploadButton.isVisible()) {
        await expect(uploadButton).toBeVisible();
      } else {
        // Look for hamburger menu
        const menuButton = page.locator('button[aria-label*="menu"], button[aria-label*="menu"]');
        if (await menuButton.isVisible()) {
          await menuButton.click();
          await expect(page.locator('text=Upload PCAP Files')).toBeVisible();
          await expect(page.locator('text=Create Job')).toBeVisible();
        }
      }

      // Tabs should still be visible and functional
      await expect(page.locator('button:has-text("Jobs")')).toBeVisible();
      await expect(page.locator('button:has-text("Recent Results")')).toBeVisible();
      await expect(page.locator('button:has-text("Active Jobs")')).toBeVisible();
    });

    test('should handle mobile table scrolling', async ({ page }) => {
      // Navigate to Jobs tab
      await page.click('button:has-text("Jobs")');

      // Look for job table
      const jobTable = page.locator('table');

      if (await jobTable.isVisible()) {
        // Table should have horizontal scroll on mobile
        const tableContainer = jobTable.locator('..');
        const scrollWidth = await tableContainer.evaluate(el => el.scrollWidth);
        const clientWidth = await tableContainer.evaluate(el => el.clientWidth);

        if (scrollWidth > clientWidth) {
          // Table should be horizontally scrollable
          await expect(tableContainer).toHaveCSS('overflow-x', /scroll|auto/);
        }
      }
    });

    test('should handle mobile dialogs', async ({ page }) => {
      // Test file upload dialog on mobile
      await page.click('button:has-text("Upload PCAP Files")');
      await expect(page.locator('text=Upload PCAP Files')).toBeVisible();

      // Dialog should fit on mobile screen
      const dialog = page.locator('[role="dialog"]');
      const dialogWidth = await dialog.evaluate(el => el.getBoundingClientRect().width);
      const viewportSize = page.viewportSize();
      const viewportWidth = viewportSize?.width || 375;

      expect(dialogWidth).toBeLessThanOrEqual(viewportWidth * 0.9);

      // Close dialog
      await page.keyboard.press('Escape');
    });
  });
});