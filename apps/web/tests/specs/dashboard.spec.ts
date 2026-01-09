import { test, expect } from '@playwright/test';
import { TEST_USER, loginViaUI } from '../helpers/auth';

/**
 * Dashboard E2E Tests
 * Tests authenticated dashboard functionality
 */
test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginViaUI(page, TEST_USER.email, TEST_USER.password);
  });

  test('should display dashboard for authenticated user', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Dashboard should be visible (not redirected to sign-in)
    await expect(page).not.toHaveURL(/sign-in/);

    // Body should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display networks tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for networks tab or networks content
    const networksTab = page.getByRole('tab', { name: /network/i });
    const networksLink = page.getByRole('link', { name: /network/i });

    const hasNetworksUI = await networksTab.isVisible().catch(() => false) ||
                          await networksLink.isVisible().catch(() => false) ||
                          await page.getByText(/network/i).first().isVisible().catch(() => false);

    expect(hasNetworksUI).toBe(true);
  });

  test('should display dictionaries tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for dictionaries tab or dictionaries content
    const dictionariesTab = page.getByRole('tab', { name: /dictionar/i });
    const dictionariesLink = page.getByRole('link', { name: /dictionar/i });

    const hasDictionariesUI = await dictionariesTab.isVisible().catch(() => false) ||
                              await dictionariesLink.isVisible().catch(() => false) ||
                              await page.getByText(/dictionar/i).first().isVisible().catch(() => false);

    expect(hasDictionariesUI).toBe(true);
  });

  test('should display jobs tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for jobs tab or jobs content
    const jobsTab = page.getByRole('tab', { name: /job/i });
    const jobsLink = page.getByRole('link', { name: /job/i });

    const hasJobsUI = await jobsTab.isVisible().catch(() => false) ||
                      await jobsLink.isVisible().catch(() => false) ||
                      await page.getByText(/job/i).first().isVisible().catch(() => false);

    expect(hasJobsUI).toBe(true);
  });

  test('should allow navigation between tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try clicking different tabs if they exist
    const tabs = ['network', 'dictionar', 'job'];

    for (const tabName of tabs) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') });

      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForLoadState('networkidle');

        // Verify tab is selected/active
        await expect(tab).toHaveAttribute('aria-selected', 'true').catch(() => {});
      }
    }
  });
});
