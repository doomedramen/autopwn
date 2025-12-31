import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '../db/index'
import { auditService } from '../services/audit.service'
import { logger } from '../lib/logger'

describe('AuditService', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    logger.info = vi.fn()
    logger.warn = vi.fn()
    logger.error = vi.fn()
  })

  describe('logEvent', () => {
    it('should log audit event successfully', async () => {
      await auditService.logEvent({
        userId: 'test-user-id',
        action: 'test.action',
        entityType: 'test.entity',
        entityId: 'test-entity-id',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        success: true,
      })

      expect(logger.info).toHaveBeenCalledWith(
        'Audit event logged',
        'audit-service',
        expect.any(Object)
      )
    })

    it('should not throw error when logging fails', async () => {
      const dbSpy = vi.spyOn(db, 'insert', 'mockRejectedValueOnce')
      dbSpy.mockRejectedValueOnce(new Error('Database error'))

      await auditService.logEvent({
        action: 'test.action',
      })

      // Should log error but not throw
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('query methods', () => {
    beforeEach(async () => {
      const dbSpy = vi.spyOn(db, 'query', 'mockResolvedValue')
      dbSpy.mockResolvedValue({
        count: '10',
      rows: Array(10).fill({
          id: 'test-id',
          userId: 'test-user',
          action: 'test.action',
          success: true,
        }),
      })
    })

    it('should get all audit logs', async () => {
      const result = await auditService.query({
        page: 1,
        limit: 50,
      })

      expect(db.query).toHaveBeenCalled()
      expect(result.data).toHaveLength(10)
      expect(result.pagination.total).toBe(10)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(50)
      expect(result.pagination.totalPages).toBe(1)
    })

    it('should filter by user ID', async () => {
      const result = await auditService.getByUserId('test-user-id', {
        page: 1,
        limit: 10,
      })

      expect(db.query).toHaveBeenCalled()
      expect(result.data).toHaveLength(3)
      expect(result.data.every((log) => log.userId === 'test-user-id')).toBe(true)
    })

    it('should filter by action type', async () => {
      const result = await auditService.getByAction('capture.upload', {
        page: 1,
        limit: 10,
      })

      expect(db.query).toHaveBeenCalled()
      expect(result.data.every((log) => log.action === 'capture.upload')).toBe(true)
    })

    it('should filter by entity type and ID', async () => {
      const result = await auditService.getByEntity('capture', 'test-capture-id', {
        page: 1,
        limit: 10,
      })

      expect(db.query).toHaveBeenCalled()
      expect(result.data.every((log) => log.entityType === 'capture' && log.entityId === 'test-capture-id')).toBe(true)
    })

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01T00:00:00.000Z')
      const endDate = new Date('2024-01-31T23:59:59.999Z')
      const result = await auditService.getByDateRange(startDate, endDate)

      expect(db.query).toHaveBeenCalled()
      expect(result.data.length).toBeGreaterThanOrEqual(0)
    })

    it('should filter by success status', async () => {
      const result = await auditService.getFailed({ page: 1, limit: 10 })

      expect(db.query).toHaveBeenCalled()
      expect(result.data.every((log) => log.success === false)).toBe(true)
    })

    it('should paginate results', async () => {
      const result = await auditService.query({ page: 2, limit: 5 })

      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(5)
      expect(result.pagination.hasNext).toBe(true)
      expect(result.pagination.hasPrev).toBe(true)
    })

    it('should handle empty results', async () => {
      const dbSpy = vi.spyOn(db, 'query', 'mockResolvedValue')
      dbSpy.mockResolvedValue({
        count: '0',
        rows: [],
      })

      const result = await auditService.query({ page: 1, limit: 50 })

      expect(result.data).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
    })
  })

  describe('export methods', () => {
    it('should export to CSV format', async () => {
      const dbSpy = vi.spyOn(db, 'query', 'mockResolvedValue')
      dbSpy.mockResolvedValue({
        count: '2',
        rows: [
          {
            id: 'test-id-1',
            userId: 'test-user',
            action: 'test.action',
            success: true,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
          },
          {
            id: 'test-id-2',
            userId: 'test-user',
            action: 'test.action',
            success: false,
            errorMessage: 'Test error',
            createdAt: new Date('2024-01-01T00:00:01.000Z'),
          },
        ],
      })

      const csv = await auditService.exportToCSV({})

      expect(csv).toContain('createdAt,userId,action,success,errorMessage')
      expect(csv.split('\n')[0]).toBe('createdAt')
    })

    it('should export to JSON format', async () => {
      const dbSpy = vi.spyOn(db, 'query', 'mockResolvedValue')
      dbSpy.mockResolvedValue({
        count: '1',
        rows: [
          {
            id: 'test-id',
            userId: 'test-user',
            action: 'test.action',
            success: true,
          },
        ],
      })

      const json = await auditService.exportToJSON({})

      expect(json).toBe('['{"id":"test-id","userId":"test-user","action":"test.action","success":true}')
    })

    it('should return empty CSV for no results', async () => {
      const dbSpy = vi.spyOn(db, 'query', 'mockResolvedValue')
      dbSpy.mockResolvedValue({
        count: '0',
        rows: [],
      })

      const csv = await auditService.exportToCSV({})

      expect(csv).toBe('')
    })
  })

  describe('statistics', () => {
    it('should generate audit statistics', async () => {
      const dbSpy = vi.spyOn(db, 'query', 'mockResolvedValue')
      dbSpy.mockResolvedValue({
        count: '10',
        rows: Array(10).fill({
          id: `test-id-${i}`,
          userId: 'test-user',
          action: ['upload', 'delete', 'update'][i % 3],
          success: i % 3 === 0,
        }),
      })

      const stats = await auditService.getStatistics()

      expect(stats.total).toBe(10)
      expect(stats.successful).toBe(7)
      expect(stats.failed).toBe(3)
      expect(stats.byAction).toEqual({
        upload: 3,
        delete: 3,
        update: 4,
      })
    })
  })

  describe('deleteOldLogs', () => {
    it('should delete old audit logs', async () => {
      const dbSpy = vi.spyOn(db, 'delete', 'mockResolvedValue')
      dbSpy.mockResolvedValue([
        { id: 'test-id-1' },
        { id: 'test-id-2' },
        { id: 'test-id-3' },
      ])

      const deletedCount = await auditService.deleteOldLogs(
        new Date(Date.now() - 90 * 24 * 60 * 1000)
      )

      expect(db.delete).toHaveBeenCalledTimes(1)
      expect(deletedCount).toBe(3)
      expect(logger.info).toHaveBeenCalledWith(
        'Old audit logs deleted',
        'audit-service',
        expect.any(Object)
      )
    })
  })
})
