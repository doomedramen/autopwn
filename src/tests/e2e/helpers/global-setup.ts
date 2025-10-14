import { promises as fs } from 'fs';
import path from 'path';
import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for e2e tests
 * Runs before all tests start
 * - Sets up test environment
 * - Ensures clean test state
 */
async function globalSetup(config: FullConfig) {
  console.log('🧹 Running global setup for organized tests...');

  // Set environment variables to indicate test environment
  process.env.PLAYWRIGHT = 'true';
  process.env.DISABLE_AUTH = 'true';

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
  } catch (error) {
    console.log('⚠ Could not load .env.local file:', error);
  }

  // Create test results directory
  const testResultsDir = path.join(process.cwd(), 'test-results');
  try {
    await fs.mkdir(testResultsDir, { recursive: true });
    console.log('✓ Created test results directory');
  } catch (error) {
    console.log('⚠ Could not create test results directory:', error);
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
    } catch (error) {
      console.log(`⚠ Missing fixture: ${fixture}`);
    }
  }

  // Clear uploads directory for clean test state
  const uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    await fs.rm(uploadsDir, { recursive: true, force: true });
    console.log('✓ Cleared uploads directory');
  } catch (error) {
    console.log('⚠ Could not clear uploads directory:', error);
  }

  // Recreate uploads directory structure
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(path.join(uploadsDir, 'pcap'), { recursive: true });
    await fs.mkdir(path.join(uploadsDir, 'dictionary'), { recursive: true });
    await fs.mkdir(path.join(process.cwd(), 'jobs'), { recursive: true });
    console.log('✓ Recreated uploads directory structure');
  } catch (error) {
    console.log('⚠ Could not create uploads directory:', error);
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
  } catch (error) {
    console.log('⚠ Could not clear hashcat potfile:', error);
  }

  console.log('✅ Global setup complete for organized tests\n');
}

export default globalSetup;
