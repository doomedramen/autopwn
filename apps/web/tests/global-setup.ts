import { cleanDatabase } from './helpers/database';
import { setupTestUsers } from './helpers/auth';

/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
export default async function globalSetup() {
  console.log('🔧 Setting up test environment...');

  try {
    // Clean the test database
    await cleanDatabase();

    // Create test users
    await setupTestUsers();

    console.log('✅ Test environment ready');
  } catch (error) {
    console.error('❌ Failed to set up test environment:', error);
    throw error;
  }
}
