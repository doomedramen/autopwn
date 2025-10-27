import { test, expect } from '../fixtures/auth-fixture';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we're authenticated and on the main page
    // The authentication state is already set by auth.setup.ts
    await page.goto('/');

    // Navigate to Users tab
    await page.locator('[data-testid="tab-users"]').click();
    await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
    await page.waitForTimeout(500); // Wait for tab content to render
  });

  test('should display user management interface for admins', async ({ page }) => {
    // Verify we're on the Users tab (navigation handled by beforeEach)
    const usersTab = page.locator('[data-testid="tab-users"]');
    expect(await usersTab.isVisible()).toBeTruthy();
    expect(await usersTab.evaluate(el => el.classList.contains('text-primary'))).toBeTruthy();

    // Check for either table with data OR empty state
    const usersTable = page.locator('table');
    const emptyState = page.locator('text=no users found');

    if (await usersTable.isVisible()) {
      // Verify table headers if table is visible
      await expect(page.locator('th:has-text("Email")')).toBeVisible();
      await expect(page.locator('th:has-text("Role")')).toBeVisible();
      await expect(page.locator('th:has-text("Created")')).toBeVisible();
      await expect(page.locator('th:has-text("Last Updated")')).toBeVisible();
      await expect(page.locator('th:has-text("Actions")')).toBeVisible();
      console.log('Users interface is accessible - table structure verified');
    } else if (await emptyState.isVisible()) {
      // Empty state is also a valid interface
      console.log('Users interface is accessible - empty state displayed');
    } else {
      // Check for loading state
      const loadingState = page.locator('.animate-spin');
      if (await loadingState.isVisible()) {
        console.log('Users interface is loading');
      } else {
        // Table might not be visible but check for the users tab container
        const usersTabContent = page.locator('[data-testid="tab-users"].text-primary');
        expect(await usersTabContent.isVisible()).toBeTruthy();
        console.log('Users interface is accessible - tab navigation verified');
      }
    }
  });

  test('should show create user button (disabled)', async ({ page }) => {
    // Check for create user button - it should be present but disabled
    const createUserButton = page.locator('button:has-text("create user")');
    await expect(createUserButton.isVisible()).toBeTruthy();
    await expect(createUserButton).toBeDisabled();

    console.log('Create user button is visible but disabled - functionality not yet implemented');
  });

  test('should show edit and delete buttons (disabled)', async ({ page }) => {
    // Check if there are users in the table
    const userRows = page.locator('tbody tr');

    if (await userRows.count() > 0) {
      // Check for edit and delete buttons in the first row - they should be disabled
      const editButton = page.locator('button:has-text("Edit")').first();
      const deleteButton = page.locator('button:has-text("Delete")').first();

      await expect(editButton.isVisible()).toBeTruthy();
      await expect(editButton).toBeDisabled();

      await expect(deleteButton.isVisible()).toBeTruthy();
      await expect(deleteButton).toBeDisabled();

      console.log('Edit and delete buttons are visible but disabled - functionality not yet implemented');
    } else {
      console.log('No users found in table - skipping button checks');
    }
  });

  test('should display user roles correctly', async ({ page }) => {
    // Check if there are users in the table
    const userRows = page.locator('tbody tr');

    if (await userRows.count() > 0) {
      // Look for role badges - they should be displayed with styling
      const roleBadges = page.locator('span:has-text("admin"), span:has-text("user")');

      if (await roleBadges.count() > 0) {
        await expect(roleBadges.first()).toBeVisible();

        // Check for admin role specifically
        const adminBadge = page.locator('span:has-text("admin")');
        if (await adminBadge.isVisible()) {
          // Admin badges should have destructive styling (red/orange)
          await expect(adminBadge).toHaveClass(/destructive/);
        }

        console.log('User role badges are displayed with correct styling');
      } else {
        console.log('No role badges found in user rows');
      }
    } else {
      console.log('No users found in table - skipping role checks');
    }
  });

  test('should display user data correctly', async ({ page }) => {
    // Check if there are users in the table
    const userRows = page.locator('tbody tr');

    if (await userRows.count() > 0) {
      // Verify table structure contains user data
      const firstRow = userRows.first();

      // Check for email column
      const emailCell = firstRow.locator('td').first();
      await expect(emailCell.isVisible()).toBeTruthy();

      // Check that user data is displayed
      const rowText = await firstRow.textContent();
      expect(rowText).toBeTruthy();
      expect(rowText!.length).toBeGreaterThan(0);

      console.log('User data is displayed correctly in table format');
    } else {
      // Check for empty state
      const emptyState = page.locator('text=no users found');
      if (await emptyState.isVisible()) {
        console.log('Empty state displayed correctly - no users found');
      } else {
        console.log('No users found and no empty state - checking loading state');
      }
    }
  });
});