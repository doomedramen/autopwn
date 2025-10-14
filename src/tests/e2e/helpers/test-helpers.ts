import {
  Page,
  BrowserContext,
  expect,
  APIRequestContext,
} from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import { SessionManager } from '../setup/session-manager';

export interface TestUser {
  email: string;
  password: string;
  username: string;
}

export interface UploadedFile {
  id: string;
  path: string;
  name: string;
}

export interface JobData {
  id: string;
  name: string;
  status: string;
  progress: number;
  cracked: number;
  totalHashes: number;
}

export interface NetworkData {
  bssid: string;
  ssid?: string;
}

/**
 * Test utilities for common e2e operations
 */
export class TestHelpers {
  /**
   * Initialize the system (create superuser)
   */
  static async initializeSystem(page: Page): Promise<TestUser> {
    console.log('🚀 Initializing system...');

    await page.goto('/setup');
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Check if initialize button exists
    const initButton = page.locator('[data-testid="initialize-system-button"]');
    const initButtonExists = await initButton.isVisible().catch(() => false);

    if (!initButtonExists) {
      // If system is already initialized, try to use existing superuser credentials
      console.log('🔄 System already initialized, using existing superuser...');

      // Try to use hardcoded credentials but have a fallback
      try {
        const hardcodedCredentials = {
          email: 'superuser@autopwn.local',
          password: 'TestPassword123!',
          username: 'superuser',
        };

        // Test if these credentials work by attempting to login
        await page.goto('/login');
        await page.fill('input[type="email"]', hardcodedCredentials.email);
        await page.fill(
          'input[type="password"]',
          hardcodedCredentials.password
        );
        await page.click('button:has-text("Sign In")');

        // Wait a moment for login attempt
        await page.waitForTimeout(3000);

        const currentUrl = page.url();

        // If login successful or we're on password change page, the credentials work
        if (
          currentUrl.includes('/dashboard') ||
          currentUrl.includes('/change-password') ||
          currentUrl.endsWith('/')
        ) {
          console.log('✅ Hardcoded superuser credentials work');

          // Handle password change if needed
          if (currentUrl.includes('/change-password')) {
            console.log('🔒 Need to change password...');
            const newPassword = `TestPassword${Date.now()}!`;

            await page.fill(
              'input[name="currentPassword"]',
              hardcodedCredentials.password
            );
            await page.fill('input[name="newPassword"]', newPassword);
            await page.fill('input[name="confirmPassword"]', newPassword);
            await page.click('button:has-text("Change Password")');

            await page.waitForSelector('text=Password Updated!', {
              timeout: 10000,
            });
            await page.waitForTimeout(2000);

            // Update credentials with new password
            hardcodedCredentials.password = newPassword;
          }

          return hardcodedCredentials;
        } else {
          console.log(
            '🔄 Hardcoded credentials redirected to login page - they failed'
          );
        }
      } catch (error) {
        console.log(
          '⚠️ Hardcoded credentials failed, continuing with fallback:',
          error
        );
      }

      // If hardcoded credentials don't work, we need to force re-initialize the system
      // This can happen when the database was completely cleaned
      console.log(
        '🔄 Hardcoded credentials failed, forcing system re-initialization...'
      );

      // Go to setup page to trigger system initialization
      await page.goto('/setup');
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Check if initialize button exists now (it should after database cleanup)
      const initButton = page.locator(
        '[data-testid="initialize-system-button"]'
      );
      const initButtonExists = await initButton.isVisible().catch(() => false);

      if (initButtonExists) {
        console.log(
          '🚀 System re-initialization available, creating new superuser...'
        );
        await initButton.click();

        await page.waitForSelector('[data-testid="superuser-email"]', {
          timeout: 10000,
        });
        await page.waitForSelector('[data-testid="superuser-password"]', {
          timeout: 10000,
        });

        const emailElement = await page.locator(
          '[data-testid="superuser-email"]'
        );
        const passwordElement = await page.locator(
          '[data-testid="superuser-password"]'
        );
        const emailText = await emailElement.textContent();
        const passwordText = await passwordElement.textContent();

        const credentials = {
          email: emailText!.replace('Email:', '').trim(),
          password: passwordText!.replace('Password:', '').trim(),
          username: 'superuser',
        };

        console.log('✅ System re-initialized successfully');
        return credentials;
      } else {
        // If we still can't initialize, something is wrong with the setup
        console.log('❌ System re-initialization failed');
        throw new Error(
          'Unable to re-initialize system - setup page not working properly'
        );
      }
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
      username: 'superuser',
    };

    console.log('✅ System initialized successfully');
    return credentials;
  }

