import { test as base, expect } from '@playwright/test';

// This fixture will automatically use the authentication state saved by auth.setup.ts
export const test = base.extend({
  page: async ({ page }, use) => {
    // The authentication state will be automatically loaded from storageState
    // as specified in playwright.config.ts
    await use(page);
  },
});

export { expect };