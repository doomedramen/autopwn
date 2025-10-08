import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for AutoPWN E2E testing with Docker support
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Reduce parallelism to avoid database conflicts
  forbidOnly: false,
  retries: 1,
  workers: 2,

  // Use list reporter for clear console output
  reporter: [
    ['list'],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Set timeout for individual actions
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  // Test on major browsers and mobile devices
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],

  // Global setup for test environment
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  // Auto-start dev server if needed, reuse if existing
  webServer: {
    command: process.env.CI
      ? 'cd ../.. && docker-compose up -d --build && sleep 10' // Start Docker services in CI
      : 'pnpm run dev', // Use dev server for local development
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI, // Don't reuse server in CI
    timeout: 120 * 1000,
  },

  // Configure retries and timeout
  timeout: 120000, // 2 minute timeout for tests
  expect: {
    timeout: 10000, // 10 second timeout for assertions
  },

  // Metadata for test organization
  metadata: {
    testEnvironment: 'docker',
    databaseCleanup: 'enabled',
    userLifecycle: 'complete',
  },
});