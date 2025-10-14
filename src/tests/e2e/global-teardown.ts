import { promises as fs } from 'fs';
import path from 'path';
import postgres from 'postgres';

/**
 * Global teardown for e2e tests
 * Runs after all tests complete
 * - Clears the uploads directory
 * - Clears the database
 */
async function globalTeardown() {
  console.log('🧹 Running global teardown...');

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

  // NOTE: With true test isolation, individual tests handle their own cleanup
  console.log(
    '📝 Database cleanup handled by individual tests for true isolation'
  );

  console.log('✅ Global teardown complete\n');
}

export default globalTeardown;
