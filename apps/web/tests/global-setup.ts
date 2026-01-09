import { cleanDatabase, seedConfig } from './helpers/database';

/**
 * Global setup for Playwright tests
 * Runs once before all tests, BEFORE servers start
 *
 * Note: Test users are created in auth.setup.global.ts which runs after servers start
 */
export default async function globalSetup() {
  console.log('🔧 Setting up test environment (pre-server)...');

  try {
    // Seed config values first (API needs these to start)
    await seedConfig();

    // Clean the test database (preserves config)
    await cleanDatabase();

    // Note: Test user creation moved to auth.setup.global.ts
    // because it needs the API to be running

    console.log('✅ Pre-server setup complete');
  } catch (error) {
    console.error('❌ Failed to set up test environment:', error);
    throw error;
  }
}
