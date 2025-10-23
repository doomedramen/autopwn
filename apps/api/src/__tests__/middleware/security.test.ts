import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { Context } from 'hono'
import {
  cors,
  securityHeaders,
  requestSizeLimit,
  inputValidation,
  ipAccessControl,
  comprehensiveSecurity
} from '../../middleware/security'

describe('Security Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createMockContext = (overrides: Partial<Context> = {}): any => ({
    req: {
      header: vi.fn(),
      url: 'http://localhost/test',
      path: '/test',
      method: 'GET',
      ...overrides?.req
    },
    res: {
      headers: {
        set: vi.fn(),
        get: vi.fn(),
        has: vi.fn(),
        delete: vi.fn()
      },
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

  describe('CORS middleware', () => {
    it('should allow requests from allowed origins', async () => {
      const corsMiddleware = cors({
        allowedOrigins: ['http://localhost:3000', 'https://localhost:3001']
      })

      const mockContext = createMockContext({
        req: {
          header: vi.fn()
            .mockReturnValueOnce('https://localhost:3001') // origin
            .mockReturnValueOnce('GET') // access-control-request-method
            .mockReturnValueOnce('authorization') // access-control-request-headers
        }
      })

      const mockNext = vi.fn()
      await corsMiddleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://localhost:3001')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', expect.stringContaining('GET'))
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true')
    })

    it('should block requests from disallowed origins', async () => {
      const corsMiddleware = cors({
        allowedOrigins: ['https://localhost:3001']
      })

      const mockContext = createMockContext({
        req: {
          header: vi.fn()
            .mockReturnValueOnce('https://malicious.com') // origin
            .mockReturnValueOnce('GET') // access-control-request-method
        }
      })

      const mockNext = vi.fn()
      await corsMiddleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://malicious.com')
    })
  })

  describe('Security Headers middleware', () => {
    it('should add comprehensive security headers', async () => {
      const securityMiddleware = securityHeaders()

      const mockContext = createMockContext({
        req: { path: '/test' }
      })

      const mockNext = vi.fn()
      await securityMiddleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-Frame-Options', 'DENY')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Strict-Transport-Security', expect.stringContaining('max-age='))
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Content-Security-Policy', expect.stringContaining('default-src \'self\''))
    })
  })

  describe('Request Size Limit middleware', () => {
    it('should allow requests within size limit', async () => {
      const sizeMiddleware = requestSizeLimit({ maxRequestSize: 1000 })

      const mockContext = createMockContext({
        req: {
          header: vi.fn().mockReturnValue('999')
        }
      })

      const mockNext = vi.fn()
      await sizeMiddleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.json).not.toHaveBeenCalled()
    })

    it('should block requests exceeding size limit', async () => {
      const sizeMiddleware = requestSizeLimit({ maxRequestSize: 1000 })

      const mockContext = createMockContext({
        req: {
          header: vi.fn().mockReturnValue('1001')
        }
      })

      const mockNext = vi.fn()
      await sizeMiddleware(mockContext, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: 'Request entity too large',
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request size 1001 exceeds maximum allowed size of 1000 bytes',
        maxSize: 1000
      }, 413)
    })
  })

  describe('Input Validation middleware', () => {
    it('should allow legitimate requests', async () => {
      const validationMiddleware = inputValidation()

      const mockContext = createMockContext({
        req: {
          header: vi.fn()
            .mockReturnValueOnce('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36') // user-agent
            .mockReturnValueOnce('application/json'), // content-type
          url: 'http://localhost/api/test'
        }
      })

      const mockNext = vi.fn()
      await validationMiddleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.header).not.toHaveBeenCalledWith('X-Security-Flag', 'suspicious-input')
    })

    it('should detect suspicious input patterns', async () => {
      const validationMiddleware = inputValidation()

      const mockContext = createMockContext({
        req: {
          header: vi.fn()
            .mockReturnValueOnce('test bot') // user-agent with suspicious pattern
            .mockReturnValueOnce('application/json'), // content-type
          url: 'http://localhost/api/test'
        }
      })

      const mockNext = vi.fn()
      await validationMiddleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.header).toHaveBeenCalledWith('X-Security-Flag', 'suspicious-input')
    })
  })

  describe('IP Access Control middleware', () => {
    it('should block requests from blacklisted IPs', async () => {
      const ipMiddleware = ipAccessControl({
        blockedIPs: ['192.168.1.100', '10.0.0.1'],
        stricterLimits: true
      })

      const mockContext = createMockContext({
        req: {
          header: vi.fn()
            .mockReturnValueOnce('192.168.1.100') // x-forwarded-for
            .mockReturnValueOnce('Mozilla/5.0') // user-agent
        }
      })

      const mockNext = vi.fn()
      await ipMiddleware(mockContext, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied',
        code: 'IP_BLOCKED',
        message: 'Your IP address has been blocked'
      }, 403)
    })

    it('should apply stricter limits for suspicious requests', async () => {
      const ipMiddleware = ipAccessControl({
        suspiciousPatterns: [/bot|crawler/i],
        stricterLimits: true
      })

      const mockContext = createMockContext({
        req: {
          header: vi.fn()
            .mockReturnValueOnce('192.168.1.200') // x-forwarded-for (not blocked)
            .mockReturnValueOnce('Python/3.9 urllib/3.4') // user-agent (suspicious)
        }
      })

      const mockNext = vi.fn()
      await ipMiddleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.header).toHaveBeenCalledWith('X-Security-Flag', 'suspicious-user-agent')
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', '5')
    })
  })

  describe('Comprehensive Security middleware', () => {
    it('should apply all security features', async () => {
      const securityMiddleware = comprehensiveSecurity({
        allowedOrigins: ['https://localhost:3000'],
        maxRequestSize: 5000,
        stricterLimits: true
      })

      const mockContext = createMockContext({
        req: {
          header: vi.fn()
            .mockReturnValueOnce('3000') // content-length
            .mockReturnValueOnce('https://localhost:3000') // origin
            .mockReturnValueOnce('Mozilla/5.0') // user-agent
            .mockReturnValueOnce('192.168.1.50'), // x-forwarded-for
          path: '/api/test',
          url: 'http://localhost/api/test'
        }
      })

      const mockNext = vi.fn()
      await securityMiddleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()

      // Should have called security headers
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-Frame-Options', 'DENY')
    })
  })
})