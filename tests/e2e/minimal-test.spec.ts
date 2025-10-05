import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';

test.describe('Minimal Test', () => {
  let testUtils: TestUtils;

  test.beforeAll(async () => {
    testUtils = new TestUtils('minimal-test');
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  test('should be able to access the web app', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AutoPWN/);
  });

  test('should copy local pcap files correctly', async ({ page }) => {
    // Copy local pcap files to test directory
    const localPcaps = testUtils.getLocalPcapFiles();
    expect(localPcaps.length).toBeGreaterThan(0);

    const config = testUtils.getTestConfig();
    const testPcapPath = `${config.testInputDir}/${localPcaps[0].filename}`;

    // Verify the file exists using Node.js fs instead of shell command
    const fs = require('fs');
    expect(fs.existsSync(testPcapPath)).toBe(true);

    const stats = fs.statSync(testPcapPath);
    expect(stats.size).toBeGreaterThan(1000); // At least 1KB
  });
});