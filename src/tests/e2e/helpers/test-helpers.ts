import {
  Page,
  BrowserContext,
  expect,
  APIRequestContext,
} from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

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
   * Initialize the system (create superuser) or bypass for no-auth mode
   */
  static async initializeSystem(page: Page): Promise<TestUser> {
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
      return {
        email: 'superuser@autopwn.local',
        password: 'TestPassword123!',
        username: 'superuser',
      };
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
   * Login and handle password change if needed
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
    await page.click(`[role="tab"]:has-text("${tabName}")`);
    await page.waitForTimeout(1000);
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
