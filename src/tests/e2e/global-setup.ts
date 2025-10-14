import { promises as fs } from 'fs';
import path from 'path';
import postgres from 'postgres';

/**
 * Global setup for e2e tests
 * Runs before all tests start
 * - Clears the uploads directory
 * - Clears the database
 */
async function globalSetup() {
  console.log('🧹 Running global setup...');

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

  // Clear uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    await fs.rm(uploadsDir, { recursive: true, force: true });
    console.log('✓ Cleared uploads directory');
  } catch (error) {
    console.log('⚠ Could not clear uploads directory:', error);
  }

  // Clear hashcat potfile
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

  // Recreate uploads directory structure
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(path.join(uploadsDir, 'pcap'), { recursive: true });
    await fs.mkdir(path.join(uploadsDir, 'dictionary'), { recursive: true });
    console.log('✓ Recreated uploads directory structure');
  } catch (error) {
    console.log('⚠ Could not create uploads directory:', error);
  }

  // NOTE: With true test isolation, we don't clear the database in global setup
  // Each test will handle its own initialization
  console.log(
    '📝 Database cleanup handled by individual tests for true isolation'
  );

  console.log('✅ Global setup complete\n');
}

export default globalSetup;
