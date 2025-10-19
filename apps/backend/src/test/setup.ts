/**
 * Test Setup
 *
 * Runs before all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Minimal test config (override with real values in integration tests)
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/autopwn_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
process.env.SESSION_SECRET = 'test_secret_minimum_32_characters_long';
process.env.LOG_LEVEL = 'silent'; // Suppress logs during tests
