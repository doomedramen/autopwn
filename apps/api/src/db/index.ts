import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Connection for migrations
const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 })

// Connection for queries
const queryClient = postgres(process.env.DATABASE_URL!)

export const db = drizzle(queryClient, { schema })

export const migrationDb = drizzle(migrationClient, { schema })

export { schema }