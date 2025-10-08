import { FullConfig } from '@playwright/test';
import { TestDatabase } from '../tests/helpers/test-database';

/**
 * Global setup for Playwright tests with Docker integration
 * This function runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...');

  // In CI environment, Docker services should already be running via docker-compose
  if (process.env.CI) {
    console.log('📦 CI environment detected - Docker services should be running via docker-compose');

    // Wait for services to be ready
    await waitForServices();
  } else {
    console.log('🏠 Local development environment');

    // For local development, ensure dev server is accessible
    await waitForLocalServer();
  }

  // Initialize database and cleanup any leftover test data
  await initializeTestDatabase();

  console.log('✅ Global setup completed');
}

/**
 * Wait for Docker services to be ready (CI environment)
 */
async function waitForServices() {
  const maxAttempts = 30;
  const retryDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔍 Checking service availability (attempt ${attempt}/${maxAttempts})...`);

      // Check if web server is responding
      const webResponse = await fetch('http://localhost:3000/api/health', {
        method: 'GET',
      }).catch(() => null);

      if (webResponse && webResponse.ok) {
        console.log('✅ Web server is ready');

        // Check database connectivity through health endpoint
        const dbHealth = await webResponse.json();
        if (dbHealth.database === 'healthy') {
          console.log('✅ Database is ready');
          return;
        }
      }

      console.log(`⏳ Services not ready yet, waiting ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } catch (error) {
      console.log(`❌ Service check failed (attempt ${attempt}): ${error}`);
      if (attempt === maxAttempts) {
        throw new Error('❌ Services failed to become ready within timeout period');
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

/**
 * Wait for local development server (local environment)
 */
async function waitForLocalServer() {
  const maxAttempts = 15;
  const retryDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔍 Checking local dev server (attempt ${attempt}/${maxAttempts})...`);

      const response = await fetch('http://localhost:3000', {
        method: 'GET',
      }).catch(() => null);

      if (response && response.ok) {
        console.log('✅ Local dev server is ready');
        return;
      }

      console.log(`⏳ Local server not ready yet, waiting ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } catch (error) {
      console.log(`❌ Local server check failed (attempt ${attempt}): ${error}`);
      if (attempt === maxAttempts) {
        throw new Error('❌ Local dev server failed to start within timeout period');
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

/**
 * Initialize test database with required tables and cleanup
 */
async function initializeTestDatabase() {
  console.log('🗄️ Initializing test database...');

  try {
    // Wait for database to be available
    const testDb = new TestDatabase();
    await testDb.initialize();
    await testDb.waitForDatabase();
    console.log('✅ Database is ready');

    // Clean up any leftover test data from previous runs
    await testDb.cleanupAllTestData();
    console.log('✅ Cleanup of previous test data completed');

    console.log('✅ Database initialization completed');
  } catch (error) {
    console.log('⚠️ Database initialization failed:', error);
    // Don't fail the setup - tests will handle database issues
  }
}

export default globalSetup;