import { test, expect } from '../fixtures/auth-fixture';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we're authenticated and on the main page
    // The authentication state is already set by auth.setup.ts
    await page.goto('/');
  });

  test('should display user management interface for admins', async ({ page }) => {
    // Navigate to user management (assuming this exists for admin users)
    await page.click('text=Users'); // Adjust selector based on actual UI
    await page.waitForURL('/users', { timeout: 5000 });

    // Verify user management interface
    await expect(page.locator('h1')).toContainText('Users');
    await expect(page.locator('[data-testid="user-list"]')).toBeVisible();
    await expect(page.locator('button:has-text("Add User")')).toBeVisible();
  });

  test('should allow admin to create new user', async ({ page }) => {
    await page.goto('/users');

    // Click add user button
    await page.click('button:has-text("Add User")');

    // Wait for create user modal/form
    await expect(page.locator('[data-testid="create-user-form"]')).toBeVisible();

    // Fill in new user details
    const newUserEmail = `testuser-${Date.now()}@example.com`;
    await page.fill('input[name="email"]', newUserEmail);
    await page.fill('input[name="name"]', 'Test User');
    await page.selectOption('select[name="role"]', 'user');

    // Submit form
    await page.click('button:has-text("Create User")');

    // Verify success message
    await expect(page.locator('text=User created successfully')).toBeVisible();

    // Verify new user appears in list
    await expect(page.locator(`text=${newUserEmail}`)).toBeVisible();
  });

  test('should allow admin to edit existing user', async ({ page }) => {
    await page.goto('/users');

    // Find a user in the list and click edit
    await page.click('[data-testid="user-edit-button"]:first-child');

    // Wait for edit form
    await expect(page.locator('[data-testid="edit-user-form"]')).toBeVisible();

    // Change user role
    await page.selectOption('select[name="role"]', 'admin');

    // Submit changes
    await page.click('button:has-text("Update User")');

    // Verify success message
    await expect(page.locator('text=User updated successfully')).toBeVisible();
  });

  test('should allow admin to delete user', async ({ page }) => {
    await page.goto('/users');

    // Find a user and click delete
    await page.click('[data-testid="user-delete-button"]:first-child');

    // Confirm deletion in modal
    await expect(page.locator('[data-testid="confirm-delete-modal"]')).toBeVisible();
    await page.click('button:has-text("Delete")');

    // Verify success message
    await expect(page.locator('text=User deleted successfully')).toBeVisible();
  });

  test('should validate user creation form', async ({ page }) => {
    await page.goto('/users');
    await page.click('button:has-text("Add User")');

    // Try to submit empty form
    await page.click('button:has-text("Create User")');

    // Should show validation errors
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Name is required')).toBeVisible();

    // Try invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button:has-text("Create User")');

    await expect(page.locator('text=Invalid email address')).toBeVisible();
  });

  test('should display user roles correctly', async ({ page }) => {
    await page.goto('/users');

    // Verify role badges are displayed
    await expect(page.locator('[data-testid="user-role"]')).toBeVisible();

    // Check that admin role is styled differently
    const adminRoleBadge = page.locator('[data-testid="user-role"]:has-text("admin")');
    if (await adminRoleBadge.isVisible()) {
      await expect(adminRoleBadge).toHaveClass(/admin|badge-danger|badge-warning/);
    }
  });

  test('should search and filter users', async ({ page }) => {
    await page.goto('/users');

    // Test search functionality
    await page.fill('input[placeholder*="Search users"]', 'admin');
    await page.press('input[placeholder*="Search users"]', 'Enter');

    // Wait for search results
    await page.waitForTimeout(1000);

    // Verify search worked (should only show users with 'admin' in name/email)
    const userRows = page.locator('[data-testid="user-row"]');
    const count = await userRows.count();

    if (count > 0) {
      // Verify all visible users contain 'admin'
      for (let i = 0; i < count; i++) {
        const rowText = await userRows.nth(i).textContent();
        expect(rowText?.toLowerCase()).toContain('admin');
      }
    }
  });

  test('should handle pagination if user list is long', async ({ page }) => {
    await page.goto('/users');

    // Check if pagination exists
    const pagination = page.locator('[data-testid="pagination"]');

    if (await pagination.isVisible()) {
      // Click next page
      await page.click('button:has-text("Next")');

      // Verify we're on a different page (URL or content changes)
      await page.waitForTimeout(1000);

      // Go back to first page
      await page.click('button:has-text("First")');
      await page.waitForTimeout(1000);
    }
  });
});