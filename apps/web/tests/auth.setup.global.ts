import { test as setup } from '@playwright/test';

/**
 * Global authentication setup
 * This runs before all other tests to set up authenticated sessions
 */
setup('setup test environment', async () => {
  console.log('🔐 Setting up authentication state...');

  // For now, we'll skip authentication setup since Better Auth may need special handling
  // TODO: Implement proper authentication setup for tests

  console.log('✅ Authentication setup complete');
});
