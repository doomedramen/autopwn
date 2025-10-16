import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { logInfo, logError } from '@/lib/logger';

// Database connection string from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create postgres client with connection pooling
const client = postgres(connectionString, {
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Maximum time to establish connection
});

// Create Drizzle instance
export const db = drizzle(client, { schema });

// Export all tables for easy access
export * from './schema';

// Export database connection for migrations
export { client };

// Helper function to test database connection
export async function testConnection() {
  try {
    await client`SELECT 1`;
    logInfo('Database connection successful');
    return true;
  } catch (error) {
    logError('Database connection failed:', error);
    return false;
  }
}
