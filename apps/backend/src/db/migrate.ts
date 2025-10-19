import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { pool, db } from './index';

/**
 * Database Migration Runner
 *
 * Applies pending migrations to the database
 * Reads DATABASE_URL from environment at runtime
 *
 * Usage:
 *   pnpm --filter @autopwn/backend db:migrate
 */

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    await migrate(db, {
      migrationsFolder: './src/db/migrations',
    });

    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
