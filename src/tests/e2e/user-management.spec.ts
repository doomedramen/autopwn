import { test, expect } from '@playwright/test';
import { TestUtils } from './test-utils';

test.describe('User Management', () => {
  test('should show users tab only for admin users', async ({ page }) => {
    // Create a fresh system and superuser for this test
    const superUser = await TestUtils.initializeSystem(page);
    await TestUtils.login(page, superUser.email, superUser.password);

    // Create an admin user
    const adminData = TestUtils.generateTestData();
    await TestUtils.createUser(
      page,
      adminData.username,
      adminData.email,
      adminData.password,
      'admin'
    );

    // Logout and login as admin
    await page.context().clearCookies();
    await TestUtils.login(page, adminData.email, adminData.password);

    // Should see users tab as admin
    await expect(page.locator('text=Users')).toBeVisible();
    const usersTab = page.locator('[role="tab"]:has-text("Users")');
    await expect(usersTab).toBeVisible();
  });

  test('should display user management interface', async ({ page }) => {
    // Create a fresh system and superuser
    const superUser = await TestUtils.initializeSystem(page);
    await TestUtils.login(page, superUser.email, superUser.password);

    // Navigate to users tab
    await TestUtils.navigateToTab(page, 'Users');

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

  test('should create new user successfully', async ({ page }) => {
    // Create a fresh system and superuser
    const superUser = await TestUtils.initializeSystem(page);
    await TestUtils.login(page, superUser.email, superUser.password);

    // Navigate to users tab
    await TestUtils.navigateToTab(page, 'Users');

    // Create test user data
    const userData = TestUtils.generateTestData();

    // Open create user dialog
    await page.click('button:has-text("Add User")');
    await expect(page.locator('text=Create New User')).toBeVisible();

    // Fill user form
    await page.fill('input[placeholder="username"]', userData.username);
    await page.fill('input[placeholder="user@example.com"]', userData.email);
    await page.fill('input[placeholder="Min 8 characters"]', userData.password);
    await page.fill('input[placeholder="Confirm password"]', userData.password);

    // Default role should be "user"
    const roleSelect = page.locator('select').first();
    await expect(roleSelect).toHaveValue('user');

    // Create user
    await page.click('button:has-text("Create User")');

    // Should show success message
    await expect(page.locator('text=User created successfully')).toBeVisible();

    // Dialog should close
    await expect(page.locator('text=Create New User')).not.toBeVisible();

    // New user should appear in table
    await expect(page.locator('text=' + userData.username)).toBeVisible();
    await expect(page.locator('text=' + userData.email)).toBeVisible();
    await expect(page.locator('text=user')).toBeVisible();
  });

  test('should validate user creation form', async ({ page }) => {
    // Create a fresh system and superuser
    const superUser = await TestUtils.initializeSystem(page);
    await TestUtils.login(page, superUser.email, superUser.password);

    // Create an admin user first for the duplicate email test
    const adminData = TestUtils.generateTestData();
    await TestUtils.createUser(
      page,
      adminData.username,
      adminData.email,
      adminData.password,
      'admin'
    );

    // Navigate to users tab
    await TestUtils.navigateToTab(page, 'Users');

    // Open create user dialog
    await page.click('button:has-text("Add User")');

    // Test required fields
    await page.click('button:has-text("Create User")');

    // Should have HTML5 validation
    const usernameInput = page.locator('input[placeholder="username"]');
    const emailInput = page.locator('input[placeholder="user@example.com"]');
    const passwordInput = page.locator('input[placeholder="Min 8 characters"]');
    const confirmPasswordInput = page.locator(
      'input[placeholder="Confirm password"]'
    );

    await expect(usernameInput).toHaveAttribute('required');
    await expect(emailInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('required');
    await expect(confirmPasswordInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('minlength', '8');

    // Test password mismatch
    const testUser1 = TestUtils.generateTestData();
    await page.fill('input[placeholder="username"]', testUser1.username);
    await page.fill('input[placeholder="user@example.com"]', testUser1.email);
    await page.fill('input[placeholder="Min 8 characters"]', 'Password123!');
    await page.fill(
      'input[placeholder="Confirm password"]',
      'DifferentPassword!'
    );
    await page.click('button:has-text("Create User")');

    // Should show error
    await expect(page.locator("text=Passwords don't match")).toBeVisible();

    // Test duplicate email
    const testUser2 = TestUtils.generateTestData();
    await page.fill('input[placeholder="username"]', testUser2.username);
    await page.fill('input[placeholder="user@example.com"]', adminData.email); // Use existing admin email
    await page.fill('input[placeholder="Min 8 characters"]', 'Password123!');
    await page.fill('input[placeholder="Confirm password"]', 'Password123!');
    await page.click('button:has-text("Create User")');

    // Should show error
    await expect(page.locator('text=Email already registered')).toBeVisible();
  });

  test('should edit user information', async ({ page }) => {
    // Create a fresh system and superuser
    const superUser = await TestUtils.initializeSystem(page);
    await TestUtils.login(page, superUser.email, superUser.password);

    // Create a test user first
    const userData = TestUtils.generateTestData();
    await TestUtils.createUser(
      page,
      userData.username,
      userData.email,
      userData.password,
      'user'
    );

    // Navigate to users tab
    await TestUtils.navigateToTab(page, 'Users');

    // Find and edit test user
    const userRow = page.locator('text=' + userData.username).first();
    await expect(userRow).toBeVisible();

    // Click edit button
    await userRow.locator('button').first().click();

    // Should open edit dialog
    await expect(page.locator('text=Edit User')).toBeVisible();

    // Update user information
    const updatedData = TestUtils.generateTestData();
    await page.fill('input[placeholder="user@example.com"]', updatedData.email);
    await page.fill('input[placeholder="username"]', updatedData.username);

    // Save changes
    await page.click('button:has-text("Update User")');

    // Should show success message
    await expect(page.locator('text=User updated successfully')).toBeVisible();

    // Updated information should appear in table
    await expect(page.locator('text=' + updatedData.username)).toBeVisible();
    await expect(page.locator('text=' + updatedData.email)).toBeVisible();
  });

  test('should toggle user active status', async ({ page }) => {
    // Create a fresh system and superuser
    const superUser = await TestUtils.initializeSystem(page);
    await TestUtils.login(page, superUser.email, superUser.password);

    // Create a test user first
    const userData = TestUtils.generateTestData();
    await TestUtils.createUser(
      page,
      userData.username,
      userData.email,
      userData.password,
      'user'
    );

    // Navigate to users tab
    await TestUtils.navigateToTab(page, 'Users');

    // Find the test user
    const userRow = page.locator('text=' + userData.username).first();
    await expect(userRow).toBeVisible();

    // Find and click the status toggle
    const statusToggle = userRow.locator('input[type="checkbox"]');
    await expect(statusToggle).toBeChecked(); // Should be active by default

    // Deactivate user
    await statusToggle.click();

    // Should show success message
    await expect(
      page.locator('text=User deactivated successfully')
    ).toBeVisible();

    // Toggle should be unchecked
    await expect(statusToggle).not.toBeChecked();

    // Reactivate user
    await statusToggle.click();
    await expect(
      page.locator('text=User activated successfully')
    ).toBeVisible();
    await expect(statusToggle).toBeChecked();
  });

  test('should prevent editing superuser account', async ({ page }) => {
    // Create a fresh system and superuser
    const superUser = await TestUtils.initializeSystem(page);
    await TestUtils.login(page, superUser.email, superUser.password);

    // Navigate to users tab
    await TestUtils.navigateToTab(page, 'Users');

    // Find superuser row
    const superUserRow = page.locator('text=' + superUser.username).first();
    await expect(superUserRow).toBeVisible();

    // Should not have edit button for superuser when editing self
    const editButton = superUserRow.locator('button').first();
    await expect(editButton).not.toBeVisible();

    // Status toggle should be disabled for superuser
    const statusToggle = superUserRow.locator('input[type="checkbox"]');
    await expect(statusToggle).toBeDisabled();
  });

  test('should filter users by role', async ({ page }) => {
    // Create a fresh system and superuser
    const superUser = await TestUtils.initializeSystem(page);
    await TestUtils.login(page, superUser.email, superUser.password);

    // Create admin and regular users
    const adminData = TestUtils.generateTestData();
    const regularUserData = TestUtils.generateTestData();

    await TestUtils.createUser(
      page,
      adminData.username,
      adminData.email,
      adminData.password,
      'admin'
    );
    await TestUtils.createUser(
      page,
      regularUserData.username,
      regularUserData.email,
      regularUserData.password,
      'user'
    );

    // Navigate to users tab
    await TestUtils.navigateToTab(page, 'Users');

    // Filter by admin role
    await page.click('button:has-text("Filter by role")');
    await page.click('text=Admin');

    // Should only show admin users
    await expect(page.locator('text=' + adminData.email)).toBeVisible();
    await expect(
      page.locator('text=' + regularUserData.email)
    ).not.toBeVisible();

    // Filter by user role
    await page.click('button:has-text("Filter by role")');
    await page.click('text=User');

    // Should only show regular users
    await expect(page.locator('text=' + regularUserData.email)).toBeVisible();
    await expect(page.locator('text=' + adminData.email)).not.toBeVisible();

    // Show all roles
    await page.click('button:has-text("Filter by role")');
    await page.click('text=All Roles');

    // Should show all users
    await expect(page.locator('text=' + regularUserData.email)).toBeVisible();
    await expect(page.locator('text=' + adminData.email)).toBeVisible();
  });

  test('should search users', async ({ page }) => {
    // Create a fresh system and superuser
    const superUser = await TestUtils.initializeSystem(page);
    await TestUtils.login(page, superUser.email, superUser.password);

    // Create admin and regular users
    const adminData = TestUtils.generateTestData();
    const regularUserData = TestUtils.generateTestData();

    await TestUtils.createUser(
      page,
      adminData.username,
      adminData.email,
      adminData.password,
      'admin'
    );
    await TestUtils.createUser(
      page,
      regularUserData.username,
      regularUserData.email,
      regularUserData.password,
      'user'
    );

    // Navigate to users tab
    await TestUtils.navigateToTab(page, 'Users');

    // Search by username
    await page.fill(
      'input[placeholder*="Search users"]',
      adminData.username.substring(0, 5)
    );

    // Should show admin user
    await expect(page.locator('text=' + adminData.email)).toBeVisible();
    await expect(
      page.locator('text=' + regularUserData.email)
    ).not.toBeVisible();

    // Search by email
    await page.fill(
      'input[placeholder*="Search users"]',
      regularUserData.email
    );

    // Should show regular user
    await expect(page.locator('text=' + regularUserData.email)).toBeVisible();
    await expect(page.locator('text=' + adminData.email)).not.toBeVisible();

    // Clear search
    await page.fill('input[placeholder*="Search users"]', '');

    // Should show all users again
    await expect(page.locator('text=' + regularUserData.email)).toBeVisible();
    await expect(page.locator('text=' + adminData.email)).toBeVisible();
  });
});
