import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

// Create a postgres client
const connectionString = process.env.DATABASE_URL || "postgresql://localhost/autopwn";
const client = postgres(connectionString);

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export all schema tables for convenience
export * from './schema.js';