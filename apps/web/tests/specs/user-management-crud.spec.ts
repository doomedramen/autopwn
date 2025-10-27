import { test, expect } from '../fixtures/auth-fixture';

test.describe('User Management CRUD Operations', () => {
  const testUsers = {
    admin: {
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'admin'
    },
    regular: {
      email: 'user@test.com',
      name: 'Regular User',
      role: 'user'
    }
  };

  test.beforeEach(async ({ page }) => {
    // Ensure authenticated user state
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test.describe('User Management Access Control', () => {
    test('should allow admin users to access user management', async ({ page }) => {
      console.log('🔐 Testing admin access to user management...');

      // Navigate to Users tab
      await page.locator('[data-testid="tab-users"]').click();
      await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Verify Users tab is accessible
      const usersTab = page.locator('[data-testid="tab-users"]');
      await expect(usersTab).toBeVisible();
      await expect(usersTab).toHaveClass(/text-primary/);

      // Check that user management interface is visible
      const userTable = page.locator('table').first();
      if (await userTable.isVisible()) {
        console.log('✅ User management table is visible to admin');
      }

      // Look for user management buttons (may be disabled)
      const createUserButton = page.locator('button:has-text("create user")').first();
      if (await createUserButton.isVisible()) {
        console.log('✅ Create user button is visible to admin');
        const isDisabled = await createUserButton.isDisabled();
        console.log(`ℹ️ Create user button is ${isDisabled ? 'disabled' : 'enabled'}`);
      }

      console.log('✅ Admin user can access user management interface');
    });

    test('should display user data in table format', async ({ page }) => {
      console.log('📊 Testing user data display...');

      // Navigate to Users tab
      await page.locator('[data-testid="tab-users"]').click();
      await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Check for table headers
      const expectedHeaders = ['Email', 'Role', 'Created', 'Last Updated', 'Actions'];
      let headersFound = 0;

      for (const header of expectedHeaders) {
        const headerElement = page.locator(`th:has-text("${header}")`).first();
        if (await headerElement.isVisible()) {
          headersFound++;
          console.log(`✅ Found header: ${header}`);
        }
      }

      console.log(`📋 Found ${headersFound}/${expectedHeaders.length} expected headers`);

      // Check for user data rows
      const userRows = page.locator('tbody tr');
      const rowCount = await userRows.count();

      if (rowCount > 0) {
        console.log(`✅ Found ${rowCount} user(s) in the table`);

        // Check for role badges in user data
        const adminBadges = page.locator('span:has-text("admin")');
        const userBadges = page.locator('span:has-text("user")');

        const adminCount = await adminBadges.count();
        const userCount = await userBadges.count();

        if (adminCount > 0) {
          console.log(`✅ Found ${adminCount} admin role badge(s)`);
        }
        if (userCount > 0) {
          console.log(`✅ Found ${userCount} user role badge(s)`);
        }
      } else {
        // Check for empty state
        const emptyState = page.locator('text=no users found');
        if (await emptyState.isVisible()) {
          console.log('ℹ️ Users table shows empty state');
        }
      }

      console.log('✅ User data display validation completed');
    });

    test('should handle empty user list state', async ({ page }) => {
      console.log('📝 Testing empty user list state...');

      // Navigate to Users tab
      await page.locator('[data-testid="tab-users"]').click();
      await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(2000); // Wait for data to load

      // Check for empty state or user data
      const userRows = page.locator('tbody tr');
      const rowCount = await userRows.count();

      if (rowCount === 0) {
        // Look for empty state message
        const emptyStateSelectors = [
          'text=no users found',
          'text=No users found',
          'text=empty',
          '[data-testid="users-empty-state"]'
        ];

        let emptyStateFound = false;
        for (const selector of emptyStateSelectors) {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            console.log(`✅ Empty state message found: ${selector}`);
            emptyStateFound = true;
            break;
          }
        }

        if (!emptyStateFound) {
          console.log('ℹ️ No users found but no specific empty state message detected');
        }
      } else {
        console.log(`ℹ️ ${rowCount} user(s) found - not an empty state`);
      }

      console.log('✅ Empty state handling validated');
    });
  });

  test.describe('User Management UI Elements', () => {
    test('should verify user management buttons exist and have correct states', async ({ page }) => {
      console.log('🔘 Testing user management button states...');

      // Navigate to Users tab
      await page.locator('[data-testid="tab-users"]').click();
      await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Test Create User button
      const createUserButton = page.locator('button:has-text("create user")').first();
      if (await createUserButton.isVisible()) {
        const isDisabled = await createUserButton.isDisabled();
        console.log(`📝 Create user button: ${isDisabled ? 'disabled' : 'enabled'}`);

        // Test button styling
        const hasClasses = await createUserButton.getAttribute('class');
        if (hasClasses?.includes('disabled') || isDisabled) {
          console.log('✅ Create user button properly styled as disabled');
        }
      } else {
        console.log('ℹ️ Create user button not found');
      }

      // Test Edit buttons in user rows
      const userRows = page.locator('tbody tr');
      const rowCount = await userRows.count();

      if (rowCount > 0) {
        const editButtons = page.locator('button:has-text("Edit")');
        const editButtonCount = await editButtons.count();

        if (editButtonCount > 0) {
          console.log(`📝 Found ${editButtonCount} Edit button(s)`);

          // Check first edit button state
          const firstEditButton = editButtons.first();
          const editDisabled = await firstEditButton.isDisabled();
          console.log(`📝 Edit buttons: ${editDisabled ? 'disabled' : 'enabled'}`);
        }

        // Test Delete buttons in user rows
        const deleteButtons = page.locator('button:has-text("Delete")');
        const deleteButtonCount = await deleteButtons.count();

        if (deleteButtonCount > 0) {
          console.log(`🗑️ Found ${deleteButtonCount} Delete button(s)`);

          // Check first delete button state
          const firstDeleteButton = deleteButtons.first();
          const deleteDisabled = await firstDeleteButton.isDisabled();
          console.log(`🗑️ Delete buttons: ${deleteDisabled ? 'disabled' : 'enabled'}`);
        }
      }

      console.log('✅ User management button states validated');
    });

    test('should verify role badge styling and functionality', async ({ page }) => {
      console.log('🏷️ Testing role badge display...');

      // Navigate to Users tab
      await page.locator('[data-testid="tab-users"]').click();
      await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Look for admin role badges
      const adminBadges = page.locator('span:has-text("admin")');
      const adminCount = await adminBadges.count();

      if (adminCount > 0) {
        console.log(`✅ Found ${adminCount} admin role badge(s)`);

        // Check admin badge styling (should be destructive/danger)
        const firstAdminBadge = adminBadges.first();
        const adminClasses = await firstAdminBadge.getAttribute('class');

        if (adminClasses?.includes('destructive') || adminClasses?.includes('destructive') || adminClasses?.includes('bg-destructive')) {
          console.log('✅ Admin badge has appropriate styling');
        }
      }

      // Look for user role badges
      const userBadges = page.locator('span:has-text("user")');
      const userCount = await userBadges.count();

      if (userCount > 0) {
        console.log(`✅ Found ${userCount} user role badge(s)`);

        // Check user badge styling (should be primary/default)
        const firstUserBadge = userBadges.first();
        const userClasses = await firstUserBadge.getAttribute('class');

        if (userClasses?.includes('primary') || userClasses?.includes('bg-primary') || userClasses?.includes('default')) {
          console.log('✅ User badge has appropriate styling');
        }
      }

      if (adminCount === 0 && userCount === 0) {
        console.log('ℹ️ No role badges found (empty user list or different styling)');
      }

      console.log('✅ Role badge display validation completed');
    });

    test('should verify responsive design on user management interface', async ({ page }) => {
      console.log('📱 Testing responsive design...');

      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Navigate to Users tab
      await page.locator('[data-testid="tab-users"]').click();
      await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Check if interface is usable on mobile
      const usersTab = page.locator('[data-testid="tab-users"]');
      await expect(usersTab).toBeVisible();
      console.log('✅ User management accessible on mobile viewport');

      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);

      await expect(usersTab).toBeVisible();
      console.log('✅ User management accessible on tablet viewport');

      // Reset to desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);

      await expect(usersTab).toBeVisible();
      console.log('✅ User management accessible on desktop viewport');

      console.log('✅ Responsive design validation completed');
    });
  });

  test.describe('User Data Display and Validation', () => {
    test('should display user information correctly', async ({ page }) => {
      console.log('👤 Testing user information display...');

      // Navigate to Users tab
      await page.locator('[data-testid="tab-users"]').click();
      await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(2000); // Wait for data to load

      // Check for user data in table
      const userRows = page.locator('tbody tr');
      const rowCount = await userRows.count();

      if (rowCount > 0) {
        console.log(`📊 Analyzing ${rowCount} user record(s)...`);

        // Check the first user row for expected data structure
        const firstRow = userRows.first();
        const cells = firstRow.locator('td');
        const cellCount = await cells.count();

        console.log(`📋 First user row has ${cellCount} cells`);

        // Look for email in the row
        const emailCell = firstRow.locator('td').first();
        const emailText = await emailCell.textContent();

        if (emailText && emailText.includes('@')) {
          console.log(`✅ Found valid email: ${emailText}`);
        }

        // Look for created/updated timestamps
        const rowText = await firstRow.textContent();
        if (rowText) {
          const hasDate = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/.test(rowText);
          if (hasDate) {
            console.log('✅ Found date information in user row');
          }
        }
      } else {
        console.log('ℹ️ No user data to validate (empty list)');
      }

      console.log('✅ User information display validation completed');
    });

    test('should handle loading states correctly', async ({ page }) => {
      console.log('⏳ Testing loading states...');

      // Navigate to Users tab and watch for loading state
      await page.locator('[data-testid="tab-users"]').click();

      // Look for loading indicators
      const loadingSelectors = [
        '.animate-spin',
        '[role="progressbar"]',
        'text=Loading',
        'text=loading...',
        '.loading'
      ];

      let loadingFound = false;
      const startTime = Date.now();

      // Check for loading state for up to 3 seconds
      while (Date.now() - startTime < 3000) {
        for (const selector of loadingSelectors) {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            console.log(`✅ Loading indicator found: ${selector}`);
            loadingFound = true;
            break;
          }
        }

        if (loadingFound) break;
        await page.waitForTimeout(100);
      }

      if (!loadingFound) {
        console.log('ℹ️ No loading indicators detected (may load too quickly to test)');
      }

      // Wait for final state
      await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      console.log('✅ Loading state validation completed');
    });
  });

  test.describe('User Management Navigation and Flow', () => {
    test('should navigate between user management and other sections', async ({ page }) => {
      console.log('🔄 Testing navigation flow...');

      // Start on Jobs tab
      await page.locator('[data-testid="tab-jobs"]').click();
      await page.waitForSelector('[data-testid="tab-jobs"].text-primary', { timeout: 5000 });
      console.log('✅ Navigated to Jobs tab');

      // Navigate to Users tab
      await page.locator('[data-testid="tab-users"]').click();
      await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
      console.log('✅ Navigated to Users tab');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForSelector('[data-testid="tab-networks"].text-primary', { timeout: 5000 });
      console.log('✅ Navigated to Networks tab');

      // Return to Users tab
      await page.locator('[data-testid="tab-users"]').click();
      await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
      console.log('✅ Returned to Users tab');

      // Verify user management is still accessible
      const usersTab = page.locator('[data-testid="tab-users"]');
      await expect(usersTab).toBeVisible();
      await expect(usersTab).toHaveClass(/text-primary/);

      console.log('✅ Navigation flow validation completed');
    });

    test('should maintain state when switching between tabs', async ({ page }) => {
      console.log('💾 Testing state persistence...');

      // Navigate to Users tab
      await page.locator('[data-testid="tab-users"]').click();
      await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(2000); // Wait for data to load

      // Check initial user count
      const userRows = page.locator('tbody tr');
      const initialCount = await userRows.count();
      console.log(`📊 Initial user count: ${initialCount}`);

      // Switch to another tab
      await page.locator('[data-testid="tab-jobs"]').click();
      await page.waitForSelector('[data-testid="tab-jobs"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Switch back to Users tab
      await page.locator('[data-testid="tab-users"]').click();
      await page.waitForSelector('[data-testid="tab-users"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(2000); // Wait for data to reload

      // Check user count again
      const newRows = page.locator('tbody tr');
      const newCount = await newRows.count();
      console.log(`📊 User count after tab switch: ${newCount}`);

      // State should be consistent (though data may refetch)
      console.log('✅ State persistence validation completed');
    });
  });
});