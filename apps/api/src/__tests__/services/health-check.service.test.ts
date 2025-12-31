import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '../db/index'
import { healthCheckService } from '../services/health-check.service'
import { logger } from '../lib/logger'

describe('HealthCheckService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    logger.info = vi.fn()
    logger.warn = vi.fn()
    logger.error = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    logger.info = vi.fn()
    logger.warn = vi.fn()
    logger.error = vi.fn()
  })

  describe('Database health check', () => {
    it('should return healthy status when database is accessible', async () => {
      const dbSpy = vi.spyOn(db, 'execute', 'mockResolvedValue')
      dbSpy.mockResolvedValueOnce({
        count: '1',
      })

      const result = await healthCheckService['checkDatabase']()

      expect(result.status).toBe('healthy')
      expect(result.message).toContain('connection successful')
      expect(result.latency).toBeGreaterThanOrEqual(0)
      expect(dbSpy).toHaveBeenCalledWith(
        expect.stringContaining('SELECT 1')
      )
    })

    it('should return unhealthy status when database fails', async () => {
      const dbSpy = vi.spyOn(db, 'execute', 'mockRejectedValue')
      dbSpy.mockRejectedValueOnce(new Error('Connection failed'))

      const result = await healthCheckService['checkDatabase']()

      expect(result.status).toBe('unhealthy')
      expect(result.message).toContain('connection failed')
      expect(result.latency).toBeUndefined()
    })
  })

  describe('Redis/queue health check', () => {
    it('should return healthy status when Redis is accessible', async () => {
      const result = await healthCheckService['checkRedis']()

      expect(result.status).toBe('healthy')
      expect(result.message).toContain('healthy')
      expect(result.latency).toBeGreaterThan(0)
      expect(result.queueStats).toBeDefined()
    })

    it('should return degraded status when queue has issues', async () => {
      const queueSpy = vi.spyOn(await import('../lib/queue'), 'checkQueueHealth', 'mockResolvedValue')
      queueSpy.mockResolvedValueOnce({
        status: 'unhealthy',
        queues: { pcap_processing: 10 },
      })

      const result = await healthCheckService['checkRedis']()

      expect(result.status).toBe('degraded')
      expect(result.message).toContain('issue')
      expect(result.queueStats).toBeDefined()
    })
  })

  describe('Worker health check', () => {
    it('should return healthy status when workers are operational', async () => {
      const queueSpy = vi.spyOn(await import('../lib/queue'), 'checkQueueHealth', 'mockResolvedValue')
      queueSpy.mockResolvedValueOnce({
        status: 'healthy',
        queues: { pcap_processing: 0, waiting: 0 },
      })

      const result = await healthCheckService['checkWorkers']()

      expect(result.status).toBe('healthy')
      expect(result.message).toContain('operational')
      expect(result.details).toBeDefined()
    })

    it('should return degraded status when workers have queue issues', async () => {
      const queueSpy = vi.spyOn(await import('../lib/queue'), 'checkQueueHealth', 'mockResolvedValue')
      queueSpy.mockResolvedValueOnce({
        status: 'unhealthy',
        queues: { pcap_processing: 5, waiting: 2 },
      })

      const result = await healthCheckService['checkWorkers']()

      expect(result.status).toBe('degraded')
      expect(result.message).toContain('degraded due to queue issues')
    })
  })

  describe('Disk health check', () => {
    it('should return healthy status when disk usage is below threshold', async () => {
      const fsSpy = vi.spyOn(require('fs/promises'), 'statfs', 'mockResolvedValue')
      fsSpy.mockResolvedValueOnce({
        total: 1000000000000, // 1TB
        free: 900000000000, // 900GB free
      })

      const result = await healthCheckService['checkDisk']()

      expect(result.status).toBe('healthy')
      expect(result.usedBytes).toBe(100000000000)
      expect(result.totalBytes).toBe(1000000000000)
      expect(result.usedPercentage).toBe(10)
      expect(result.message).toContain('at 10%')
      expect(fsSpy).toHaveBeenCalled()
    })

    it('should return degraded status when disk usage is above warning threshold', async () => {
      const fsSpy = vi.spyOn(require('fs/promises'), 'statfs', 'mockResolvedValue')
      fsSpy.mockResolvedValueOnce({
        total: 1000000000000,
        free: 15000000000, // 150GB free = 85% used
      })

      const result = await healthCheckService['checkDisk']()

      expect(result.status).toBe('degraded')
      expect(result.usedPercentage).toBe(85)
      expect(result.message).toContain('Warning: Disk usage at 85%')
      expect(fsSpy).toHaveBeenCalled()
    })

    it('should return unhealthy status when disk usage is above critical threshold', async () => {
      const fsSpy = vi.spyOn(require('fs/promises'), 'statfs', 'mockResolvedValue')
      fsSpy.mockResolvedValueOnce({
        total: 1000000000000,
        free: 5000000000, // 50GB free = 95% used
      })

      const result = await healthCheckService['checkDisk']()

      expect(result.status).toBe('unhealthy')
      expect(result.usedPercentage).toBe(95)
      expect(result.message).toContain('Critical: Disk usage at 95%')
      expect(fsSpy).toHaveBeenCalled()
    })

    it('should fallback to system-wide disk check when data paths not found', async () => {
      const fsSpy = vi.spyOn(require('fs/promises'), 'statfs', 'mockResolvedValue')
      const rootSpy = vi.spyOn(require('fs/promises'), 'statfs', 'mockResolvedValue')
      
      fsSpy.mockRejectedValueOnce(new Error('Path not found'))
      rootSpy.mockRejectedValueOnce(new Error('Path not found'))

      const result = await healthCheckService['checkDisk']()

      expect(result.status).toBe('unhealthy')
      expect(result.message).toContain('Disk check failed')
      expect(fsSpy).toHaveBeenCalled()
      expect(rootSpy).toHaveBeenCalled()
    })
  })

  describe('Overall health check', () => {
    it('should return healthy status when all checks pass', async () => {
      vi.spyOn(await import('../lib/queue'), 'checkQueueHealth', 'mockResolvedValue')
        .mockResolvedValueOnce({
          status: 'healthy',
          queues: { pcap_processing: 0, waiting: 0 },
        })

      vi.spyOn(require('fs/promises'), 'statfs', 'mockResolvedValue')
        .mockResolvedValueOnce({
          total: 1000000000000,
          free: 9000000000000,
        })

      const dbSpy = vi.spyOn(db, 'execute', 'mockResolvedValue')
        dbSpy.mockResolvedValueOnce({ count: '1' })

      const result = await healthCheckService.performHealthCheck()

      expect(result.status).toBe('healthy')
      expect(result.checks.database.status).toBe('healthy')
      expect(result.checks.redis.status).toBe('healthy')
      expect(result.checks.workers.status).toBe('healthy')
      expect(result.checks.disk.status).toBe('healthy')
      expect(result.checks.database.latency).toBeGreaterThan(0)
      expect(result.checks.redis.latency).toBeGreaterThan(0)
      expect(result.checks.disk.usedPercentage).toBeLessThan(90)
      expect(result.uptime).toBeGreaterThan(0)
    })

    it('should return degraded status when one check fails', async () => {
      vi.spyOn(await import('../lib/queue'), 'checkQueueHealth', 'mockResolvedValue')
        .mockResolvedValueOnce({
          status: 'degraded',
          queues: { pcap_processing: 0, waiting: 0 },
        })

      const result = await healthCheckService.performHealthCheck()

      expect(result.status).toBe('degraded')
      expect(result.checks.database.status).toBe('healthy')
      expect(result.checks.redis.status).toBe('degraded')
      expect(result.checks.workers.status).toBe('degraded')
      expect(result.checks.disk.status).toBe('healthy')
      expect(result.checks.redis.message).toContain('issue')
      expect(result.checks.workers.message).toContain('degraded')
    })

    it('should return unhealthy status when multiple checks fail', async () => {
      const fsSpy = vi.spyOn(require('fs/promises'), 'statfs', 'mockResolvedValue')
      fsSpy.mockResolvedValueOnce({
        total: 1000000000000,
        free: 5000000000,
      })

      vi.spyOn(await import('../lib/queue'), 'checkQueueHealth', 'mockResolvedValue')
        .mockResolvedValueOnce({
          status: 'unhealthy',
          queues: { pcap_processing: 10, waiting: 5 },
        })

      const dbSpy = vi.spyOn(db, 'execute', 'mockRejectedValueOnce(new Error('DB error')))

      const result = await healthCheckService.performHealthCheck()

      expect(result.status).toBe('unhealthy')
      expect(result.checks.database.status).toBe('unhealthy')
      expect(result.checks.disk.status).toBe('unhealthy')
      expect(result.checks.redis.status).toBe('healthy')
      expect(result.checks.workers.status).toBe('unhealthy')
      expect(result.checks.disk.message).toContain('Critical: Disk usage at 95%')
      expect(result.checks.disk.usedPercentage).toBe(95)
    })
  })

  describe('getSummary', () => {
    it('should return service summary', () => {
      const summary = healthCheckService.getSummary()

      expect(summary.startTime).toBeInstanceOf(Date)
      expect(summary.uptime).toBeGreaterThan(0)
      expect(summary.uptimeFormatted).toMatch(/\d+h+ \d+m+ \d+s/)
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const dbSpy = vi.spyOn(db, 'execute', 'mockRejectedValueOnce(new Error('Connection timeout')))

      const result = await healthCheckService['checkDatabase']()

      expect(result.status).toBe('unhealthy')
      expect(result.message).toContain('Connection timeout')
      expect(logger.error).toHaveBeenCalled()
    })

    it('should handle filesystem errors gracefully', async () => {
      const fsSpy = vi.spyOn(require('fs/promises'), 'statfs', 'mockRejectedValueOnce(new Error('Permission denied'))

      const result = await healthCheckService['checkDisk']()

      expect(result.status).toBe('unhealthy')
      expect(result.message).toContain('Permission denied')
      expect(logger.error).toHaveBeenCalled()
    })

    it('should handle Redis errors gracefully', async () => {
      const queueSpy = vi.spyOn(await import('../lib/queue'), 'checkQueueHealth', 'mockRejectedValueOnce(new Error('Redis connection failed')))

      const result = await healthCheckService['checkRedis']()

      expect(result.status).toBe('unhealthy')
      expect(result.message).toContain('Redis connection failed')
      expect(logger.error).toHaveBeenCalled()
    })
  })
})
