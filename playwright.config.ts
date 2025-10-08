import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Import the web app's config
const webConfig = require('./apps/web/playwright.config.ts');

/**
 * Root Playwright configuration for AutoPWN E2E testing
 * Extends the web app configuration with root-level settings
 */
export default defineConfig({
  // Use the web app's test directory
  testDir: './apps/web/e2e',

  // Use the same projects as web config
  projects: webConfig.default?.projects || [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Use the same web server configuration
  webServer: webConfig.default?.webServer,

  // Configuration overrides
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  // Use the same global setup/teardown
  globalSetup: path.join(__dirname, 'apps/web/e2e/global-setup.ts'),
  globalTeardown: path.join(__dirname, 'apps/web/e2e/global-teardown.ts'),

  // Timeout configuration
  timeout: webConfig.default?.timeout || 120000,
  expect: {
    timeout: webConfig.default?.expect?.timeout || 10000,
  },

  // Reporting configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],
});