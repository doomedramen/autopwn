import { test, expect } from '@playwright/test';
import { TestUtils } from './test-utils';

test.describe('Auth Disabled Mode', () => {
  test('should bypass login and access dashboard directly', async ({
    page,
  }) => {
    // This test verifies that auth disabled mode works without requiring user creation

    console.log('🚀 Testing auth disabled mode...');

    // Should be able to go directly to dashboard without login
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Should see dashboard content
    await expect(page.locator('h1')).toContainText('AutoPWN');

    // Should be able to navigate to different tabs
    await TestUtils.navigateToTab(page, 'Networks');
    // Verify Networks tab is active (content loaded)
    await expect(
      page.locator('[role="tab"][aria-selected="true"]:has-text("Networks")')
    ).toBeVisible();

    await TestUtils.navigateToTab(page, 'Dicts');
    // Verify Dicts tab is active (content loaded)
    await expect(
      page.locator('[role="tab"][aria-selected="true"]:has-text("Dicts")')
    ).toBeVisible();

    await TestUtils.navigateToTab(page, 'Jobs');
    // Verify Jobs tab is active (content loaded)
    await expect(
      page.locator('[role="tab"][aria-selected="true"]:has-text("Jobs")')
    ).toBeVisible();

    // Should be able to access Users tab (which requires admin permissions in normal mode)
    await TestUtils.navigateToTab(page, 'Users');
    // Verify Users tab is active (content loaded)
    await expect(
      page.locator('[role="tab"][aria-selected="true"]:has-text("Users")')
    ).toBeVisible();

    console.log('✅ Auth disabled mode working correctly!');
  });

  test('should create user via API directly in auth disabled mode', async ({
    page,
  }) => {
    // This test verifies that the API endpoints work in auth disabled mode

    console.log('🚀 Testing user creation API in auth disabled mode...');

    // Create a user via direct API call
    const userData = TestUtils.generateTestData();

    const response = await page.request.post('/api/admin/users', {
      data: {
        email: userData.email,
        username: userData.username,
        password: userData.password,
        role: 'user',
      },
    });

    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.user.email).toBe(userData.email);
    expect(result.data.user.name).toBe(userData.username);
    expect(result.data.profile.role).toBe('user');

    console.log(
      '✅ User creation API working correctly in auth disabled mode!'
    );
  });
});
