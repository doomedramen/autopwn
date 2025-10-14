import { test, expect } from '@playwright/test';
import { TestHelpers } from '../helpers/test-helpers';
import { SessionManager } from './session-manager';
import { DatabaseCleanup } from './database-cleanup';

test.describe.serial('System Initialization', () => {
  test('should initialize system and create superuser', async ({
    page,
    context,
  }) => {
    console.log('🚀 Starting system initialization...');

    // Clean database before initialization
    const dbCleanup = new DatabaseCleanup();
    await dbCleanup.cleanAllTables();

    // Try to load existing session
    const hasSession = await SessionManager.loadSession(context);

    if (hasSession && (await SessionManager.validateSession(page))) {
      console.log('✅ Valid session found, skipping initialization');
      test.skip();
      return;
    }

    // Initialize system
    const user = await TestHelpers.initializeSystem(page);

    // Login and handle password change if needed
    await TestHelpers.login(page, user.email, user.password);

    // Verify we're logged in
    await expect(page).toHaveURL(/\/(dashboard|$)/);

    // Save session for subsequent tests
    await SessionManager.saveSession(context);

    console.log('✅ System initialization complete');
  });
});
