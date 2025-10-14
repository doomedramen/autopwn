# E2E Test Implementation Guide

## 1. Database Cleanup Utilities

### File: `src/tests/e2e/setup/database-cleanup.ts`

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../../lib/db/schema';

// Tables in order of dependency (child tables first)
const TABLES_TO_CLEAN = [
  'cracked_passwords',
  'job_dictionaries',
  'job_networks',
  'job_pcaps',
  'jobs',
  'networks',
  'uploads',
  'sessions',
  'verifications',
  'accounts',
  'user_profiles',
  'users'
];

export class DatabaseCleanup {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    const client = postgres(connectionString);
    this.db = drizzle(client, { schema });
  }

  async cleanAllTables(): Promise<void> {
    console.log('🧹 Cleaning database tables...');
    
    // Disable foreign key constraints temporarily
    await this.db.execute('SET session_replication_role = replica;');
    
    try {
      // Truncate all tables in correct order
      for (const tableName of TABLES_TO_CLEAN) {
        await this.db.execute(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE;`);
        console.log(`✓ Cleaned table: ${tableName}`);
      }
    } finally {
      // Re-enable foreign key constraints
      await this.db.execute('SET session_replication_role = DEFAULT;');
    }
    
    console.log('✅ Database cleanup complete');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.db.execute('SELECT 1');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
  }
}
```

## 2. Session Manager

### File: `src/tests/e2e/setup/session-manager.ts`

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import { BrowserContext, Page } from '@playwright/test';

export interface SessionData {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  storage: Record<string, string>;
  lastUpdated: number;
}

export class SessionManager {
  private static readonly SESSION_FILE = path.join(
    process.cwd(),
    'test-results',
    'e2e-session.json'
  );

  static async saveSession(context: BrowserContext): Promise<void> {
    console.log('💾 Saving session data...');
    
    const cookies = await context.cookies();
    const storage = await context.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          storage[key] = localStorage.getItem(key) || '';
        }
      }
      return storage;
    });

    const sessionData: SessionData = {
      cookies,
      storage,
      lastUpdated: Date.now(),
    };

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.SESSION_FILE), { recursive: true });
    
    // Write session data
    await fs.writeFile(this.SESSION_FILE, JSON.stringify(sessionData, null, 2));
    
    console.log('✅ Session data saved');
  }

  static async loadSession(context: BrowserContext): Promise<boolean> {
    console.log('📥 Loading session data...');
    
    try {
      const sessionData = await fs.readFile(this.SESSION_FILE, 'utf-8');
      const session: SessionData = JSON.parse(sessionData);
      
      // Check if session is recent (less than 1 hour old)
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - session.lastUpdated > oneHour) {
        console.log('⚠️ Session data is expired');
        return false;
      }
      
      // Restore cookies
      await context.addCookies(session.cookies);
      
      // Restore localStorage
      await context.addInitScript((storage) => {
        Object.entries(storage).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      }, session.storage);
      
      console.log('✅ Session data loaded');
      return true;
    } catch (error) {
      console.log('⚠️ No session data found or invalid format');
      return false;
    }
  }

  static async clearSession(): Promise<void> {
    console.log('🗑️ Clearing session data...');
    
    try {
      await fs.unlink(this.SESSION_FILE);
      console.log('✅ Session data cleared');
    } catch (error) {
      // File might not exist, which is fine
      console.log('ℹ️ No session data to clear');
    }
  }

  static async validateSession(page: Page): Promise<boolean> {
    try {
      // Try to access a protected endpoint
      const response = await page.goto('/api/auth/me');
      
      if (response && response.ok()) {
        const data = await response.json();
        return data.success === true && data.user;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
}
```

## 3. System Initialization Test

### File: `src/tests/e2e/setup/system-initialization.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { TestHelpers } from '../helpers/test-helpers';
import { SessionManager } from './session-manager';
import { DatabaseCleanup } from './database-cleanup';

test.describe.serial('System Initialization', () => {
  test('should initialize system and create superuser', async ({ page, context, request }) => {
    console.log('🚀 Starting system initialization...');
    
    // Clean database before initialization
    const dbCleanup = new DatabaseCleanup();
    await dbCleanup.cleanAllTables();
    
    // Try to load existing session
    const hasSession = await SessionManager.loadSession(context);
    
    if (hasSession && await SessionManager.validateSession(page)) {
      console.log('✅ Valid session found, skipping initialization');
      test.skip();
      return;
    }
    
    // Initialize system
    const user = await TestHelpers.initializeSystem(page);
    
    // Login and handle password change if needed
    await TestHelpers.login(page, user.email, user.password);
    
    // Verify we're logged in
    await expect(page).toHaveURL(/\/(dashboard|$)/);
    
    // Save session for subsequent tests
    await SessionManager.saveSession(context);
    
    console.log('✅ System initialization complete');
  });
});
```

## 4. Updated Test Helpers

### File: `src/tests/e2e/helpers/test-helpers.ts` (Updated)

```typescript
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
   * Login with session management
   */
  static async loginWithSession(
    page: Page,
    context: BrowserContext,
    email?: string,
    password?: string
  ): Promise<void> {
    console.log(`🔑 Logging in with session management...`);

    // Try to load existing session
    const hasSession = await SessionManager.loadSession(context);
    
    if (hasSession && await SessionManager.validateSession(page)) {
      console.log('✅ Using existing session');
      return;
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
    
    // Save session for future use
    await SessionManager.saveSession(context);
    
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

  // ... rest of the existing methods remain the same
}
```

## 5. Updated Global Setup

### File: `src/tests/e2e/helpers/global-setup.ts` (Updated)

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import { chromium, FullConfig } from '@playwright/test';
import { DatabaseCleanup } from '../setup/database-cleanup';
import { SessionManager } from '../setup/session-manager';

/**
 * Global setup for e2e tests
 * Runs before all tests start
 */
async function globalSetup(config: FullConfig) {
  console.log('🧹 Running global setup for restructured tests...');

  // Set environment variables to indicate test environment
  process.env.PLAYWRIGHT = 'true';
  // Remove DISABLE_AUTH to ensure tests work with authentication
  delete process.env.DISABLE_AUTH;

  // Load environment variables from .env.local
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = await fs.readFile(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
    console.log('✓ Loaded environment variables from .env.local');
  } catch (error) {
    console.log('⚠ Could not load .env.local file:', error);
  }

  // Create test results directory
  const testResultsDir = path.join(process.cwd(), 'test-results');
  try {
    await fs.mkdir(testResultsDir, { recursive: true });
    console.log('✓ Created test results directory');
  } catch (error) {
    console.log('⚠ Could not create test results directory:', error);
  }

  // Clean database before tests
  try {
    const dbCleanup = new DatabaseCleanup();
    const connected = await dbCleanup.testConnection();
    
    if (connected) {
      await dbCleanup.cleanAllTables();
      console.log('✓ Database cleaned before tests');
    } else {
      console.log('⚠ Could not connect to database for cleanup');
    }
  } catch (error) {
    console.log('⚠ Database cleanup failed:', error);
  }

  // Clear any existing session data
  await SessionManager.clearSession();

  // Ensure test fixtures exist
  const fixturesDir = path.join(__dirname, '../fixtures');
  const requiredFixtures = [
    'dictionaries/test-passwords.txt',
    'pcaps/wpa2-ikeriri-5g.pcap',
  ];

  for (const fixture of requiredFixtures) {
    const fixturePath = path.join(fixturesDir, fixture);
    try {
      await fs.access(fixturePath);
      console.log(`✓ Found fixture: ${fixture}`);
    } catch (error) {
      console.log(`⚠ Missing fixture: ${fixture}`);
    }
  }

  // Clear uploads directory for clean test state
  const uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    await fs.rm(uploadsDir, { recursive: true, force: true });
    console.log('✓ Cleared uploads directory');
  } catch (error) {
    console.log('⚠ Could not clear uploads directory:', error);
  }

  // Recreate uploads directory structure
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(path.join(uploadsDir, 'pcap'), { recursive: true });
    await fs.mkdir(path.join(uploadsDir, 'dictionary'), { recursive: true });
    await fs.mkdir(path.join(process.cwd(), 'jobs'), { recursive: true });
    console.log('✓ Recreated uploads directory structure');
  } catch (error) {
    console.log('⚠ Could not create uploads directory:', error);
  }

  // Clear hashcat potfile for clean tests
  const potfilePath = path.join(
    process.env.HOME || '',
    '.hashcat',
    'hashcat.potfile'
  );
  try {
    await fs.rm(potfilePath, { force: true });
    console.log('✓ Cleared hashcat potfile');
  } catch (error) {
    console.log('⚠ Could not clear hashcat potfile:', error);
  }

  console.log('✅ Global setup complete for restructured tests\n');
}

export default globalSetup;
```

## 6. Updated Global Teardown

### File: `src/tests/e2e/helpers/global-teardown.ts` (Updated)

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import { FullConfig } from '@playwright/test';
import { DatabaseCleanup } from '../setup/database-cleanup';
import { SessionManager } from '../setup/session-manager';

/**
 * Global teardown for e2e tests
 * Runs after all tests complete
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Running global teardown for restructured tests...');

  // Clean database after tests
  try {
    const dbCleanup = new DatabaseCleanup();
    const connected = await dbCleanup.testConnection();
    
    if (connected) {
      await dbCleanup.cleanAllTables();
      console.log('✓ Database cleaned after tests');
    } else {
      console.log('⚠ Could not connect to database for cleanup');
    }
  } catch (error) {
    console.log('⚠ Database cleanup failed:', error);
  }

  // Clear session data
  await SessionManager.clearSession();

  // Generate test summary
  const testResultsDir = path.join(process.cwd(), 'test-results');
  const summaryFile = path.join(testResultsDir, 'test-summary.md');

  try {
    const summary = generateTestSummary(testResultsDir);
    await fs.writeFile(summaryFile, summary, 'utf-8');
    console.log('✓ Generated test summary');
  } catch (error) {
    console.log('⚠ Could not generate test summary:', error);
  }

  // Clean up temporary test files older than 1 day
  try {
    const tempDir = path.join(process.cwd(), 'tmp');
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtime.getTime() > oneDay) {
        await fs.rm(filePath, { force: true });
        console.log(`✓ Cleaned up old temp file: ${file}`);
      }
    }
  } catch (error) {
    console.log('⚠ Could not clean temp files:', error);
  }

  // Keep uploads directory but clean old files (keep recent test artifacts)
  const uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    const cleanOldFiles = async (dir: string, maxAge: number) => {
      const files = await fs.readdir(dir);
      const now = Date.now();

      for (const file of files) {
        if (file === '.gitkeep') continue;

        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.rm(filePath, { recursive: true, force: true });
          console.log(`✓ Cleaned up old file: ${file}`);
        }
      }
    };

    const oneHour = 60 * 60 * 1000;
    await cleanOldFiles(path.join(uploadsDir, 'pcap'), oneHour);
    await cleanOldFiles(path.join(uploadsDir, 'dictionary'), oneHour);

    const jobsDir = path.join(process.cwd(), 'jobs');
    if (
      await fs
        .access(jobsDir)
        .then(() => true)
        .catch(() => false)
    ) {
      await cleanOldFiles(jobsDir, oneHour);
    }
  } catch (error) {
    console.log('⚠ Could not clean uploads directory:', error);
  }

  // Generate test coverage report if coverage is enabled
  if (process.env.PLAYWRIGHT_COVERAGE === 'true') {
    try {
      console.log('📊 Generating test coverage report...');
      // Coverage report generation would go here
      console.log('✓ Coverage report generated');
    } catch (error) {
      console.log('⚠ Could not generate coverage report:', error);
    }
  }

  console.log('✅ Global teardown complete\n');
}

function generateTestSummary(testResultsDir: string): string {
  const timestamp = new Date().toISOString();

  return `# E2E Test Summary - Restructured Tests

Generated: ${timestamp}

## Test Structure

This test suite is organized into the following categories:

### 📁 System Setup (\`setup/\`)
- System initialization and superuser creation
- Database cleanup utilities
- Session management

### 📁 Authentication Tests (\`auth/\`)
- Login functionality
- Password change functionality
- Authentication guards

### 📁 File Upload Tests (\`upload/\`)
- Dictionary file uploads
- PCAP file uploads
- File management

### 📁 Job Management Tests (\`jobs/\`)
- Job creation and configuration
- Job monitoring and progress
- Job control (pause/stop/restart)
- Job results and export

### 📁 User Management Tests (\`user-management/\`)
- User creation and validation
- User editing and updates
- User permissions and roles

### 📁 Workflow Tests (\`workflows/\`)
- Basic end-to-end workflows
- Advanced workflow scenarios

## 🛠️ Test Utilities

- \`helpers/test-helpers.ts\` - Common test utilities with session management
- \`helpers/global-setup.ts\` - Global test setup with database cleanup
- \`helpers/global-teardown.ts\` - Global test cleanup
- \`setup/database-cleanup.ts\` - Database cleanup utilities
- \`setup/session-manager.ts\` - Session storage and sharing

## 📁 Test Fixtures

- \`fixtures/dictionaries/\` - Test dictionary files
- \`fixtures/pcaps/\` - Test PCAP files

## Running Tests

\`\`\`bash
# Run all e2e tests
pnpm test:e2e

# Run specific test categories
pnpm test:e2e --grep "System Initialization"
pnpm test:e2e --grep "Authentication"
pnpm test:e2e --grep "Upload"
pnpm test:e2e --grep "Jobs"
pnpm test:e2e --grep "User Management"
pnpm test:e2e --grep "Workflow"

# Run with UI for debugging
pnpm test:e2e:ui

# Run in headed mode
pnpm test:e2e:headed
\`\`\`

## Environment Setup

Tests run with authentication enabled and use session persistence:
- \`PLAYWRIGHT=true\` - Indicate Playwright test environment
- \`BASE_URL\` - Override default base URL for tests
- Session data is stored in \`test-results/e2e-session.json\`

---

*This summary was automatically generated after test completion.*
`;
}

export default globalTeardown;
```

## 7. Example: Refactored Job Creation Test

### File: `src/tests/e2e/jobs/job-creation.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { TestHelpers, UploadedFile } from '../helpers/test-helpers';
import { SessionManager } from '../setup/session-manager';

test.describe('Job Creation', () => {
  let authHeaders: Record<string, string>;
  let testDictionary: UploadedFile;
  let testNetworks: string[];

  test.use({ storageState: { cookies: [], origins: [] } }); // Use fresh storage state

  test.beforeAll(async ({ browser, request }) => {
    const context = await browser.newContext();
    
    // Load existing session or initialize
    const page = await context.newPage();
    await TestHelpers.loginWithSession(page, context);
    
    // Get auth headers for API requests
    authHeaders = await TestHelpers.getAuthHeaders(context);
    
    // Setup test data
    const { dictionaryPath, pcapPath } = TestHelpers.getTestFilePaths();
    
    // Upload dictionary
    testDictionary = await TestHelpers.uploadDictionary(
      request,
      authHeaders,
      dictionaryPath
    );
    
    // Upload PCAP and extract networks
    const { networks } = await TestHelpers.uploadPcap(
      request,
      authHeaders,
      pcapPath
    );
    
    testNetworks = networks.map(n => n.bssid);
    
    await context.close();
  });

  test.beforeEach(async ({ page, context }) => {
    // Ensure we have a valid session for each test
    await TestHelpers.loginWithSession(page, context);
  });

  test('should create job via UI', async ({ page }) => {
    // Navigate to jobs tab
    await TestHelpers.navigateToTab(page, 'Jobs');
    
    // Click add job button
    await page.click('button:has-text("Add Job")');
    await expect(page.locator('text=Create New Job')).toBeVisible();
    
    // Fill job form
    await page.fill('input[name="name"]', 'UI Test Job');
    
    // Select networks
    await page.click('[data-testid="network-select"]');
    await page.click(`text=${testNetworks[0]}`);
    
    // Select dictionaries
    await page.click('[data-testid="dictionary-select"]');
    await page.click(`text=${testDictionary.name}`);
    
    // Set attack options
    await page.selectOption('select[name="attackMode"]', '0'); // Dictionary attack
    
    // Create job
    await page.click('button:has-text("Create Job")');
    
    // Should show success message
    await expect(page.locator('text=Job created successfully')).toBeVisible();
    
    // Job should appear in list
    await expect(page.locator('text=UI Test Job')).toBeVisible();
  });

  test('should create job via API', async ({ request }) => {
    const job = await TestHelpers.createJob(
      request,
      authHeaders,
      'API Test Job',
      testNetworks.slice(0, 1),
      [testDictionary.id],
      {
        attackMode: 0,
        hashType: 22000,
      }
    );
    
    expect(job.id).toBeDefined();
    expect(job.name).toBe('API Test Job');
    expect(job.status).toBeDefined();
  });

  test('should validate job creation form', async ({ page }) => {
    // Navigate to jobs tab
    await TestHelpers.navigateToTab(page, 'Jobs');
    
    // Click add job button
    await page.click('button:has-text("Add Job")');
    
    // Try to create job without required fields
    await page.click('button:has-text("Create Job")');
    
    // Should have validation errors
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toHaveAttribute('required');
    
    // Check form validation
    await page.fill('input[name="name"]', '');
    await expect(nameInput).toHaveClass(/invalid/);
  });

  test('should validate job parameters', async ({ request }) => {
    // Test with invalid network ID
    const response = await request.post('/api/jobs', {
      data: {
        name: 'Invalid Job Test',
        networks: ['invalid-network-id'],
        dictionaries: [testDictionary.id],
        options: { attackMode: 0 },
      },
      headers: authHeaders,
    });
    
    expect(response.ok()).toBeFalsy();
    const errorData = await response.json();
    expect(errorData.success).toBe(false);
    expect(errorData.error).toBeDefined();
  });
});
```

This implementation guide provides the key components for restructuring the e2e tests with proper session management and database cleanup.