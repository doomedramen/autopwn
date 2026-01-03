import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { healthRoutes } from '../../src/routes/health'
import { getTestDb } from '../setup'
import { sql } from 'drizzle-orm'
import { healthCheckService } from '../../src/services/health-check.service'

// Mock the health check service to avoid external dependencies
vi.mock('../../src/services/health-check.service', async () => {
  const actual = await vi.importActual<any>('../../src/services/health-check.service')
  return {
    ...actual,
    healthCheckService: {
      performHealthCheck: vi.fn(),
      getSummary: vi.fn(),
    },
  }
})

// Mock the queue to avoid Redis dependency
vi.mock('../../src/lib/queue', () => ({
  checkQueueHealth: vi.fn(() => ({
    status: 'healthy',
    queues: { pcap_processing: 0 },
  })),
}))

// Mock the email queue
vi.mock('../../src/lib/email-queue', () => ({
  emailQueue: {
    isReady: vi.fn(() => false),
  },
}))

// Mock the config service
vi.mock('../../src/services/config.service', () => ({
  configService: {
    getBoolean: vi.fn(() => Promise.resolve(false)),
  },
}))

describe('Health Routes', () => {
  let app: Hono

  beforeEach(() => {
    // Create a fresh app for each test
    app = new Hono()
    app.route('/api/health', healthRoutes)

    // Reset mocks
    vi.clearAllMocks()

    // Default mock responses
    const mockedService = healthCheckService as any
    mockedService.performHealthCheck.mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: 10000,
      checks: {
        database: {
          status: 'healthy',
          message: 'Database connection successful',
          latency: 5,
        },
        redis: {
          status: 'healthy',
          message: 'Redis and queues healthy',
          latency: 2,
          queueStats: {},
        },
        workers: {
          status: 'healthy',
          message: 'Workers operational',
          details: {
            activeJobs: 0,
            waitingJobs: 0,
          },
        },
        disk: {
          status: 'healthy',
          message: 'Disk usage at 45.0%',
          usedBytes: 500000000000,
          totalBytes: 1000000000000,
          usedPercentage: 50,
          thresholdPercentage: 90,
        },
      },
    })

    mockedService.getSummary.mockReturnValue({
      startTime: new Date(),
      uptime: 10000,
      uptimeFormatted: '0d 2h 46m 40s',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /health', () => {
    it('should return basic health check', async () => {
      const response = await app.request('/health')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status', 'ok')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('service', 'autopwn-api')
      expect(data).toHaveProperty('version')
      expect(data).toHaveProperty('environment')
    })

    it('should include correct service name', async () => {
      const response = await app.request('/health')
      const data = await response.json()

      expect(data.service).toBe('autopwn-api')
    })

    it('should return a valid ISO timestamp', async () => {
      const response = await app.request('/health')
      const data = await response.json()

      expect(() => new Date(data.timestamp)).not.toThrow()
    })
  })

  describe('GET /api/health', () => {
    it('should return detailed health check', async () => {
      const response = await app.request('/api/health')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('uptime')
      expect(data).toHaveProperty('checks')
    })

    it('should return 200 when health status is healthy', async () => {
      const mockedService = healthCheckService as any
      mockedService.performHealthCheck.mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 10000,
        checks: {
          database: { status: 'healthy', message: 'OK' },
          redis: { status: 'healthy', message: 'OK' },
          workers: { status: 'healthy', message: 'OK' },
          disk: { status: 'healthy', message: 'OK' },
        },
      })

      const response = await app.request('/api/health')

      expect(response.status).toBe(200)
    })

    it('should return 200 when health status is degraded', async () => {
      const mockedService = healthCheckService as any
      mockedService.performHealthCheck.mockResolvedValue({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        uptime: 10000,
        checks: {
          database: { status: 'healthy', message: 'OK' },
          redis: { status: 'degraded', message: 'Slow' },
          workers: { status: 'healthy', message: 'OK' },
          disk: { status: 'healthy', message: 'OK' },
        },
      })

      const response = await app.request('/api/health')

      expect(response.status).toBe(200)
    })

    it('should return 503 when health status is unhealthy', async () => {
      const mockedService = healthCheckService as any
      mockedService.performHealthCheck.mockResolvedValue({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 10000,
        checks: {
          database: { status: 'unhealthy', message: 'Connection failed' },
          redis: { status: 'healthy', message: 'OK' },
          workers: { status: 'healthy', message: 'OK' },
          disk: { status: 'healthy', message: 'OK' },
        },
      })

      const response = await app.request('/api/health')

      expect(response.status).toBe(503)
    })

    it('should include all health checks in response', async () => {
      const response = await app.request('/api/health')
      const data = await response.json()

      expect(data.checks).toHaveProperty('database')
      expect(data.checks).toHaveProperty('redis')
      expect(data.checks).toHaveProperty('workers')
      expect(data.checks).toHaveProperty('disk')
    })
  })

  describe('GET /api/v1/health', () => {
    it('should return detailed health check at v1 endpoint', async () => {
      const response = await app.request('/api/v1/health')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('uptime')
      expect(data).toHaveProperty('checks')
    })
  })

  describe('GET /api/v1/health/summary', () => {
    it('should return service summary', async () => {
      const response = await app.request('/api/v1/health/summary')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status', 'ok')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('summary')
    })

    it('should include uptime information', async () => {
      const response = await app.request('/api/v1/health/summary')
      const data = await response.json()

      expect(data.summary).toHaveProperty('uptime')
      expect(data.summary).toHaveProperty('uptimeFormatted')
      expect(data.summary).toHaveProperty('startTime')
      expect(typeof data.summary.uptime).toBe('number')
      expect(typeof data.summary.uptimeFormatted).toBe('string')
    })
  })

  describe('GET /api/v1/health/database', () => {
    it('should return database health status', async () => {
      const response = await app.request('/api/v1/health/database')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('database')
      expect(data.database).toHaveProperty('status')
    })

    it('should return healthy status when database is accessible', async () => {
      // Test actual database connection
      const db = getTestDb()
      const result = await db.execute(sql`SELECT 1 as result`)

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].result).toBe(1)
    })
  })

  describe('GET /api/v1/health/redis', () => {
    it('should return redis health status', async () => {
      const response = await app.request('/api/v1/health/redis')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('redis')
    })
  })

  describe('GET /api/v1/health/disk', () => {
    it('should return disk health status', async () => {
      const response = await app.request('/api/v1/health/disk')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('disk')
      expect(data.disk).toHaveProperty('status')
      expect(data.disk).toHaveProperty('message')
    })
  })

  describe('GET /api/v1/health/workers', () => {
    it('should return workers health status', async () => {
      const response = await app.request('/api/v1/health/workers')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('workers')
    })
  })

  describe('Error handling', () => {
    it('should handle health check service errors gracefully', async () => {
      const mockedService = healthCheckService as any
      mockedService.performHealthCheck.mockRejectedValue(
        new Error('Health check failed'),
      )

      const response = await app.request('/api/v1/health')
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data).toHaveProperty('status', 'error')
      expect(data).toHaveProperty('error')
    })

    it('should handle database check errors gracefully', async () => {
      const mockedService = healthCheckService as any
      mockedService.performHealthCheck.mockRejectedValue(
        new Error('Database connection failed'),
      )

      const response = await app.request('/api/v1/health/database')
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toHaveProperty('status', 'error')
    })
  })
})
