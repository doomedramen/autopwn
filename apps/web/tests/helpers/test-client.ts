import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { TestDatabase } from './test-database';
import { TestDataFactory, type TestUser } from '../fixtures/data-factory';

/**
 * Extended test fixtures with authentication and database support
 */
type TestFixtures = {
  authenticatedPage: Page;
  testUser: TestUser;
  database: TestDatabase;
};

export const test = base.extend<TestFixtures>({
  // Database fixture available in all tests
  database: async ({}, use) => {
    const db = new TestDatabase();
    await db.initialize();
    await use(db);
    await db.cleanup();
  },

  // Test user fixture - creates isolated user for each test
  testUser: async ({ database }, use) => {
    const testUser = await database.setupTestEnvironment();
    await use(testUser);
    // Cleanup is handled automatically by TestDatabase
  },

  // Authenticated page fixture - page with logged in user
  authenticatedPage: async ({ page, testUser, database }, use) => {
    await performLogin(page, testUser);
    await use(page);
  },
});

/**
 * Perform login with test user credentials
 */
export async function performLogin(page: Page, user: TestUser): Promise<void> {
  await page.goto('/auth/signin');

  // Fill login form
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for successful login (redirect to dashboard or home)
  await page.waitForURL('**/', { timeout: 10000 });

  // Verify we're logged in by checking for authenticated content
  await page.waitForSelector('[data-testid="user-menu"]', { timeout: 5000 })
    .catch(() => page.waitForSelector('nav', { timeout: 5000 })); // Fallback
}

/**
 * Setup authentication via API call (faster than UI login)
 */
export async function setupAuthViaApi(context: BrowserContext, user: TestUser): Promise<void> {
  // Call the test setup endpoint to ensure user exists
  const response = await context.request.post('http://localhost:3001/api/test/setup-test-user', {
    data: {
      email: user.email,
      password: user.password,
      name: user.name
    }
  });

  if (!response.ok()) {
    throw new Error(`Failed to setup test user: ${response.statusText()}`);
  }

  // Perform login via API
  const loginResponse = await context.request.post('http://localhost:3000/api/auth/signin', {
    data: {
      email: user.email,
      password: user.password
    }
  });

  if (!loginResponse.ok()) {
    throw new Error(`Failed to login test user: ${loginResponse.statusText()}`);
  }

  // Extract and set auth cookies
  const cookies = loginResponse.headers()['set-cookie'];
  if (cookies) {
    const cookieArray = cookies.split(',').map(cookie => cookie.trim());
    for (const cookie of cookieArray) {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        await context.addCookies([{
          name,
          value,
          domain: 'localhost',
          path: '/'
        }]);
      }
    }
  }
}

/**
 * Wait for WebSocket connection
 */
export async function waitForWebSocket(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    // Check if WebSocket connection is established
    return (window as any).websocketConnected === true;
  }, { timeout: 10000 });
}

/**
 * Create test file upload
 */
export async function createTestFileUpload(page: Page, filename: string, content?: Buffer): Promise<string> {
  let testFilePath: string;
  
  // Use WPA2 test file if requested
  if (filename.includes('wpa2')) {
    testFilePath = TestDataFactory.createWPA2TestPcap();
  } else {
    testFilePath = TestDataFactory.createMockPcap(filename, content);
  }

  // Create file chooser for upload
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click('[data-testid="upload-button"]');
  const fileChooser = await fileChooserPromise;

  await fileChooser.setFiles(testFilePath);

  return testFilePath;
}

/**
 * Wait for job completion
 */
export async function waitForJobCompletion(
  page: Page,
  jobId: string,
  timeout: number = 60000
): Promise<void> {
  await page.waitForFunction(
    ({ expectedJobId }) => {
      const jobElement = document.querySelector(`[data-job-id="${expectedJobId}"]`);
      if (!jobElement) return false;

      const status = jobElement.getAttribute('data-job-status');
      return status === 'completed' || status === 'failed';
    },
    { expectedJobId: jobId },
    { timeout }
  );
}

/**
 * Get job status from page
 */
export async function getJobStatus(page: Page, jobId: string): Promise<string | null> {
  return await page.getAttribute(`[data-job-id="${jobId}"]`, 'data-job-status');
}

/**
 * Navigate to jobs page
 */
export async function navigateToJobs(page: Page): Promise<void> {
  await page.click('[data-testid="nav-jobs"], a[href="/jobs"]');
  await page.waitForURL('**/jobs**');
  await page.waitForSelector('[data-testid="jobs-container"]', { timeout: 10000 });
}

/**
 * Navigate to analytics page
 */
export async function navigateToAnalytics(page: Page): Promise<void> {
  await page.click('[data-testid="nav-analytics"], a[href="/analytics"]');
  await page.waitForURL('**/analytics**');
  await page.waitForSelector('[data-testid="analytics-container"]', { timeout: 10000 });
}

/**
 * Check if element is visible
 */
export async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  return await page.isVisible(selector).catch(() => false);
}

/**
 * Wait for element to appear with custom timeout
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 10000
): Promise<void> {
  await page.waitForSelector(selector, { timeout });
}

/**
 * Take screenshot on failure
 */
export async function takeScreenshotOnFailure(page: Page, testName: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `test-results/screenshots/${testName}-failure-${timestamp}.png`,
    fullPage: true
  });
}

/**
 * Get page content for debugging
 */
export async function getPageContent(page: Page): Promise<string> {
  return await page.content();
}

export { expect } from '@playwright/test';