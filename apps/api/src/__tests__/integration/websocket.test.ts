import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { WebSocketServer, getWebSocketServer } from '../../../lib/websocket'
import { db } from '../../../db'
import { jobs, users } from '../../../db/schema'
import { eq } from 'drizzle-orm'

describe('WebSocket Integration Tests', () => {
  let wsServer: WebSocketServer
  let testUserId: string
  let testJob: any

  beforeAll(async () => {
    // Setup test database and user
    testUserId = 'test-user-websocket'

    await db.insert(users).values({
      id: testUserId,
      email: 'test-websocket@example.com',
      password: 'test_password_hash',
      role: 'user',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Create test job
    const [job] = await db.insert(jobs).values({
      name: 'Test WebSocket Job',
      type: 'wordlist',
      userId: testUserId,
      networkId: 'test-network-id',
      dictionaryId: 'test-dict-id',
      status: 'pending',
      progress: 0,
      config: { type: 'wordlist' },
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()
    testJob = job

    // Get WebSocket server instance
    wsServer = getWebSocketServer()
    await wsServer.start()
  }, 30000) // 30 second timeout for WebSocket server startup

  beforeEach(async () => {
    // Reset job status before each test
    await db.update(jobs)
      .set({
        status: 'pending',
        progress: 0,
        updatedAt: new Date()
      })
      .where(eq(jobs.id, testJob.id))
  })

  afterEach(async () => {
    // Clean up any test data
    await db.update(jobs)
      .set({
        status: 'pending',
        progress: 0,
        updatedAt: new Date()
      })
      .where(eq(jobs.id, testJob.id))
  })

  afterAll(async () => {
    // Clean up test data
    await db.delete(jobs).where(eq(jobs.id, testJob.id))
    await db.delete(users).where(eq(users.id, testUserId))

    // Stop WebSocket server
    await wsServer.stop()
  })

  it('should start WebSocket server successfully', () => {
    const stats = wsServer.getStats()
    expect(stats.isHealthy).toBe(true)
    expect(stats.clientCount).toBe(0)
    expect(stats.uptime).toBeGreaterThan(0)
  })

  it('should broadcast job updates to subscribers', async () => {
    const mockUpdate = {
      id: testJob.id,
      status: 'running',
      progress: 25,
      startTime: new Date().toISOString(),
      metadata: {
        type: 'hashcat_execution',
        stage: 'processing'
      }
    }

    // Broadcast job update
    wsServer.broadcastJobUpdate(mockUpdate)

    // Verify stats (no direct way to verify broadcast without a client)
    const stats = wsServer.getStats()
    expect(stats.isHealthy).toBe(true)
  })

  it('should broadcast system messages', async () => {
    const message = 'Test system message'
    const level = 'info' as const

    // Broadcast system message
    wsServer.broadcastSystemMessage(message, level)

    // Verify stats (no direct way to verify broadcast without a client)
    const stats = wsServer.getStats()
    expect(stats.isHealthy).toBe(true)
  })

  it('should handle job updates with different statuses', async () => {
    const statuses = ['pending', 'running', 'completed', 'failed', 'cancelled']

    for (const status of statuses) {
      const mockUpdate = {
        id: testJob.id,
        status,
        progress: status === 'completed' ? 100 : status === 'failed' ? 0 : Math.floor(Math.random() * 100),
        metadata: {
          test: true
        }
      }

      // Should not throw
      expect(() => {
        wsServer.broadcastJobUpdate(mockUpdate)
      }).not.toThrow()
    }
  })

  it('should handle job updates with metadata', async () => {
    const mockUpdate = {
      id: testJob.id,
      status: 'running',
      progress: 50,
      metadata: {
        type: 'dictionary_generation',
        stage: 'generating_content',
        baseWordsCount: 1000,
        rulesCount: 10,
        transformationsCount: 5,
        userId: testUserId
      }
    }

    // Should not throw
    expect(() => {
      wsServer.broadcastJobUpdate(mockUpdate)
    }).not.toThrow()
  })

  it('should handle error conditions gracefully', async () => {
    // Test with invalid job ID
    const invalidUpdate = {
      id: 'invalid-job-id',
      status: 'running',
      progress: 25
    }

    // Should not throw
    expect(() => {
      wsServer.broadcastJobUpdate(invalidUpdate)
    }).not.toThrow()
  })

  it('should handle concurrent job updates', async () => {
    const updates = Array.from({ length: 10 }, (_, i) => ({
      id: testJob.id,
      status: 'running',
      progress: i * 10,
      metadata: { batch: i }
    }))

    // Broadcast multiple updates rapidly
    for (const update of updates) {
      expect(() => {
        wsServer.broadcastJobUpdate(update)
      }).not.toThrow()
    }

    // Server should still be healthy
    const stats = wsServer.getStats()
    expect(stats.isHealthy).toBe(true)
  })

  it('should handle large metadata objects', async () => {
    const largeMetadata = {
      type: 'hashcat_execution',
      stage: 'processing',
      baseWordsCount: 10000,
      rulesCount: 100,
      transformationsCount: 50,
      // Add a lot of extra data
      extraData: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `test-value-${i}`,
        nested: {
          level1: {
            level2: {
              data: `nested-data-${i}`
            }
          }
        }
      }))
    }

    const mockUpdate = {
      id: testJob.id,
      status: 'running',
      progress: 75,
      metadata: largeMetadata
    }

    // Should not throw even with large metadata
    expect(() => {
      wsServer.broadcastJobUpdate(mockUpdate)
    }).not.toThrow()
  })

  it('should maintain server health under load', async () => {
    const initialStats = wsServer.getStats()
    expect(initialStats.isHealthy).toBe(true)

    // Simulate heavy load
    const updates = Array.from({ length: 100 }, (_, i) => ({
      id: testJob.id,
      status: i % 2 === 0 ? 'running' : 'completed',
      progress: (i + 1) % 101,
      metadata: { loadTest: true, iteration: i }
    }))

    for (const update of updates) {
      wsServer.broadcastJobUpdate(update)
    }

    // Broadcast system messages too
    for (let i = 0; i < 10; i++) {
      wsServer.broadcastSystemMessage(`Load test message ${i}`, 'info')
    }

    // Server should still be healthy
    const finalStats = wsServer.getStats()
    expect(finalStats.isHealthy).toBe(true)
    expect(finalStats.uptime).toBeGreaterThan(0)
  })
})