import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Database Connection
 *
 * Uses connection pooling for optimal performance
 * Configuration is read from environment variables at runtime
 *
 * See docs/DEVELOPMENT.md for runtime configuration philosophy
 */

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create PostgreSQL connection pool
// Pool configuration is read from DATABASE_URL at runtime
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(
    process.env.DATABASE_CONNECTION_TIMEOUT || '2000',
    10
  ),
});

// Create Drizzle instance with schema
export const db = drizzle(pool, { schema });

// Graceful shutdown handler
export async function closeDatabase(): Promise<void> {
  await pool.end();
}

// Export schema for convenience
export { schema };
