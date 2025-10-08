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

    // Optionally perform database cleanup here
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
    // Call the cleanup endpoint if available
    const cleanupResponse = await fetch('http://localhost:3000/api/test/cleanup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch(() => null);

    if (cleanupResponse && cleanupResponse.ok) {
      console.log('✅ Database cleanup completed successfully');
    } else {
      console.log('⚠️ Database cleanup endpoint not available or failed');
    }
  } catch (error) {
    console.log('⚠️ Final database cleanup failed:', error);
    // Don't fail the teardown - this is optional cleanup
  }
}

export default globalTeardown;