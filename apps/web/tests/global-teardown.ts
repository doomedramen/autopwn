import { cleanDatabase } from './helpers/database';

/**
 * Global teardown for Playwright tests
 * Runs once after all tests
 */
export default async function globalTeardown() {
  console.log('🧹 Tearing down test environment...');

  try {
    // Clean the test database after all tests
    await cleanDatabase();

    console.log('✅ Test environment cleaned up');
  } catch (error) {
    console.error('❌ Failed to clean up test environment:', error);
    // Don't throw - teardown errors shouldn't fail the test run
  }
}
