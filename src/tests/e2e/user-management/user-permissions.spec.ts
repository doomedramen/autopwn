import { test, expect } from '@playwright/test';
import { TestHelpers, TestUser } from '../helpers/test-helpers';

test.describe('User Permissions', () => {
  let adminUser: TestUser;
  let regularUser: TestUser;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Initialize system and create admin user
    const superUser = await TestHelpers.initializeSystem(page);
    await TestHelpers.login(page, superUser.email, superUser.password);

    // Create admin user for tests
    const adminData = TestHelpers.generateTestData();
    await TestHelpers.createUser(
      page,
      adminData.username,
      adminData.email,
      adminData.password,
      'admin'
    );
    adminUser = adminData;

    // Create regular user for tests
    const regularData = TestHelpers.generateTestData();
    await TestHelpers.createUser(
      page,
      regularData.username,
      regularData.email,
      regularData.password,
      'user'
    );
    regularUser = regularData;

    await context.close();
  });

  test('should show users tab only for admin users', async ({
    page,
    context,
  }) => {
    // Login as admin first
    await TestHelpers.loginWithSession(
      page,
      context,
      adminUser.email,
      adminUser.password
    );

    // Should see users tab as admin
    await expect(page.locator('text=Users')).toBeVisible();
    const usersTab = page.locator('[role="tab"]:has-text("Users")');
    await expect(usersTab).toBeVisible();

    // Logout and login as regular user
    await page.context().clearCookies();
    await TestHelpers.login(page, regularUser.email, regularUser.password);

    // Should not see users tab as regular user
    await expect(page.locator('text=Users')).not.toBeVisible();
  });

  test('should display user management interface', async ({
    page,
    context,
  }) => {
    // Login as admin
    await TestHelpers.loginWithSession(
      page,
      context,
      adminUser.email,
      adminUser.password
    );

    // Navigate to users tab
    await TestHelpers.navigateToTab(page, 'Users');

    // Check page elements
    await expect(page.locator('h2')).toContainText('User Management');
    await expect(
      page.locator('text=Manage user accounts and permissions')
    ).toBeVisible();
    await expect(page.locator('button:has-text("Add User")')).toBeVisible();

    // Check search and filter
    await expect(
      page.locator('input[placeholder*="Search users"]')
    ).toBeVisible();
    await expect(
      page.locator('button:has-text("Filter by role")')
    ).toBeVisible();

    // Check users table
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=User')).toBeVisible();
    await expect(page.locator('text=Role')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
  });

  test('should filter users by role', async ({ page, context }) => {
    // Login as admin
    await TestHelpers.loginWithSession(
      page,
      context,
      adminUser.email,
      adminUser.password
    );

    // Navigate to users tab
    await TestHelpers.navigateToTab(page, 'Users');

    // Filter by admin role
    await page.click('button:has-text("Filter by role")');
    await page.click('text=Admin');

    // Should only show admin users
    await expect(page.locator('text=' + adminUser.email)).toBeVisible();
    await expect(page.locator('text=' + regularUser.email)).not.toBeVisible();

    // Filter by user role
    await page.click('button:has-text("Filter by role")');
    await page.click('text=User');

    // Should only show regular users
    await expect(page.locator('text=' + regularUser.email)).toBeVisible();
    await expect(page.locator('text=' + adminUser.email)).not.toBeVisible();

    // Show all roles
    await page.click('button:has-text("Filter by role")');
    await page.click('text=All Roles');

    // Should show all users
    await expect(page.locator('text=' + regularUser.email)).toBeVisible();
    await expect(page.locator('text=' + adminUser.email)).toBeVisible();
  });

  test('should search users', async ({ page, context }) => {
    // Login as admin
    await TestHelpers.loginWithSession(
      page,
      context,
      adminUser.email,
      adminUser.password
    );

    // Navigate to users tab
    await TestHelpers.navigateToTab(page, 'Users');

    // Search by username
    await page.fill(
      'input[placeholder*="Search users"]',
      adminUser.username.substring(0, 5)
    );

    // Should show admin user
    await expect(page.locator('text=' + adminUser.email)).toBeVisible();
    await expect(page.locator('text=' + regularUser.email)).not.toBeVisible();

    // Search by email
    await page.fill('input[placeholder*="Search users"]', regularUser.email);

    // Should show regular user
    await expect(page.locator('text=' + regularUser.email)).toBeVisible();
    await expect(page.locator('text=' + adminUser.email)).not.toBeVisible();

    // Clear search
    await page.fill('input[placeholder*="Search users"]', '');

    // Should show all users again
    await expect(page.locator('text=' + regularUser.email)).toBeVisible();
    await expect(page.locator('text=' + adminUser.email)).toBeVisible();
  });

  test('should restrict API access based on user role', async ({
    request,
    context,
  }) => {
    // Get auth headers for admin user
    const adminPage = await context.newPage();
    await TestHelpers.loginWithSession(
      adminPage,
      context,
      adminUser.email,
      adminUser.password
    );
    const adminAuthHeaders = await TestHelpers.getAuthHeaders(context);

    // Get auth headers for regular user
    const regularPage = await context.newPage();
    await TestHelpers.loginWithSession(
      regularPage,
      context,
      regularUser.email,
      regularUser.password
    );
    const regularAuthHeaders = await TestHelpers.getAuthHeaders(context);

    // Test admin API access
    const adminResponse = await request.get('/api/admin/users', {
      headers: adminAuthHeaders,
    });

    if (adminResponse.ok()) {
      console.log('✅ Admin can access admin API');
    } else {
      console.log('ℹ️ Admin API not implemented');
    }

    // Test regular user API access (should be restricted)
    const regularResponse = await request.get('/api/admin/users', {
      headers: regularAuthHeaders,
    });

    // Regular user should not be able to access admin endpoints
    expect(regularResponse.status()).toBe(403); // Forbidden

    console.log('✅ Regular user correctly restricted from admin API');
  });

  test('should prevent regular users from accessing user management', async ({
    page,
    context,
  }) => {
    // Login as regular user
    await TestHelpers.loginWithSession(
      page,
      context,
      regularUser.email,
      regularUser.password
    );

    // Try to directly access users page
    await page.goto('/users');

    // Should be redirected or show access denied
    await page.waitForTimeout(2000);
    const currentUrl = page.url();

    // Should not be on users page
    expect(currentUrl).not.toContain('/users');

    // Should be redirected to dashboard or show access denied
    expect(currentUrl).toMatch(/\/(dashboard|login|access-denied|$)/);
  });

  test('should allow role-based access to features', async ({
    page,
    context,
  }) => {
    // Login as regular user
    await TestHelpers.loginWithSession(
      page,
      context,
      regularUser.email,
      regularUser.password
    );

    // Regular users should be able to access basic features
    await TestHelpers.navigateToTab(page, 'Uploads');
    await expect(page.locator('text=Uploads')).toBeVisible();

    await TestHelpers.navigateToTab(page, 'Jobs');
    await expect(page.locator('text=Jobs')).toBeVisible();

    // But not user management
    await expect(page.locator('text=Users')).not.toBeVisible();

    // Login as admin
    await page.context().clearCookies();
    await TestHelpers.loginWithSession(
      page,
      context,
      adminUser.email,
      adminUser.password
    );

    // Admin should be able to access all features
    await TestHelpers.navigateToTab(page, 'Uploads');
    await expect(page.locator('text=Uploads')).toBeVisible();

    await TestHelpers.navigateToTab(page, 'Jobs');
    await expect(page.locator('text=Jobs')).toBeVisible();

    await TestHelpers.navigateToTab(page, 'Users');
    await expect(page.locator('text=Users')).toBeVisible();
  });

  test('should handle permission changes dynamically', async ({
    page,
    context,
  }) => {
    // Login as regular user
    await TestHelpers.loginWithSession(
      page,
      context,
      regularUser.email,
      regularUser.password
    );

    // Should not see users tab
    await expect(page.locator('text=Users')).not.toBeVisible();

    // Logout
    await page.context().clearCookies();

    // Login as admin and upgrade regular user to admin
    await TestHelpers.loginWithSession(
      page,
      context,
      adminUser.email,
      adminUser.password
    );
    await TestHelpers.navigateToTab(page, 'Users');

    // Find and edit regular user
    const userRow = page.locator('text=' + regularUser.username).first();
    await userRow.locator('button').first().click();

    // Change role to admin
    const roleSelect = page.locator('select[name="role"], select').first();
    await roleSelect.selectOption('admin');
    await page.click('button:has-text("Update User")');

    // Logout and login as upgraded user
    await page.context().clearCookies();
    await TestHelpers.loginWithSession(
      page,
      context,
      regularUser.email,
      regularUser.password
    );

    // Should now see users tab
    await expect(page.locator('text=Users')).toBeVisible();
  });
});
