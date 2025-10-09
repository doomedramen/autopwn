import { FullConfig } from '@playwright/test';

/**
 * Global teardown for Playwright tests with Docker integration
 * This function runs once after all tests complete
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown for E2E tests...');

  // In CI environment, Docker services will be cleaned up by the CI pipeline
  if (process.env.CI) {
    console.log('📦 CI environment detected - Docker services will be cleaned up by CI pipeline');
  } else {
    console.log('🏠 Local development environment');
  }

  console.log('✅ Global teardown completed');
}

export default globalTeardown;