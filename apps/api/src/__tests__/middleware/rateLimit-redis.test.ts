import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimit, getRateLimitRedisClient, closeRateLimitRedis } from '../../middleware/rateLimit'
import type { Context } from 'hono'

describe('Redis-backed Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    // Clean up Redis client after tests
    await closeRateLimitRedis()
  })

  const createMockContext = (overrides: Partial<Context> = {}): any => ({
    req: {
      header: vi.fn((name: string) => {
        if (name === 'x-forwarded-for') return '192.168.1.1'
        if (name === 'x-real-ip') return '192.168.1.1'
        return undefined
      }),
      url: 'http://localhost/test',
      path: '/test',
      method: 'GET',
      ...overrides?.req
    },
    res: {
      headers: new Map(),
      set: vi.fn((key: string, value: string) => {
        // Mock header setting
      }),
      status: vi.fn(),
      json: vi.fn(),
      text: vi.fn(),
      ...overrides?.res
    },
    header: vi.fn(),
    json: vi.fn(),
    text: vi.fn(),
    env: new Map(),
    ...overrides
  })

  describe('Redis Integration', () => {
    it('should use in-memory fallback when Redis is disabled in tests', async () => {
      const rateLimitMiddleware = rateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 5,
        useRedis: false // Explicitly disable Redis for testing
      })

      const mockContext = createMockContext()
      const mockNext = vi.fn()

      // Make 5 requests (should succeed)
      for (let i = 0; i < 5; i++) {
        await rateLimitMiddleware(mockContext, mockNext)
      }

      expect(mockNext).toHaveBeenCalledTimes(5)

      // 6th request should fail
      await expect(rateLimitMiddleware(mockContext, mockNext)).rejects.toThrow()
      expect(mockNext).toHaveBeenCalledTimes(5) // Still 5, not 6
    })

    it('should add rate limit headers', async () => {
      const rateLimitMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 10,
        useRedis: false
      })

      const headers = new Map<string, string>()
      const mockContext = createMockContext({
        res: {
          headers: {
            set: vi.fn((key: string, value: string) => {
              headers.set(key, value)
            }),
            get: vi.fn(),
            has: vi.fn(),
            delete: vi.fn()
          }
        }
      })
      const mockNext = vi.fn()

      await rateLimitMiddleware(mockContext, mockNext)

      // Check that rate limit headers were set
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Limit', '10')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Backend', 'memory')
    })

    it('should use different keys for different IPs', async () => {
      const rateLimitMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 2,
        useRedis: false
      })

      const mockNext = vi.fn()

      // IP 1: 192.168.1.1
      const mockContext1 = createMockContext({
        req: {
          header: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1'
            return undefined
          })
        }
      })

      // IP 2: 192.168.1.2
      const mockContext2 = createMockContext({
        req: {
          header: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.2'
            return undefined
          })
        }
      })

      // Each IP should get its own rate limit window
      await rateLimitMiddleware(mockContext1, mockNext)
      await rateLimitMiddleware(mockContext1, mockNext)
      await rateLimitMiddleware(mockContext2, mockNext)
      await rateLimitMiddleware(mockContext2, mockNext)

      expect(mockNext).toHaveBeenCalledTimes(4)

      // 3rd request from IP1 should fail
      await expect(rateLimitMiddleware(mockContext1, mockNext)).rejects.toThrow()
      expect(mockNext).toHaveBeenCalledTimes(4)

      // 3rd request from IP2 should fail
      await expect(rateLimitMiddleware(mockContext2, mockNext)).rejects.toThrow()
      expect(mockNext).toHaveBeenCalledTimes(4)
    })

    it('should use custom key generator', async () => {
      const customKeyGenerator = vi.fn((c: Context) => {
        return `custom-${c.req.header('user-id')}`
      })

      const rateLimitMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 3,
        keyGenerator: customKeyGenerator,
        useRedis: false
      })

      const mockContext = createMockContext({
        req: {
          header: vi.fn((name: string) => {
            if (name === 'user-id') return 'user-123'
            return undefined
          })
        }
      })
      const mockNext = vi.fn()

      await rateLimitMiddleware(mockContext, mockNext)

      expect(customKeyGenerator).toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('Rate Limit Errors', () => {
    it('should throw rate limit error when limit exceeded', async () => {
      const rateLimitMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 1,
        useRedis: false
      })

      const mockContext = createMockContext()
      const mockNext = vi.fn()

      // First request succeeds
      await rateLimitMiddleware(mockContext, mockNext)
      expect(mockNext).toHaveBeenCalledTimes(1)

      // Second request should fail with rate limit error
      await expect(
        rateLimitMiddleware(mockContext, mockNext)
      ).rejects.toThrow(/Too many requests/)

      expect(mockNext).toHaveBeenCalledTimes(1) // Should not call next after rate limit
    })

    it('should include retry-after header when rate limited', async () => {
      const rateLimitMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 1,
        useRedis: false
      })

      const headers = new Map<string, string>()
      const mockContext = createMockContext({
        res: {
          headers: {
            set: vi.fn((key: string, value: string) => {
              headers.set(key, value)
            }),
            get: vi.fn(),
            has: vi.fn(),
            delete: vi.fn()
          }
        }
      })
      const mockNext = vi.fn()

      // First request
      await rateLimitMiddleware(mockContext, mockNext)

      // Second request should set Retry-After header
      await expect(
        rateLimitMiddleware(mockContext, mockNext)
      ).rejects.toThrow()

      expect(mockContext.res.headers.set).toHaveBeenCalledWith(
        'Retry-After',
        expect.any(String)
      )
    })
  })

  describe('Window Expiration', () => {
    it('should reset counter after window expires', async () => {
      vi.useFakeTimers()

      const windowMs = 1000 // 1 second window
      const rateLimitMiddleware = rateLimit({
        windowMs,
        maxRequests: 2,
        useRedis: false
      })

      const mockContext = createMockContext()
      const mockNext = vi.fn()

      // First two requests succeed
      await rateLimitMiddleware(mockContext, mockNext)
      await rateLimitMiddleware(mockContext, mockNext)
      expect(mockNext).toHaveBeenCalledTimes(2)

      // Third request should fail
      await expect(
        rateLimitMiddleware(mockContext, mockNext)
      ).rejects.toThrow()
      expect(mockNext).toHaveBeenCalledTimes(2)

      // Advance time past window
      vi.advanceTimersByTime(windowMs + 100)

      // Should be able to make requests again
      await rateLimitMiddleware(mockContext, mockNext)
      expect(mockNext).toHaveBeenCalledTimes(3)

      vi.useRealTimers()
    })
  })
})