  /**
   * Login with session management
   */
  static async loginWithSession(
    page: Page,
    context: BrowserContext,
    email?: string,
    password?: string
  ): Promise<void> {
    console.log(`🔑 Logging in with session management...`);

    // Always clear sessions for test suite to ensure complete isolation
    if (process.env.PLAYWRIGHT_TEST_INDEX !== undefined) {
      console.log('🔄 Running in test suite - forcing fresh session');
      await SessionManager.clearSession();

      // Clear all browser data for maximum isolation
      await context.clearCookies();
      await context.clearPermissions();

      // Clear any localStorage/sessionStorage that might interfere
      await page.goto('about:blank');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Force clear any BetterAuth specific storage
      await page.evaluate(() => {
        // Clear any potential BetterAuth session storage
        if (typeof window !== 'undefined') {
          Object.keys(window.localStorage).forEach(key => {
            if (
              key.includes('better-auth') ||
              key.includes('session') ||
              key.includes('auth')
            ) {
              localStorage.removeItem(key);
            }
          });
          Object.keys(window.sessionStorage).forEach(key => {
            if (
              key.includes('better-auth') ||
              key.includes('session') ||
              key.includes('auth')
            ) {
              sessionStorage.removeItem(key);
            }
          });
        }
      });
    }

    // For individual test runs, try to load existing session
    if (process.env.PLAYWRIGHT_TEST_INDEX === undefined) {
      const hasSession = await SessionManager.loadSession(context);

      if (hasSession && (await SessionManager.validateSession(page))) {
        console.log('✅ Using existing session');
        return;
      }
    }

    // If no valid session, use provided credentials or initialize system
    let user: TestUser;
    if (email && password) {
      user = { email, password, username: 'knownuser' };
    } else {
      user = await this.initializeSystem(page);
    }

    // Perform login
    await this.login(page, user.email, user.password);

    // Only save session for individual test runs, not full suite
    if (process.env.PLAYWRIGHT_TEST_INDEX === undefined) {
      await SessionManager.saveSession(context);
    }

    console.log('✅ Login with session complete');
  }

