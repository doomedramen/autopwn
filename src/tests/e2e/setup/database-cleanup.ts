import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../../lib/db/schema';

// Tables in order of dependency (child tables first)
// BetterAuth tables: sessions, verifications, accounts, users
const TABLES_TO_CLEAN = [
  'cracked_passwords',
  'job_dictionaries',
  'job_networks',
  'job_pcaps',
  'jobs',
  'networks',
  'uploads',
  'user_profiles',
  'sessions', // BetterAuth sessions
  'verifications', // BetterAuth email verifications
  'accounts', // BetterAuth accounts
  'users', // Users table (accounts depends on users)
];

export class DatabaseCleanup {
  private db: ReturnType<typeof drizzle>;
  private client: ReturnType<typeof postgres>;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Add connection pooling and timeout settings
    this.client = postgres(connectionString, {
      max: 1, // Single connection to avoid conflicts
      idle_timeout: 20,
      connect_timeout: 10,
    });
    this.db = drizzle(this.client, { schema });
  }

  async cleanAllTables(): Promise<void> {
    console.log('🧹 Cleaning database tables...');

    // Set a timeout for the entire operation
    const timeout = Promise.race([
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database cleanup timeout')), 30000)
      ),
      this.performCleanup(),
    ]);

    try {
      await timeout;
      console.log('✅ Database cleanup complete');
    } catch (error) {
      console.error('❌ Database cleanup failed:', error);
      throw error;
    } finally {
      // Always close the connection
      await this.client.end();
    }
  }

  private async performCleanup(): Promise<void> {
    // First, kill any existing connections to avoid locks
    try {
      await this.db.execute(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND query <> '<IDLE>'
      `);
      console.log('🧹 Terminated existing database connections');

      // Small delay to allow connections to terminate
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log('⚠ Could not terminate existing connections:', error);
    }

    // Force stop any running jobs first by updating their status
    try {
      await this.db.execute(`
        UPDATE jobs
        SET status = 'stopped',
            progress = 0,
            completed_at = NOW()
        WHERE status IN ('running', 'processing', 'pending')
      `);
      console.log('🧹 Force stopped any running jobs');
    } catch (error) {
      console.log('⚠ Could not stop running jobs:', error);
    }

    // Clear any corrupted BetterAuth session and user data
    try {
      // Clean up expired sessions and orphaned data
      await this.db.execute(`
        DELETE FROM sessions WHERE expires_at < NOW() OR user_id NOT IN (SELECT id FROM users)
      `);
      await this.db.execute(`
        DELETE FROM verifications WHERE expires_at < NOW()
      `);
      await this.db.execute(`
        DELETE FROM accounts WHERE user_id NOT IN (SELECT id FROM users)
      `);

      console.log('🧹 Cleared corrupted BetterAuth data');
    } catch (error) {
      console.log('⚠ Could not clear corrupted BetterAuth data:', error);
    }
    // Disable foreign key constraints temporarily
    await this.db.execute('SET session_replication_role = replica;');

    try {
      // Use DELETE instead of TRUNCATE for better control and add timeouts
      for (const tableName of TABLES_TO_CLEAN) {
        console.log(`🧹 Cleaning table: ${tableName}`);

        // Add a timeout for each table operation
        await Promise.race([
          this.db.execute(`DELETE FROM ${tableName};`),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout cleaning table ${tableName}`)),
              10000
            )
          ),
        ]);

        // Reset identity if table has it
        try {
          await this.db.execute(
            `ALTER TABLE ${tableName} ALTER COLUMN id RESTART WITH 1;`
          );
        } catch (error) {
          // Ignore errors for tables without identity columns
        }

        console.log(`✓ Cleaned table: ${tableName}`);
      }
      // Additional cleanup for any sequences that might be out of sync
      try {
        await this.db.execute(`
          SELECT setval(pg_get_serial_sequence('"jobs"', 'id'), 1, false);
          SELECT setval(pg_get_serial_sequence('"users"', 'id'), 1, false);
          SELECT setval(pg_get_serial_sequence('"uploads"', 'id'), 1, false);
          SELECT setval(pg_get_serial_sequence('"networks"', 'id'), 1, false);
        `);
        console.log('🧹 Reset database sequences');
      } catch (error) {
        console.log('⚠ Could not reset sequences:', error);
      }
    } finally {
      // Re-enable foreign key constraints
      await this.db.execute('SET session_replication_role = DEFAULT;');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.db.execute('SELECT 1');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
  }
}
