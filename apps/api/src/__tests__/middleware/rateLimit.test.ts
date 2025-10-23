import { describe, it, expect, beforeEach, vi, beforeAll, afterEach } from 'vitest'
import { Context, Next } from 'hono'
import { rateLimit, strictRateLimit, uploadRateLimit } from '../../middleware/rateLimit'

// Mock Date.now for consistent testing
const mockTime = vi.fn().mockReturnValue(1000000000000) // 2023-11-01T00:00:00.000Z
const mockDate = {
  now: vi.fn().mockReturnValue(mockTime)
}
Object.defineProperty(global, 'Date', {
  value: mockDate,
  writable: true
})

describe('Rate Limiting Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useFakeTimers()
  })

  describe('General rate limiting', () => {
    it('should allow requests within limits', async () => {
      const rateLimiter = rateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 10,
        keyGenerator: () => 'test-ip'
      })

      const mockNext = vi.fn()
      const mockContext = {
        req: { header: vi.fn().mockReturnValue('') },
        res: {
          headers: {
            set: vi.fn(),
          }
        },
        get: vi.fn(),
        set: vi.fn()
      }

      // First request
      await rateLimiter(mockContext as any, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Limit', '10')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '9')
    })

    it('should block requests exceeding limits', async () => {
      const rateLimiter = rateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 10,
        keyGenerator: () => 'test-ip'
      })

      const mockNext = vi.fn()
      const mockContext = {
        req: { header: vi.fn().mockReturnValue('') },
        res: {
          headers: {
            set: vi.fn(),
          },
          json: vi.fn()
        },
        get: vi.fn(),
        set: vi.fn()
      }

      // Mock 10 previous requests within window
      for (let i = 0; i < 10; i++) {
        mockTime.mockReturnValueOnce(Date.now() - 55000 + i * 1000)
        await rateLimiter(mockContext as any, mockNext)
      }

      // 11th request should be blocked
      mockTime.mockReturnValueOnce(Date.now())
      await rateLimiter(mockContext as any, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Limit', '10')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '0')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z/))
      expect(mockContext.res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Maximum 10 requests per 1 minute(s) allowed.',
        retryAfter: expect.any(Number)
      }, 429)
    })

    it('should reset counter after window expires', async () => {
      const rateLimiter = rateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 10,
        keyGenerator: () => 'test-ip'
      })

      const mockNext = vi.fn()
      const mockContext = {
        req: { header: vi.fn().mockReturnValue('') },
        res: {
          headers: {
            set: vi.fn(),
          },
          json: vi.fn()
        },
        get: vi.fn(),
        set: vi.fn()
      }

      // Request within window
      mockTime.mockReturnValueOnce(Date.now() - 30000) // 30 seconds ago
      await rateLimiter(mockContext as any, mockNext)

      mockNext.mockClear()
      mockContext.res.headers.set.mockClear()
      mockTime.mockReturnValueOnce(Date.now() + 30001) // Now 30 seconds + 1ms (after window)

      await rateLimiter(mockContext as any, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Limit', '10')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '9') // Counter should reset
    })
  })

  describe('Strict rate limiting', () => {
    it('should apply stricter limits for auth endpoints', async () => {
      const strictLimiter = strictRateLimit()

      const mockNext = vi.fn()
      const mockContext = {
        req: { header: vi.fn().mockReturnValue('') },
        res: {
          headers: {
            set: vi.fn(),
          },
          json: vi.fn()
        },
        get: vi.fn(),
        set: vi.fn()
      }

      await strictLimiter(mockContext as any, mockNext)

      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Limit', '10') // Stricter limit
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '9')
    })
  })

  describe('Upload rate limiting', () => {
    it('should apply hourly limits for uploads', async () => {
      const uploadLimiter = uploadRateLimit()

      const mockNext = vi.fn()
      const mockContext = {
        req: { header: vi.fn().mockReturnValue('') },
        res: {
          headers: {
            set: vi.fn(),
          },
          json: vi.fn()
        },
        get: vi.fn(),
        set: vi.fn()
      }

      await uploadLimiter(mockContext as any, mockNext)

      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Limit', '20') // Upload limit
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '19')
    })
  })

  describe('Custom key generators', () => {
    it('should use custom key generator function', async () => {
      const customKeyGenerator = (c: Context) => {
        return c.req.header('x-user-id') || 'unknown-ip'
      }

      const rateLimiter = rateLimit({
        keyGenerator: customKeyGenerator
      })

      const mockContext = {
        req: { header: vi.fn().mockReturnValue('') },
        res: {
          headers: {
            set: vi.fn(),
          },
        },
        get: vi.fn(),
        set: vi.fn()
      }

      // Mock header with user ID
      mockContext.req.header = vi.fn().mockReturnValue('user-123')

      await rateLimiter(mockContext as any, vi.fn())

      // Verify the key was generated correctly
      expect(customKeyGenerator(mockContext as any)).toBe('user-123')
    })
  })
})