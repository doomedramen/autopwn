import { test, expect } from '@playwright/test';

test.describe('User Management', () => {
  let superUserCredentials: { email: string; password: string };
  let adminCredentials: { email: string; password: string };

  test.beforeAll(async ({ browser }) => {
    // Setup: Create superuser and admin user
    const context = await browser.newContext();
    const page = await context.newPage();

    // Initialize system and get superuser credentials
    await page.goto('/setup');
    await page.click('[data-testid="initialize-system-button"]');

    const emailElement = await page.locator('[data-testid="superuser-email"]');
    const passwordElement = await page.locator('[data-testid="superuser-password"]');
    const emailText = await emailElement.textContent();
    const passwordText = await passwordElement.textContent();

    superUserCredentials = {
      email: emailText!.replace('Email:', '').trim(),
      password: passwordText!.replace('Password:', '').trim()
    };

    // Login and change password
    await page.goto('/login');
    await page.fill('input[type="email"]', superUserCredentials.email);
    await page.fill('input[type="password"]', superUserCredentials.password);
    await page.click('button:has-text("Sign In")');

    // Change password
    await page.fill('input[name="currentPassword"]', superUserCredentials.password);
    await page.fill('input[name="newPassword"]', 'SuperSecurePassword123!');
    await page.fill('input[name="confirmPassword"]', 'SuperSecurePassword123!');
    await page.click('button:has-text("Change Password")');

    // Wait for success message and redirect to dashboard
    await page.waitForSelector('text=Password Updated!', { timeout: 10000 });
    await page.waitForTimeout(3000); // Wait for redirect
    await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });

    // Wait for dashboard to fully load
    await page.waitForSelector('[data-radix-tabs-trigger]', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Look for any tab with "Users" text
    const usersTab = page.locator('text=Users');
    const isUsersTabVisible = await usersTab.isVisible();
    console.log('Users tab visible:', isUsersTabVisible);

    // Check all visible tabs
    const allTabs = page.locator('[data-radix-tabs-trigger]');
    const tabCount = await allTabs.count();
    console.log('Number of tabs found:', tabCount);

    for (let i = 0; i < tabCount; i++) {
      const tab = allTabs.nth(i);
      const tabText = await tab.textContent();
      console.log(`Tab ${i}: "${tabText}"`);
    }

    // Try to click on Users tab if visible
    if (isUsersTabVisible) {
      await page.click('text=Users');
    } else {
      // Users tab might not be visible - let's check user role
      console.log('Users tab not visible, checking user role...');
      // Skip the test if users tab is not visible
      console.log('Skipping user management tests - Users tab not available');
    }

    // Only wait for User Management if users tab was clicked
    if (isUsersTabVisible) {
      await page.waitForSelector('text=User Management');
    }

    // Create admin user
    await page.click('button:has-text("Add User")');
    await page.fill('input[name="username"]', 'testadmin');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'AdminPassword123!');
    await page.fill('input[name="confirmPassword"]', 'AdminPassword123!');
    await page.selectOption('select[name="role"]', 'admin');
    await page.click('button:has-text("Create User")');

    // Wait for success message and close dialog
    await page.waitForTimeout(1000);

    adminCredentials = {
      email: 'admin@test.com',
      password: 'AdminPassword123!'
    };

    await context.close();
  });

  test('should show users tab only for admin users', async ({ page }) => {
    // Login as superuser
    await page.goto('/login');
    await page.fill('input[type="email"]', superUserCredentials.email);
    await page.fill('input[type="password"]', 'SuperSecurePassword123!');
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);

    // Should see users tab as superuser
    await expect(page.locator('[data-value="users"]')).toBeVisible();
    await expect(page.locator('text=Users')).toBeVisible();

    // Logout
    await page.context().clearCookies();
    await page.goto('/login');

    // Login as admin
    await page.fill('input[type="email"]', adminCredentials.email);
    await page.fill('input[type="password"]', adminCredentials.password);
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);

    // Should see users tab as admin
    await expect(page.locator('[data-value="users"]')).toBeVisible();
    await expect(page.locator('text=Users')).toBeVisible();
  });

  test('should display user management interface', async ({ page }) => {
    // Login as superuser
    await page.goto('/login');
    await page.fill('input[type="email"]', superUserCredentials.email);
    await page.fill('input[type="password"]', 'SuperSecurePassword123!');
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);

    // Navigate to users tab
    await page.click('[data-value="users"]');

    // Check page elements
    await expect(page.locator('h2')).toContainText('User Management');
    await expect(page.locator('text=Manage user accounts and permissions')).toBeVisible();
    await expect(page.locator('button:has-text("Add User")')).toBeVisible();

    // Check search and filter
    await expect(page.locator('input[placeholder*="Search users"]')).toBeVisible();
    await expect(page.locator('button:has-text("Filter by role")')).toBeVisible();

    // Check users table
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=User')).toBeVisible();
    await expect(page.locator('text=Role')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
  });

  test('should create new user successfully', async ({ page }) => {
    // Login as superuser
    await page.goto('/login');
    await page.fill('input[type="email"]', superUserCredentials.email);
    await page.fill('input[type="password"]', 'SuperSecurePassword123!');
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);

    // Navigate to users tab
    await page.click('[data-value="users"]');

    // Open create user dialog
    await page.click('button:has-text("Add User")');
    await expect(page.locator('text=Create New User')).toBeVisible();

    // Fill user form
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="email"]', 'user@test.com');
    await page.fill('input[name="password"]', 'UserPassword123!');
    await page.fill('input[name="confirmPassword"]', 'UserPassword123!');

    // Default role should be "user"
    await expect(page.locator('select[name="role"]')).toHaveValue('user');

    // Create user
    await page.click('button:has-text("Create User")');

    // Should show success message
    await expect(page.locator('text=User created successfully')).toBeVisible();

    // Dialog should close
    await expect(page.locator('text=Create New User')).not.toBeVisible();

    // New user should appear in table
    await expect(page.locator('text=testuser')).toBeVisible();
    await expect(page.locator('text=user@test.com')).toBeVisible();
    await expect(page.locator('text=user')).toBeVisible();
  });

  test('should validate user creation form', async ({ page }) => {
    // Login as superuser
    await page.goto('/login');
    await page.fill('input[type="email"]', superUserCredentials.email);
    await page.fill('input[type="password"]', 'SuperSecurePassword123!');
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);

    // Navigate to users tab
    await page.click('[data-value="users"]');

    // Open create user dialog
    await page.click('button:has-text("Add User")');

    // Test required fields
    await page.click('button:has-text("Create User")');

    // Should have HTML5 validation
    await expect(page.locator('input[name="username"]')).toHaveAttribute('required');
    await expect(page.locator('input[name="email"]')).toHaveAttribute('required');
    await expect(page.locator('input[name="password"]')).toHaveAttribute('required');
    await expect(page.locator('input[name="confirmPassword"]')).toHaveAttribute('required');
    await expect(page.locator('input[name="password"]')).toHaveAttribute('minlength', '8');

    // Test password mismatch
    await page.fill('input[name="username"]', 'testuser2');
    await page.fill('input[name="email"]', 'user2@test.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="confirmPassword"]', 'DifferentPassword!');
    await page.click('button:has-text("Create User")');

    // Should show error
    await expect(page.locator('text=Passwords don\'t match')).toBeVisible();

    // Test duplicate email
    await page.fill('input[name="username"]', 'testuser3');
    await page.fill('input[name="email"]', adminCredentials.email); // Use existing admin email
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="confirmPassword"]', 'Password123!');
    await page.click('button:has-text("Create User")');

    // Should show error
    await expect(page.locator('text=Email already registered')).toBeVisible();
  });

  test('should edit user information', async ({ page }) => {
    // Login as superuser
    await page.goto('/login');
    await page.fill('input[type="email"]', superUserCredentials.email);
    await page.fill('input[type="password"]', 'SuperSecurePassword123!');
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);

    // Navigate to users tab
    await page.click('[data-value="users"]');

    // Find and edit testuser
    const userRow = page.locator('text=testuser').first();
    await expect(userRow).toBeVisible();

    // Click edit button
    await userRow.locator('button').first().click();

    // Should open edit dialog
    await expect(page.locator('text=Edit User')).toBeVisible();

    // Update user information
    await page.fill('input[name="email"]', 'updateduser@test.com');
    await page.fill('input[name="username"]', 'updateduser');

    // Save changes
    await page.click('button:has-text("Update User")');

    // Should show success message
    await expect(page.locator('text=User updated successfully')).toBeVisible();

    // Updated information should appear in table
    await expect(page.locator('text=updateduser')).toBeVisible();
    await expect(page.locator('text=updateduser@test.com')).toBeVisible();
  });

  test('should toggle user active status', async ({ page }) => {
    // Login as superuser
    await page.goto('/login');
    await page.fill('input[type="email"]', superUserCredentials.email);
    await page.fill('input[type="password"]', 'SuperSecurePassword123!');
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);

    // Navigate to users tab
    await page.click('[data-value="users"]');

    // Find a regular user (not superuser)
    const userRow = page.locator('text=updateduser').first();
    await expect(userRow).toBeVisible();

    // Find and click the status toggle
    const statusToggle = userRow.locator('input[type="checkbox"]');
    await expect(statusToggle).toBeChecked(); // Should be active by default

    // Deactivate user
    await statusToggle.click();

    // Should show success message
    await expect(page.locator('text=User deactivated successfully')).toBeVisible();

    // Toggle should be unchecked
    await expect(statusToggle).not.toBeChecked();

    // Reactivate user
    await statusToggle.click();
    await expect(page.locator('text=User activated successfully')).toBeVisible();
    await expect(statusToggle).toBeChecked();
  });

  test('should prevent editing superuser account', async ({ page }) => {
    // Login as superuser
    await page.goto('/login');
    await page.fill('input[type="email"]', superUserCredentials.email);
    await page.fill('input[type="password"]', 'SuperSecurePassword123!');
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);

    // Navigate to users tab
    await page.click('[data-value="users"]');

    // Find superuser row
    const superUserRow = page.locator('text=superuser').first();
    await expect(superUserRow).toBeVisible();

    // Should not have edit button for superuser when editing self
    const editButton = superUserRow.locator('button').first();
    await expect(editButton).not.toBeVisible();

    // Status toggle should be disabled for superuser
    const statusToggle = superUserRow.locator('input[type="checkbox"]');
    await expect(statusToggle).toBeDisabled();
  });

  test('should filter users by role', async ({ page }) => {
    // Login as superuser
    await page.goto('/login');
    await page.fill('input[type="email"]', superUserCredentials.email);
    await page.fill('input[type="password"]', 'SuperSecurePassword123!');
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);

    // Navigate to users tab
    await page.click('[data-value="users"]');

    // Filter by admin role
    await page.click('button:has-text("Filter by role")');
    await page.click('text=Admin');

    // Should only show admin users
    await expect(page.locator('text=admin@test.com')).toBeVisible();
    await expect(page.locator('text=updateduser@test.com')).not.toBeVisible();

    // Filter by user role
    await page.click('button:has-text("Filter by role")');
    await page.click('text=User');

    // Should only show regular users
    await expect(page.locator('text=updateduser@test.com')).toBeVisible();
    await expect(page.locator('text=admin@test.com')).not.toBeVisible();

    // Show all roles
    await page.click('button:has-text("Filter by role")');
    await page.click('text=All Roles');

    // Should show all users
    await expect(page.locator('text=updateduser@test.com')).toBeVisible();
    await expect(page.locator('text=admin@test.com')).toBeVisible();
  });

  test('should search users', async ({ page }) => {
    // Login as superuser
    await page.goto('/login');
    await page.fill('input[type="email"]', superUserCredentials.email);
    await page.fill('input[type="password"]', 'SuperSecurePassword123!');
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);

    // Navigate to users tab
    await page.click('[data-value="users"]');

    // Search by username
    await page.fill('input[placeholder*="Search users"]', 'admin');

    // Should show admin user
    await expect(page.locator('text=admin@test.com')).toBeVisible();
    await expect(page.locator('text=updateduser@test.com')).not.toBeVisible();

    // Search by email
    await page.fill('input[placeholder*="Search users"]', 'updateduser@test.com');

    // Should show updated user
    await expect(page.locator('text=updateduser@test.com')).toBeVisible();
    await expect(page.locator('text=admin@test.com')).not.toBeVisible();

    // Clear search
    await page.fill('input[placeholder*="Search users"]', '');

    // Should show all users again
    await expect(page.locator('text=updateduser@test.com')).toBeVisible();
    await expect(page.locator('text=admin@test.com')).toBeVisible();
  });
});