import { Page, BrowserContext } from '@playwright/test';

/**
 * Test utilities for common e2e operations
 * Simplified approach with true test isolation
 */

export class TestUtils {
  /**
   * Initialize the system (create superuser) or bypass for no-auth mode
   * Each test calls this to get its own fresh system
   */
  static async initializeSystem(
    page: Page
  ): Promise<{ email: string; password: string; username: string }> {
    console.log('🚀 Initializing system...');

    // If auth is disabled, return mock credentials
    if (process.env.DISABLE_AUTH === 'true') {
      console.log('🔓 Auth disabled - using mock credentials');
      return {
        email: 'test@autopwn.local',
        password: 'TestPassword123!',
        username: 'testuser',
      };
    }

    await page.goto('/setup');
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Check if initialize button exists
    const initButton = page.locator('[data-testid="initialize-system-button"]');
    const initButtonExists = await initButton.isVisible().catch(() => false);

    if (!initButtonExists) {
      // If system is already initialized, try to use existing superuser credentials
      console.log('🔄 System already initialized, using existing superuser...');

      // Use the standard test credentials that should exist
      const credentials = {
        email: 'superuser@autopwn.local',
        password: 'TestPassword123!',
        username: 'superuser',
      };

      console.log('✅ Using existing system credentials');
      return credentials;
    }

    // Click initialize button and get credentials
    await initButton.click();

    await page.waitForSelector('[data-testid="superuser-email"]', {
      timeout: 10000,
    });
    await page.waitForSelector('[data-testid="superuser-password"]', {
      timeout: 10000,
    });

    const emailElement = await page.locator('[data-testid="superuser-email"]');
    const passwordElement = await page.locator(
      '[data-testid="superuser-password"]'
    );
    const emailText = await emailElement.textContent();
    const passwordText = await passwordElement.textContent();

    const credentials = {
      email: emailText!.replace('Email:', '').trim(),
      password: passwordText!.replace('Password:', '').trim(),
      username: 'superuser', // Default username for generated superuser
    };

    console.log('✅ System initialized successfully');
    return credentials;
  }

  /**
   * Login and handle password change if needed
   * Works with both auth modes
   */
  static async login(
    page: Page,
    email: string,
    password: string
  ): Promise<void> {
    console.log(`🔑 Logging in as: ${email}`);

    // If auth is disabled, just navigate to dashboard
    if (process.env.DISABLE_AUTH === 'true') {
      console.log('🔓 Auth disabled - going directly to dashboard');
      await page.goto('/');
      await page.waitForLoadState('networkidle', { timeout: 5000 });
      console.log('✅ Bypassed login successfully');
      return;
    }

    // Normal auth flow
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    if (currentUrl.includes('/change-password')) {
      console.log('🔒 Need to change password...');
      const newPassword = `TestPassword${Date.now()}!`;

      await page.fill('input[name="currentPassword"]', password);
      await page.fill('input[name="newPassword"]', newPassword);
      await page.fill('input[name="confirmPassword"]', newPassword);
      await page.click('button:has-text("Change Password")');

      // Wait for success message
      await page.waitForSelector('text=Password Updated!', { timeout: 10000 });
      await page.waitForTimeout(2000);

      console.log('✅ Password changed successfully');
    }

    // Should be on dashboard now
    if (!page.url().endsWith('/') && !page.url().includes('/dashboard')) {
      throw new Error(`Login failed. Current URL: ${page.url()}`);
    }

    console.log('✅ Login successful');
  }

  /**
   * Create a user with specified role
   */
  static async createUser(
    page: Page,
    username: string,
    email: string,
    password: string,
    role: 'user' | 'admin' | 'superuser' = 'user'
  ): Promise<void> {
    console.log(`👤 Creating ${role} user: ${username}`);

    // Navigate to users tab
    await page.click('[role="tab"]:has-text("Users")');
    await page.waitForTimeout(1000);

    // Click add user button
    await page.click('button:has-text("Add User")');
    await page.waitForSelector('text=Create New User', { timeout: 10000 });

    // Fill the form
    await page.fill('input[placeholder="username"]', username);
    await page.fill('input[placeholder="user@example.com"]', email);
    await page.fill('input[placeholder="Min 8 characters"]', password);
    await page.fill('input[placeholder="Confirm password"]', password);

    // Select role
    const roleSelect = page.locator('select').first();
    await roleSelect.selectOption(role);

    // Create user
    await page.click('button:has-text("Create User")');

    // Wait for success message
    await page.waitForSelector('text=User created successfully', {
      timeout: 10000,
    });
    await page.waitForTimeout(1000);

    console.log(`✅ User created: ${username} (${role})`);
  }

  /**
   * Navigate to a specific tab
   */
  static async navigateToTab(page: Page, tabName: string): Promise<void> {
    console.log(`📑 Navigating to ${tabName} tab`);
    await page.click(`[role="tab"]:has-text("${tabName}")`);
    await page.waitForTimeout(1000);
  }

  /**
   * Wait for page to be fully loaded
   */
  static async waitForPageLoad(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);
  }

  /**
   * Generate unique test data
   */
  static generateTestData() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);

    return {
      username: `testuser_${timestamp}`,
      email: `test${timestamp}_${random}@example.com`,
      password: `TestPassword${timestamp}!`,
    };
  }
}
