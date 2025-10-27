import { test, expect } from '../fixtures/auth-fixture';
import { TestUtils } from '../helpers/test-utils';

test.describe('Basic Functionality Test', () => {
  test('should load authenticated dashboard successfully', async ({ page }) => {
    // Navigate to homepage (should redirect to dashboard if authenticated)
    await page.goto('/');

    // Wait for page to fully load and session to be established
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check for authenticated dashboard elements
    const autoPWNHeader = page.locator('text=AutoPWN');
    const networkTabs = page.locator('nav[aria-label="Tabs"]');

    await expect(autoPWNHeader).toBeVisible({ timeout: 5000 });
    await expect(networkTabs).toBeVisible({ timeout: 5000 });

    // Verify we can see dashboard-specific elements
    const userMenu = page.locator('[data-testid="user-menu"], [data-testid="avatar-dropdown"]');
    await expect(userMenu).toBeVisible({ timeout: 5000 });

    console.log('✅ Dashboard loaded successfully with authenticated elements');
  });

  test('should navigate between tabs successfully', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify Networks tab is initially active
    const networksTab = page.locator('[data-testid="tab-networks"]');
    await expect(networksTab).toBeVisible();
    await expect(networksTab).toHaveClass(/text-primary/);

    // Navigate to Dictionaries tab
    const dictionariesTab = page.locator('[data-testid="tab-dictionaries"]');
    await dictionariesTab.click();
    await page.waitForTimeout(500);
    await expect(dictionariesTab).toHaveClass(/text-primary/);

    // Navigate to Jobs tab
    const jobsTab = page.locator('[data-testid="tab-jobs"]');
    await jobsTab.click();
    await page.waitForTimeout(500);
    await expect(jobsTab).toHaveClass(/text-primary/);

    // Navigate to Users tab
    const usersTab = page.locator('[data-testid="tab-users"]');
    await usersTab.click();
    await page.waitForTimeout(500);
    await expect(usersTab).toHaveClass(/text-primary/);

    console.log('✅ Tab navigation working successfully');
  });

  test('should access protected API endpoints', async ({ page }) => {
    // Navigate to homepage to establish authentication
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test accessing users API endpoint through the UI
    const usersTab = page.locator('[data-testid="tab-users"]');
    await usersTab.click();
    await page.waitForTimeout(1000);

    // Check for user management interface elements
    const usersTable = page.locator('table');
    const createUserButton = page.locator('button:has-text("create user")');

    // Either table should be visible or create user button should be present
    const hasTable = await usersTable.isVisible().catch(() => false);
    const hasButton = await createUserButton.isVisible().catch(() => false);

    expect(hasTable || hasButton).toBeTruthy();
    console.log('✅ Protected API endpoints accessible through UI');
  });

  test('should maintain authentication across page reloads', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify authenticated state
    const userMenu = page.locator('[data-testid="user-menu"], [data-testid="avatar-dropdown"]');
    await expect(userMenu).toBeVisible();

    // Reload the page
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify authentication is still active
    await expect(userMenu).toBeVisible({ timeout: 5000 });
    const autoPWNHeader = page.locator('text=AutoPWN');
    await expect(autoPWNHeader).toBeVisible();

    console.log('✅ Authentication maintained across page reloads');
  });

  test('should display responsive design elements', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for responsive design indicators
    const navigation = page.locator('nav[aria-label="Tabs"]');
    await expect(navigation).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone size
    await page.waitForTimeout(500);

    // Navigation should still be accessible on mobile
    await expect(navigation).toBeVisible();

    // Reset to desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    console.log('✅ Responsive design elements working correctly');
  });
});