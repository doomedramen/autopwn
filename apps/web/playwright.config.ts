import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/specs',
  /* Run tests in parallel for better performance */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Enable retries for flaky tests */
  retries: process.env.CI ? 1 : 0,
  /* Use multiple workers for faster execution */
  workers: process.env.CI ? 2 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [['html', { outputFolder: 'playwright-report' }], ['list']]
    : [['html', { outputFolder: 'playwright-report' }], ['list']],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Enable video recording for debugging failed tests */
    video: 'retain-on-failure',

    /* Viewport settings */
    viewport: { width: 1280, height: 720 },

    /* Reasonable timeouts for better reliability */
    actionTimeout: 30000,
    navigationTimeout: 30000,

    /* Context options */
    ignoreHTTPSErrors: true,
  },

  /* Configure projects - test on multiple browsers for better coverage */
  projects: [
    {
      name: 'setup',
      testDir: './tests',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        storageState: 'playwright/.auth/user.json'
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
        storageState: 'playwright/.auth/user.json'
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
        storageState: 'playwright/.auth/user.json'
      },
      dependencies: ['setup'],
    }
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.SKIP_WEB_SERVER ? undefined : [
    // Start API server
    {
      command: 'cd ../.. && dotenv -e .env.test -- pnpm --filter @autopwn/api test:dev',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=2048' // Increased memory limit
      }
    },
    // Start Web server
    {
      command: 'cd ../.. && dotenv -e .env.test -- pnpm --filter web test:dev',
      url: process.env.BASE_URL || 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=2048' // Increased memory limit
      }
    },
  ],
  
  // Global setup for resource management
  globalSetup: './tests/global-setup',
})