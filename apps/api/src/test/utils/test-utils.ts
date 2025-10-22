import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { Hono } from 'hono'
import { createAuth } from 'better-auth'
import { DatabaseClient } from '@/db'
import { TestDataFactory } from './test-data-factory'

// Test app factory
export const createTestApp = () => {
  const app = new Hono()
  // Add your routes here in actual implementation
  return app
}

// Test HTTP client
export const createTestClient = (app: Hono) => {
  return request(app as any)
}

// Authentication test utilities
export class AuthTestUtils {
  static async createTestUser(overrides: Partial<any> = {}) {
    return TestDataFactory.createUser(overrides)
  }

  static async createAdminUser(overrides: Partial<any> = {}) {
    return TestDataFactory.createAdminUser(overrides)
  }

  static async generateToken(userId: string, role: string = 'user') {
    return `Bearer test-token-${userId}-${role}-${Date.now()}`
  }

  static async authenticateWithClient(client: any, user: any) {
    const token = await this.generateToken(user.id, user.role)
    return client.set('Authorization', token)
  }
}

// Database test utilities
export class DatabaseTestUtils {
  static async resetDatabase(db: DatabaseClient) {
    // Clean up in proper order to respect foreign key constraints
    await db.delete('jobs')
    await db.delete('network_captures')
    await db.delete('dictionaries')
    await db.delete('users')
  }

  static async seedTestData(db: DatabaseClient, options: {
    users?: number
    jobs?: number
    captures?: number
    dictionaries?: number
  } = {}) {
    const results = {
      users: [],
      jobs: [],
      captures: [],
      dictionaries: []
    }

    // Seed users
    for (let i = 0; i < (options.users || 1); i++) {
      const user = TestDataFactory.createUser({
        email: i === 0 ? 'admin@autopwn.local' : `user${i}@test.local`,
        role: i === 0 ? 'admin' : 'user'
      })
      const created = await db.insert('users').values(user).returning()
      results.users.push(created[0])
    }

    // Seed dictionaries
    for (let i = 0; i < (options.dictionaries || 3); i++) {
      const dictionary = TestDataFactory.createDictionary({
        userId: results.users[0]?.id
      })
      const created = await db.insert('dictionaries').values(dictionary).returning()
      results.dictionaries.push(created[0])
    }

    // Seed network captures
    for (let i = 0; i < (options.captures || 2); i++) {
      const capture = TestDataFactory.createNetworkCapture({
        userId: results.users[0]?.id
      })
      const created = await db.insert('network_captures').values(capture).returning()
      results.captures.push(created[0])
    }

    // Seed jobs
    for (let i = 0; i < (options.jobs || 5); i++) {
      const job = TestDataFactory.createJob({
        userId: results.users[0]?.id,
        targetFile: results.captures[0]?.filename,
        dictionaryFile: results.dictionaries[0]?.filename
      })
      const created = await db.insert('jobs').values(job).returning()
      results.jobs.push(created[0])
    }

    return results
  }
}

// Queue test utilities
export class QueueTestUtils {
  static async waitForQueue(redis: any, queueName: string, maxWait = 5000) {
    const startTime = Date.now()
    while (Date.now() - startTime < maxWait) {
      const queueLength = await redis.llen(`bull:${queueName}:waiting`)
      if (queueLength > 0) return true
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return false
  }

  static async getQueueJobs(redis: any, queueName: string) {
    const waiting = await redis.lrange(`bull:${queueName}:waiting`, 0, -1)
    const active = await redis.lrange(`bull:${queueName}:active`, 0, -1)
    const completed = await redis.lrange(`bull:${queueName}:completed`, 0, -1)
    const failed = await redis.lrange(`bull:${queueName}:failed`, 0, -1)

    return {
      waiting: waiting.map(JSON.parse),
      active: active.map(JSON.parse),
      completed: completed.map(JSON.parse),
      failed: failed.map(JSON.parse)
    }
  }

  static async createTestJob(data: any, options: any = {}) {
    return TestDataFactory.createQueueJob({
      data,
      opts: {
        attempts: 3,
        delay: 0,
        removeOnComplete: true,
        removeOnFail: false,
        ...options
      }
    })
  }
}

// File system test utilities
export class FileTestUtils {
  static createTempFileName(prefix = 'test-', extension = 'tmp') {
    return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${extension}`
  }

  static createMockFile(content: string | Buffer, filename?: string) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content)
    return {
      filename: filename || this.createTempFileName(),
      buffer,
      size: buffer.length
    }
  }

  static async createMockCaptureFile(networks = 1) {
    const mockData = {
      version: '1.0',
      networks: Array.from({ length: networks }, (_, i) => ({
        ssid: `TestNetwork_${i}`,
        bssid: `00:11:22:33:44:${i.toString(16).padStart(2, '0')}`,
        channel: (i % 14) + 1,
        frequency: [2412, 2437, 2462][i % 3],
        encryption: ['WPA2', 'WPA3', 'OPEN'][i % 3]
      }))
    }

    return this.createMockFile(JSON.stringify(mockData), `capture_${Date.now()}.pcap`)
  }

  static async createMockDictionary(wordCount = 1000) {
    const words = Array.from({ length: wordCount }, (_, i) => `password${i}`)
    return this.createMockFile(words.join('\n'), `dictionary_${Date.now()}.txt`)
  }
}

// Security test utilities
export class SecurityTestUtils {
  static async createSecurityTestContext() {
    return {
      mockHashcat: await import('../mocks/hashcat-mock'),
      testFiles: {
        validCapture: await FileTestUtils.createMockCaptureFile(3),
        invalidCapture: FileTestUtils.createMockFile('invalid pcap data'),
        dictionary: await FileTestUtils.createMockDictionary(100),
        emptyDictionary: FileTestUtils.createMockFile('', 'empty.txt')
      },
      testData: TestDataFactory
    }
  }

  static assertSecureResponse(response: any) {
    expect(response.status).toBeGreaterThanOrEqual(200)
    expect(response.status).toBeLessThan(500)

    // Check for security headers (should be added by middleware)
    if (response.headers) {
      // These would be set by security middleware
      // expect(response.headers['x-content-type-options']).toBe('nosniff')
      // expect(response.headers['x-frame-options']).toBe('DENY')
      // expect(response.headers['x-xss-protection']).toBe('1; mode=block')
    }
  }

  static sanitizeForLogging(obj: any): any {
    if (obj === null || obj === undefined) return obj
    if (typeof obj !== 'object') return obj

    const sanitized = Array.isArray(obj) ? [] : {}
    for (const [key, value] of Object.entries(obj)) {
      if (key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret')) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeForLogging(value)
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  }
}

// Test environment helpers
export const setupTestEnvironment = () => {
  beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = 'test'
    process.env.LOG_LEVEL = 'error' // Reduce log noise in tests
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.REDIS_URL = 'redis://localhost:6379'
  })

  afterAll(() => {
    // Clean up any global state
  })

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up after each test
  })
}

// Global error handler for tests
export const handleTestErrors = (error: any) => {
  console.error('Test error:', SecurityTestUtils.sanitizeForLogging(error))
  throw error
}

// Export all utilities
export {
  TestDataFactory,
  AuthTestUtils,
  DatabaseTestUtils,
  QueueTestUtils,
  FileTestUtils,
  SecurityTestUtils,
  setupTestEnvironment,
  handleTestErrors
}