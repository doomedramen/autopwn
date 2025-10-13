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
  const potfilePath = path.join(process.env.HOME || '', '.hashcat', 'hashcat.potfile');
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

  // Clear database
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('⚠ DATABASE_URL not set, skipping database cleanup');
    return;
  }

  const client = postgres(databaseUrl);

  try {
    // Delete all data from tables in the correct order (respecting foreign keys)
    await client`DELETE FROM cracked_passwords`;
    await client`DELETE FROM job_dictionaries`;
    await client`DELETE FROM job_networks`;
    await client`DELETE FROM job_pcaps`;
    await client`DELETE FROM jobs`;
    await client`DELETE FROM networks`;
    await client`DELETE FROM uploads`;
    await client`DELETE FROM users`;

    console.log('✓ Cleared database tables');
  } catch (error) {
    console.error('❌ Failed to clear database:', error);
    throw error;
  } finally {
    await client.end();
  }

  console.log('✅ Global setup complete\n');
}

export default globalSetup;
