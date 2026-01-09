/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
export default async function globalSetup() {
  console.log('🔧 Setting up test environment...');

  // Any global setup logic here (e.g., seeding database, etc.)

  console.log('✅ Test environment ready');
}
