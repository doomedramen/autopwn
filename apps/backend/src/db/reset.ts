import { sql } from 'drizzle-orm';
import { db, pool } from './index';

/**
 * Database Reset Script
 *
 * WARNING: This will DROP ALL TABLES and recreate them
 * Only use in development!
 *
 * Usage:
 *   pnpm --filter @autopwn/backend db:reset
 */

async function reset() {
  console.log('⚠️  WARNING: This will DELETE ALL DATA!');

  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot run reset in production!');
    process.exit(1);
  }

  console.log('🗑️  Dropping all tables...');

  try {
    // Drop all tables (cascade to handle foreign keys)
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);

    console.log('✅ All tables dropped');
    console.log('');
    console.log('Now run:');
    console.log('  pnpm --filter @autopwn/backend db:migrate');
    console.log('  pnpm --filter @autopwn/backend db:seed');
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

reset();
