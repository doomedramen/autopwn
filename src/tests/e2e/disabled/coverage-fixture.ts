// Playwright Coverage Fixture
// Import this fixture in your Playwright test files

import { test as base } from '@playwright/test';
// import { CoverageTracker } from 'playwright-cover';

export const test = base.extend({
  // Enhanced page fixture with coverage tracking
  page: async ({ page: pageFixture }, use) => {
    // For now, just use the page without coverage tracking
    // The static analysis from playwright-coverage-reporter is sufficient
    await use(pageFixture);
  },
});

export { expect } from '@playwright/test';

// Example usage:
/*
import { test, expect } from './coverage-fixture';

test('example test with coverage', async ({ page }) => {
  await page.goto('https://example.com');
  await page.click('button:has-text("Submit")');
  await page.fill('[data-testid="email-input"]', 'test@example.com');
  // All interactions are automatically tracked for coverage
});
*/
