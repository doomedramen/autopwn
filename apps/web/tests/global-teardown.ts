/**
 * Global teardown for Playwright tests
 * Runs once after all tests
 */
export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');

  // Any cleanup logic here

  console.log('✅ Test environment cleaned up');
}
