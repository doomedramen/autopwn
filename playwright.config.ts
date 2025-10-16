import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./src/tests/e2e",
  fullyParallel: false, // Disable full parallelism for session management
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for faster feedback
  workers: 1, // Keep single worker for database consistency
  failOnFlakyTests: true, // Fail on flaky tests
  reporter: [
  ["list"],
  ["playwright-coverage-reporter", {
    outputPath: './coverage-report',
    threshold: 80,
    verbose: true
  }]
],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  globalSetup: require.resolve("./src/tests/e2e/helpers/global-setup.ts"),
  globalTeardown: require.resolve("./src/tests/e2e/helpers/global-teardown.ts"),

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120000,
  },
});