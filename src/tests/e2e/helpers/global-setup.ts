import { promises as fs } from 'fs';
import path from 'path';
import { FullConfig } from '@playwright/test';

/**
 * Global setup for e2e tests
 * Runs before all tests start
 * - Sets up test environment
 * - Ensures clean test state
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalSetup(_config: FullConfig) {
  console.log('🧹 Running global setup for organized tests...');

  // Set environment variables to indicate test environment
  process.env.PLAYWRIGHT = 'true';
  // Remove DISABLE_AUTH to ensure tests work with authentication
  delete process.env.DISABLE_AUTH;

  // Load environment variables from .env.local
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = await fs.readFile(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
    console.log('✓ Loaded environment variables from .env.local');
  } catch {
    console.log('⚠ Could not load .env.local file');
  }

  // Create test results directory
  const testResultsDir = path.join(process.cwd(), 'test-results');
  try {
    await fs.mkdir(testResultsDir, { recursive: true });
    console.log('✓ Created test results directory');
  } catch {
    console.log('⚠ Could not create test results directory');
  }

  // Ensure test fixtures exist
  const fixturesDir = path.join(__dirname, '../fixtures');
  const requiredFixtures = [
    'dictionaries/test-passwords.txt',
    'pcaps/wpa2-ikeriri-5g.pcap',
  ];

  for (const fixture of requiredFixtures) {
    const fixturePath = path.join(fixturesDir, fixture);
    try {
      await fs.access(fixturePath);
      console.log(`✓ Found fixture: ${fixture}`);
    } catch {
      console.log(`⚠ Missing fixture: ${fixture}`);
    }
  }

  // Clear uploads directory for clean test state
  const uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    await fs.rm(uploadsDir, { recursive: true, force: true });
    console.log('✓ Cleared uploads directory');
  } catch {
    console.log('⚠ Could not clear uploads directory');
  }

  // Recreate uploads directory structure
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(path.join(uploadsDir, 'pcap'), { recursive: true });
    await fs.mkdir(path.join(uploadsDir, 'dictionary'), { recursive: true });
    await fs.mkdir(path.join(process.cwd(), 'jobs'), { recursive: true });
    console.log('✓ Recreated uploads directory structure');
  } catch {
    console.log('⚠ Could not create uploads directory');
  }

  // Clear hashcat potfile for clean tests
  const potfilePath = path.join(
    process.env.HOME || '',
    '.hashcat',
    'hashcat.potfile'
  );
  try {
    await fs.rm(potfilePath, { force: true });
    console.log('✓ Cleared hashcat potfile');
  } catch {
    console.log('⚠ Could not clear hashcat potfile');
  }

  console.log('✅ Global setup complete for organized tests\n');
}

export default globalSetup;