  /**
   * Login and handle password change if needed
   */
  static async login(
    page: Page,
    email: string,
    password: string
  ): Promise<void> {
    console.log(`🔑 Logging in as: ${email}`);

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
   * Get authentication headers for API requests
   */
  static async getAuthHeaders(
    context: BrowserContext
  ): Promise<Record<string, string>> {
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(
      c => c.name === 'better-auth.session_token'
    );

    if (!sessionCookie) {
      throw new Error('No session cookie found for API requests');
    }

    return {
      Cookie: `${sessionCookie.name}=${sessionCookie.value}`,
    };
  }

  /**
   * Upload a dictionary file via API
   */
  static async uploadDictionary(
    request: APIRequestContext,
    authHeaders: Record<string, string>,
    filePath: string,
    fileName?: string
  ): Promise<UploadedFile> {
    console.log('📚 Uploading dictionary...');

    const dictionaryFile = await fs.readFile(filePath);
    const name = fileName || path.basename(filePath);

    const response = await request.post('/api/upload/dictionary', {
      multipart: {
        file: {
          name,
          mimeType: 'text/plain',
          buffer: dictionaryFile,
        },
      },
      headers: authHeaders,
    });

    if (!response.ok()) {
      const errorData = await response.json();
      throw new Error(`Dictionary upload failed: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.dictionary).toBeDefined();

    console.log(`✅ Dictionary uploaded with ID: ${data.data.dictionary.id}`);
    return data.data.dictionary;
  }

  /**
   * Upload a PCAP file via API
   */
  static async uploadPcap(
    request: APIRequestContext,
    authHeaders: Record<string, string>,
    filePath: string,
    fileName?: string
  ): Promise<{ upload: UploadedFile; networks: NetworkData[] }> {
    console.log('📦 Uploading PCAP...');

    const pcapFile = await fs.readFile(filePath);
    const name = fileName || path.basename(filePath);

    const response = await request.post('/api/upload/pcap', {
      multipart: {
        file: {
          name,
          mimeType: 'application/vnd.tcpdump.pcap',
          buffer: pcapFile,
        },
      },
      headers: authHeaders,
    });

    if (!response.ok()) {
      const errorData = await response.json();
      throw new Error(`PCAP upload failed: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.networks).toBeDefined();
    expect(data.data.networks.length).toBeGreaterThan(0);

    console.log(
      `✅ PCAP uploaded with ${data.data.networks.length} network(s)`
    );
    return data.data;
  }

  /**
   * Create a password cracking job via API
   */
  static async createJob(
    request: APIRequestContext,
    authHeaders: Record<string, string>,
    jobName: string,
    networkBssids: string[],
    dictionaryIds: string[],
    options: Record<string, unknown> = {}
  ): Promise<JobData> {
    console.log('🚀 Creating cracking job...');

    const defaultOptions = {
      attackMode: 0, // Dictionary attack
      hashType: 22000,
      workloadProfile: 3,
      gpuTempAbort: 90,
      optimizedKernelEnable: true,
      potfileDisable: true, // Disable potfile for tests
    };

    const response = await request.post('/api/jobs', {
      data: {
        name: jobName,
        networks: networkBssids,
        dictionaries: dictionaryIds,
        options: { ...defaultOptions, ...options },
      },
      headers: authHeaders,
    });

    if (!response.ok()) {
      const errorData = await response.json();
      throw new Error(`Job creation failed: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.id).toBeDefined();

    console.log(`✅ Job created with ID: ${data.data.id}`);
    return data.data;
  }

  /**
   * Wait for job completion with polling
   */
  static async waitForJobCompletion(
    request: APIRequestContext,
    authHeaders: Record<string, string>,
    jobId: string,
    maxAttempts: number = 120,
    pollInterval: number = 1000
  ): Promise<JobData> {
    console.log('⏳ Waiting for job to complete...');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await request.get(`/api/jobs/${jobId}/status`, {
        headers: authHeaders,
      });

      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);

      const jobStatus = data.data;
      console.log(
        `  Status: ${jobStatus.status}, Progress: ${jobStatus.progress}%, Cracked: ${jobStatus.cracked}/${jobStatus.totalHashes}`
      );

      if (
        jobStatus.status === 'completed' ||
        jobStatus.status === 'cracked' ||
        jobStatus.status === 'exhausted'
      ) {
        console.log(`✅ Job finished with status: ${jobStatus.status}`);
        return jobStatus;
      }

      if (jobStatus.status === 'failed' || jobStatus.status === 'error') {
        throw new Error(
          `Job failed: ${jobStatus.errorMessage || 'Unknown error'}`
        );
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Job did not complete within the timeout period');
  }

  /**
   * Navigate to a specific tab
   */
  static async navigateToTab(page: Page, tabName: string): Promise<void> {
    console.log(`📑 Navigating to ${tabName} tab`);

    // Map tab names to their actual display text
    const tabMap: Record<string, string> = {
      Dicts: 'Dicts',
      Dictionaries: 'Dicts',
      Jobs: 'Jobs',
      Networks: 'Networks',
      Users: 'Users',
    };

    const displayTabName = tabMap[tabName] || tabName;

    // Try multiple selectors for Radix UI Tabs
    const selectors = [
      `button[data-state][role="tab"]:has-text("${displayTabName}")`,
      `[data-radix-collection-item]:has-text("${displayTabName}")`,
      `button:has-text("${displayTabName}")`,
      `div:has-text("${displayTabName}")`,
    ];

    for (const selector of selectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        await page.waitForTimeout(1000);
        return;
      } catch {
        // Continue to next selector
      }
    }

    throw new Error(`Could not find tab with name: ${displayTabName}`);
  }

  /**
   * Generate unique test data
   */
  static generateTestData(): {
    username: string;
    email: string;
    password: string;
  } {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);

    return {
      username: `testuser_${timestamp}`,
      email: `test${timestamp}_${random}@example.com`,
      password: `TestPassword${timestamp}!`,
    };
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
    await this.navigateToTab(page, 'Users');

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
   * Get test file paths
   */
  static getTestFilePaths(): {
    dictionaryPath: string;
    pcapPath: string;
  } {
    const testDir = __dirname;
    return {
      dictionaryPath: path.join(
        testDir,
        '../fixtures/dictionaries/test-passwords.txt'
      ),
      pcapPath: path.join(testDir, '../fixtures/pcaps/wpa2-ikeriri-5g.pcap'),
    };
  }

  /**
   * Take screenshot with timestamp
   */
  static async takeScreenshot(page: Page, name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-results/${name}-${timestamp}.png`;
    await page.screenshot({ path: filename });
    console.log(`📸 Screenshot saved: ${filename}`);
  }
}
