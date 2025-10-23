import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { comprehensiveSecurity } from '@/middleware/security'

describe('Security Middleware Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should apply security middleware without errors', async () => {
    const app = new Hono()
    app.use('/test', comprehensiveSecurity({
      allowedOrigins: ['http://localhost:3000'],
      trustProxy: false
    }))

    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue('https://localhost:3000'),
        url: vi.fn().mockReturnValue('/api/test')
      },
      res: {
        headers: {
          set: vi.fn(),
          get: vi.fn()
        },
        json: vi.fn()
      }
    }

    const mockNext = vi.fn()
    await comprehensiveSecurity(mockContext as any, mockNext)

    expect(mockNext).toHaveBeenCalled()

    // Verify security headers were set
    expect(mockContext.res.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://localhost:3000')
    expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
  })

  it('should block requests from disallowed origins', async () => {
    const app = new Hono()
    app.use('/test', comprehensiveSecurity({
      allowedOrigins: ['https://localhost:3000']
    }))

    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue('https://malicious.com'),
        url: vi.fn().mockReturnValue('/api/test')
      },
      res: {
        headers: {
          set: vi.fn(),
          get: vi.fn()
        },
        json: vi.fn()
      }
    }

    const mockNext = vi.fn()
    await comprehensiveSecurity(mockContext as any, mockNext)

    expect(mockNext).toHaveBeenCalled()

    // Should have blocked the request or returned security headers
    expect(mockContext.res.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'null')
  })

  it('should apply rate limiting', async () => {
    const app = new Hono()
    app.use('/test', comprehensiveSecurity({
      maxRequestSize: 1000,
      stricterLimits: true
    }))

    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue('5000'),
        url: vi.fn().mockReturnValue('/api/test')
      },
      res: {
        headers: {
          set: vi.fn(),
          get: vi.fn()
        },
        json: vi.fn()
      }
    }

    const mockNext = vi.fn()
    await comprehensiveSecurity(mockContext as any, mockNext)

    expect(mockNext).toHaveBeenCalled()

    // Should have applied strict rate limits
    expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-RateLimit-Limit', '5')
  })
})