import { promises as fs } from 'fs';
import path from 'path';
import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DatabaseCleanup } from '../setup/database-cleanup';
import { SessionManager } from '../setup/session-manager';

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

  // Clean database before tests
  try {
    const dbCleanup = new DatabaseCleanup();
    const connected = await dbCleanup.testConnection();
    if (connected) {
      await dbCleanup.cleanAllTables();
      console.log('✓ Database cleaned before tests');
    } else {
      console.log('⚠ Could not connect to database for cleanup');
    }
  } catch (error) {
    console.log('⚠ Database cleanup failed:', error);
  }

  // Clear any existing session data aggressively
  await SessionManager.clearSession();
  console.log('✓ Cleared session data');

  // Clear any browser context data that might interfere with tests
  console.log('🧹 Clearing browser context cache...');
  try {
    const execAsync = promisify(exec);

    // Clear any browser cache or temp files that might interfere
    await execAsync('rm -rf /tmp/playwright* 2>/dev/null || true');
    await execAsync('rm -rf test-results/e2e-session.json 2>/dev/null || true');
    await execAsync('rm -rf test-results/*session* 2>/dev/null || true');
    await execAsync(
      'rm -rf test-results/.playwright-artifacts* 2>/dev/null || true'
    );

    // Clear any browser storage that might have corrupted auth data
    await execAsync('rm -rf ~/.cache/ms-playwright* 2>/dev/null || true');

    console.log('✅ Cleared browser cache files and session data');
  } catch {
    console.log('⚠️ Could not clear browser cache files');
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
  } catch (error) {
    console.log('⚠ Could not clear uploads directory:', error);
  }

  // Clear jobs directory for clean test state
  const jobsDir = path.join(process.cwd(), 'jobs');
  try {
    await fs.rm(jobsDir, { recursive: true, force: true });
    console.log('✓ Cleared jobs directory');
  } catch (error) {
    console.log('⚠ Could not clear jobs directory:', error);
  }

  // Clear any temporary job files
  const tempDir = path.join(process.cwd(), 'tmp');
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log('✓ Cleared temporary directory');
  } catch (error) {
    console.log('⚠ Could not clear temporary directory:', error);
  }

  // Recreate directory structure
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(path.join(uploadsDir, 'pcap'), { recursive: true });
    await fs.mkdir(path.join(uploadsDir, 'dictionary'), { recursive: true });
    await fs.mkdir(jobsDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    console.log('✓ Recreated directory structure');
  } catch (error) {
    console.log('⚠ Could not create directory structure:', error);
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

  // Kill any existing hashcat processes to ensure clean test state
  try {
    const execAsync = promisify(exec);

    // Kill hashcat processes
    await execAsync('pkill -f "hashcat" || true');
    await execAsync('pkill -f "hashcat.bin" || true');

    // Kill any job processing scripts
    await execAsync('pkill -f "job-monitor" || true');
    await execAsync('pkill -f "job-processor" || true');

    console.log('✓ Killed existing hashcat and job processes');
  } catch {
    console.log('⚠ Could not kill background processes');
  }
  console.log('✅ Global setup complete for restructured tests\n');
}

export default globalSetup;
