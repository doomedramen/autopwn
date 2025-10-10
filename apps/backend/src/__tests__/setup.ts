import { beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/autopwn_test';
process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-chars-long-for-testing-only';
process.env.BETTER_AUTH_URL = 'http://localhost:3001';
process.env.PORT = '3001';
process.env.PCAPS_PATH = '/tmp/test-pcaps';
process.env.DICTIONARIES_PATH = '/tmp/test-dictionaries';
process.env.JOBS_PATH = '/tmp/test-jobs';
process.env.HASHCAT_DEVICE_TYPE = 'cpu';
process.env.JOB_TIMEOUT_HOURS = '24';

// Global test setup
beforeAll(() => {
  console.log('🧪 Setting up test environment...');
});

// Global test teardown
afterAll(() => {
  console.log('✅ Test environment cleanup complete');
});

// Clean up after each test
afterEach(() => {
  // Reset any global state here if needed
});
