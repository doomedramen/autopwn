import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/db/schema'
import { Redis } from 'ioredis'

let testDb: any = null
let testRedis: Redis | null = null

beforeAll(async () => {
  // Initialize database connection
  if (process.env.DATABASE_URL) {
    const connectionString = process.env.DATABASE_URL
    const client = postgres(connectionString)
    testDb = drizzle(client, { schema })
  }

  // Initialize Redis connection
  if (process.env.REDIS_URL) {
    testRedis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    })
    await testRedis.connect()
  }
})

afterAll(async () => {
  // Clean up database connection
  if (testDb) {
    await testDb.$client.end()
  }

  // Clean up Redis connection
  if (testRedis) {
    await testRedis.quit()
    testRedis = null
  }
})

beforeEach(async () => {
  // Clean up Redis before each test
  if (testRedis) {
    await testRedis.flushdb()
  }

  // Reset any test-specific data
  if (testDb) {
    // You can add specific table truncation here if needed
    // await testDb.delete(schema.users)
  }
})

afterEach(async () => {
  // Additional cleanup after each test if needed
})

// Export test utilities
export { testDb, testRedis }

// Helper functions for integration tests
export const createTestUser = async (userData: any) => {
  if (!testDb) throw new Error('Test database not initialized')

  const user = await testDb.insert(schema.users).values({
    ...userData,
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning()

  return user[0]
}

export const createTestJob = async (jobData: any) => {
  if (!testDb) throw new Error('Test database not initialized')

  const job = await testDb.insert(schema.jobs).values({
    ...jobData,
    id: crypto.randomUUID(),
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning()

  return job[0]
}

export const waitForQueue = async (queueName: string, maxWait = 5000) => {
  if (!testRedis) throw new Error('Test Redis not initialized')

  const startTime = Date.now()
  while (Date.now() - startTime < maxWait) {
    const queueLength = await testRedis.llen(`bull:${queueName}:waiting`)
    if (queueLength > 0) return true
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}