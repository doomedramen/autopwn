import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db, pool } from './index';
import { user, config } from './schema';
import crypto from 'crypto';

/**
 * Database Seed Script
 *
 * Creates initial superuser and default config
 * Reads configuration from environment variables at runtime
 *
 * Usage:
 *   INITIAL_SUPERUSER_EMAIL=admin@autopwn.local \
 *   INITIAL_SUPERUSER_PASSWORD=changeme123 \
 *   pnpm --filter @autopwn/backend db:seed
 */

function generateRandomPassword(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateUserId(): string {
  // Better Auth uses string IDs, we'll use a similar format
  return crypto.randomBytes(16).toString('hex');
}

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Check if config exists, create if not
    const existingConfig = await db.query.config.findFirst();

    if (!existingConfig) {
      console.log('📝 Creating default config...');
      await db.insert(config).values({
        id: 1,
        maxConcurrentJobs: 2,
        maxPcapSize: 104857600, // 100MB
        maxDictionarySize: 1073741824, // 1GB
        maxGeneratedDictSize: 104857600, // 100MB
        maxGenerationKeywords: 10,
        hashcatDefaultWorkload: 2,
        hashcatJobTimeout: 86400, // 24 hours
        allowUserRegistration: false,
      });
      console.log('✅ Default config created');
    } else {
      console.log('ℹ️  Config already exists, skipping');
    }

    // Check if superuser exists
    const existingSuperuser = await db.query.user.findFirst({
      where: eq(user.role, 'superuser'),
    });

    if (existingSuperuser) {
      console.log('ℹ️  Superuser already exists, skipping');
      return;
    }

    // Get credentials from environment or generate
    const email = process.env.INITIAL_SUPERUSER_EMAIL || 'admin@autopwn.local';
    const password =
      process.env.INITIAL_SUPERUSER_PASSWORD || generateRandomPassword();

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate user ID (Better Auth style)
    const userId = generateUserId();

    // Create superuser
    await db.insert(user).values({
      id: userId,
      name: 'Superuser',
      email,
      emailVerified: true, // Superuser doesn't need to verify
      passwordHash,
      role: 'superuser',
      isActive: true,
    });

    console.log('');
    console.log('✅ Initial superuser created successfully!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:    ', email);
    console.log('🔑 Password: ', password);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password immediately after first login!');
    console.log('');

    if (!process.env.INITIAL_SUPERUSER_PASSWORD) {
      console.log(
        '💡 TIP: Set INITIAL_SUPERUSER_PASSWORD env var to use a custom password'
      );
      console.log('');
    }
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
