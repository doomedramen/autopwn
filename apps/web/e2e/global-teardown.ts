import { FullConfig } from '@playwright/test';
import { TestDatabase } from '../tests/helpers/test-database';

/**
 * Global teardown for Playwright tests with Docker integration
 * This function runs once after all tests complete
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown for E2E tests...');

  // In CI environment, Docker services will be cleaned up by the CI pipeline
  if (process.env.CI) {
    console.log('📦 CI environment detected - Docker services will be cleaned up by CI pipeline');

    // Perform final database cleanup
    await performFinalDatabaseCleanup();
  } else {
    console.log('🏠 Local development environment');

    // For local development, clean up any test data
    await performFinalDatabaseCleanup();
  }

  console.log('✅ Global teardown completed');
}

/**
 * Perform final database cleanup to ensure clean state
 */
async function performFinalDatabaseCleanup() {
  console.log('🗄️ Performing final database cleanup...');

  try {
    // Use TestDatabase to clean up all test data
    const testDb = new TestDatabase();
    await testDb.initialize();
    await testDb.cleanupAllTestData();
    console.log('✅ Database cleanup completed successfully');
  } catch (error) {
    console.log('⚠️ Final database cleanup failed:', error);
    // Don't fail the teardown - this is optional cleanup
  }
}

export default globalTeardown;