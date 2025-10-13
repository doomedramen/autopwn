import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Database and file cleanup utility for e2e tests
 * This provides a clean slate before and after each test run
 */

export async function cleanUploadsDirectory() {
  console.log('🗂️ Cleaning uploads directory...');

  const uploadsDir = join(process.cwd(), 'uploads');
  const jobsDir = join(process.cwd(), 'jobs');

  try {
    // Clean uploads directory but preserve structure
    const dirsToClean = ['pcap', 'dictionary'];

    for (const dir of dirsToClean) {
      const dirPath = join(uploadsDir, dir);
      try {
        await fs.access(dirPath);
        const files = await fs.readdir(dirPath);

        for (const file of files) {
          if (file !== '.gitkeep') { // Preserve .gitkeep files
            await fs.rm(join(dirPath, file), { recursive: true, force: true });
          }
        }
      } catch (_error) {
        // Directory doesn't exist, which is fine
        console.log(`Directory ${dirPath} doesn't exist, skipping...`);
      }
    }

    // Clean jobs directory completely
    try {
      await fs.access(jobsDir);
      const files = await fs.readdir(jobsDir);

      for (const file of files) {
        await fs.rm(join(jobsDir, file), { recursive: true, force: true });
      }
    } catch (_error) {
      // Directory doesn't exist, which is fine
      console.log(`Directory ${jobsDir} doesn't exist, skipping...`);
    }

    // Ensure directories exist
    await fs.mkdir(join(uploadsDir, 'pcap'), { recursive: true });
    await fs.mkdir(join(uploadsDir, 'dictionary'), { recursive: true });
    await fs.mkdir(jobsDir, { recursive: true });

    console.log('✅ Uploads and jobs directories cleaned successfully');
  } catch (error) {
    console.error('❌ Failed to clean directories:', error);
    throw error;
  }
}

export async function cleanDatabase() {
  console.log('🧹 Cleaning database for e2e test...');

  try {
    // Delete all data in reverse order of dependencies
    await db.execute(sql`DELETE FROM cracked_passwords`);
    await db.execute(sql`DELETE FROM job_dictionaries`);
    await db.execute(sql`DELETE FROM job_networks`);
    await db.execute(sql`DELETE FROM job_pcaps`);
    await db.execute(sql`DELETE FROM jobs`);
    await db.execute(sql`DELETE FROM networks`);
    await db.execute(sql`DELETE FROM uploads`);
    await db.execute(sql`DELETE FROM users`);

    // Reset sequences (if they exist)
    const sequences = [
      'users_id_seq',
      'uploads_id_seq',
      'networks_id_seq',
      'jobs_id_seq',
      'cracked_passwords_id_seq'
    ];

    for (const seq of sequences) {
      try {
        await db.execute(sql`ALTER SEQUENCE ${sql.identifier(seq)} RESTART WITH 1`);
      } catch (error: unknown) {
        // Sequence doesn't exist, which is fine
        if (error instanceof Error &&
            (error.message.includes('does not exist') ||
             error.message.includes('relation'))) {
          console.log(`Sequence ${seq} does not exist, skipping...`);
        } else {
          console.error(`Unexpected error resetting sequence ${seq}:`, error);
          throw error;
        }
      }
    }

    // Recreate default user for job creation tests
    await db.execute(sql`INSERT INTO users (id, name, email, created_at, updated_at)
      VALUES (gen_random_uuid(), 'default_user', 'default@example.com', NOW(), NOW())`);

    console.log('✅ Database cleaned successfully and default user recreated');
  } catch (error) {
    console.error('❌ Failed to clean database:', error);
    throw error;
  }
}

export async function setupTestDatabase() {
  await cleanUploadsDirectory();
  await cleanDatabase();
}

export async function cleanupTestEnvironment() {
  await cleanUploadsDirectory();
  await cleanDatabase();
}

// Add a flag to prevent multiple cleanups during test retries
let isTestSetup = false;

export async function setupTestDatabaseOnce() {
  if (!isTestSetup) {
    await cleanUploadsDirectory();
    await cleanDatabase();
    isTestSetup = true;
  }
}