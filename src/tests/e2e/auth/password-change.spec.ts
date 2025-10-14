import { test, expect } from '@playwright/test';
import { TestHelpers } from '../helpers/test-helpers';

test.describe('Password Change', () => {
  test('should require password change on first login', async ({ page }) => {
    const user = await TestHelpers.initializeSystem(page);

    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button:has-text("Sign In")');

    // Should be redirected to change password page
    await expect(page).toHaveURL(/.*\/change-password/, { timeout: 10000 });

    // Change password
    const newPassword = 'NewTestPassword123!';
    await page.fill('input[name="currentPassword"]', user.password);
    await page.fill('input[name="newPassword"]', newPassword);
    await page.fill('input[name="confirmPassword"]', newPassword);
    await page.click('button:has-text("Change Password")');

    // Wait for success message and redirect
    await page.waitForSelector('text=Password Updated!', { timeout: 10000 });
    await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });
  });

  test('should validate password requirements', async ({ page }) => {
    const user = await TestHelpers.initializeSystem(page);

    // Login and get to password change page
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button:has-text("Sign In")');

    await expect(page).toHaveURL(/.*\/change-password/, { timeout: 10000 });

    // Test password mismatch
    await page.fill('input[name="currentPassword"]', user.password);
    await page.fill('input[name="newPassword"]', 'NewPassword123!');
    await page.fill('input[name="confirmPassword"]', 'DifferentPassword!');
    await page.click('button:has-text("Change Password")');

    // Should show error
    await expect(page.locator("text=Passwords don't match")).toBeVisible();

    // Test password too short
    await page.fill('input[name="newPassword"]', '123');
    await page.fill('input[name="confirmPassword"]', '123');
    await page.click('button:has-text("Change Password")');

    // Should show validation error or password requirements
    await page.waitForTimeout(1000);
  });

  test('should successfully change password', async ({ page }) => {
    const user = await TestHelpers.initializeSystem(page);

    // Login and get to password change page
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button:has-text("Sign In")');

    await expect(page).toHaveURL(/.*\/change-password/, { timeout: 10000 });

    // Change password
    const newPassword = 'SecureNewPassword123!';
    await page.fill('input[name="currentPassword"]', user.password);
    await page.fill('input[name="newPassword"]', newPassword);
    await page.fill('input[name="confirmPassword"]', newPassword);
    await page.click('button:has-text("Change Password")');

    // Wait for success message and redirect
    await page.waitForSelector('text=Password Updated!', { timeout: 10000 });
    await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });

    // Verify new password works by logging out and back in
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', newPassword);
    await page.click('button:has-text("Sign In")');

    // Should login successfully without password change prompt
    await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });
  });
});
