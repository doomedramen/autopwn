import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const isDocker = !!process.env.DOCKER;
const isCI = !!process.env.CI;
const host = isDocker ? "[::1]" : "localhost";

/**
 * Consolidated Playwright configuration for AutoPWN E2E testing
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: !isCI, // Use parallel in local, sequential in CI
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  workers: isCI ? 1 : 2, // Reduce workers in CI to avoid database conflicts

  // Enhanced reporting
  reporter: isCI ? [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }]
  ] : [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }]
  ],

  use: {
    baseURL: process.env.BASE_URL || `http://${host}:3000`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Consistent timeouts
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  // Test projects - focus on Chromium for reliability, add others as needed
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Add other browsers only when needed for specific testing
    ...(process.env.TEST_ALL_BROWSERS ? [
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    ] : []),
  ],

  // Global setup and teardown
  globalSetup: path.join(__dirname, 'e2e/global-setup.ts'),
  globalTeardown: path.join(__dirname, 'e2e/global-teardown.ts'),

  // Web server configuration with better health checking
  webServer: isDocker ? undefined : {
    command: 'pnpm run dev',
    url: `http://${host}:3000`,
    reuseExistingServer: !isCI,
    timeout: 120 * 1000,
  },

  // Consistent timeout configuration
  timeout: 120000,
  expect: {
    timeout: 10000,
  },

  // Metadata for test organization
  metadata: {
    testEnvironment: isDocker ? 'docker' : 'local',
    databaseCleanup: 'enabled',
    userLifecycle: 'complete',
    nodeVersion: process.version,
  },
});