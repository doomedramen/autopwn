import { defineConfig, devices } from "@playwright/test";

const isDocker = !!process.env.DOCKER;
const host = isDocker ? "[::1]" : "localhost";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",

  use: {
    baseURL: `http://${host}:3000`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Only start Next.js locally — skip when in Docker
  ...(isDocker
    ? {}
    : {
        webServer: {
          command: `cd apps/web && npx next dev --hostname 127.0.0.1 --port 3000`,
          url: `http://${host}:3000`,
          reuseExistingServer: true,
          timeout: 120 * 1000,
        },
      }),
});
