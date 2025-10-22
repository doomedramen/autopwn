import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Connection for migrations
const migrationClient = postgres(process.env.DATABASE_URL!, { 
  max: 1,
  connect_timeout: 10, // 10 seconds timeout
  idle_in_transaction_session_timeout: 30000, // 30 seconds
  connection: {
    application_name: 'autopwn-migration'
  }
})

// Connection for queries
const queryClient = postgres(process.env.DATABASE_URL!, {
  connect_timeout: 10, // 10 seconds timeout
  idle_in_transaction_session_timeout: 30000, // 30 seconds
  connection: {
    application_name: 'autopwn-app'
  }
})

export const db = drizzle(queryClient, { schema })

export const migrationDb = drizzle(migrationClient, { schema })

export { schema }