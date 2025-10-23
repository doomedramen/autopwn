import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
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
    vi.useFakeTimers()
  })

  describe('CORS middleware', () => {
    it('should allow requests from allowed origins', async () => {
      const corsMiddleware = cors({
        origin: ['http://localhost:3000', 'https://localhost:3001'],
        credentials: true
      })

      const app = new Hono()
      app.use('/test', corsMiddleware)

      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue('https://localhost:3001'),
          method: vi.fn().mockReturnValue('GET')
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
      await corsMiddleware(mockContext as any, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://localhost:3001')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', expect.stringContaining('GET'))
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', expect.stringContaining('Authorization'))
    })

    it('should block requests from disallowed origins', async () => {
      const corsMiddleware = cors({
        origin: ['https://localhost:3001'],
        credentials: true
      })

      const app = new Hono()
      app.use('/test', corsMiddleware)

      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue('https://malicious.com'),
          method: vi.fn().mockReturnValue('GET')
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
      await corsMiddleware(mockContext as any, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'null')
    })
  })

  describe('Security Headers middleware', () => {
    it('should add comprehensive security headers', async () => {
      const securityMiddleware = securityHeaders()
      const app = new Hono()
      app.use('/test', securityMiddleware)

      const mockContext = {
        req: {},
        res: {
          headers: {
            set: vi.fn(),
            get: vi.fn()
          }
        }
      }

      const mockNext = vi.fn()
      await securityMiddleware(mockContext as any, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-Frame-Options', 'DENY')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Content-Security-Policy', expect.stringContaining('default-src \'self\''))
    })
  })

  describe('Request Size Limit middleware', () => {
    it('should allow requests within size limit', async () => {
      const sizeMiddleware = requestSizeLimit({ maxRequestSize: 1000 })

      const app = new Hono()
      app.use('/test', sizeMiddleware)

      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue('999')
        },
        json: vi.fn()
      }

      const mockNext = vi.fn()
      await sizeMiddleware(mockContext as any, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.json).not.toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Request entity too large'
      }))
    })

    it('should block requests exceeding size limit', async () => {
      const sizeMiddleware = requestSizeLimit({ maxRequestSize: 1000 })

      const app = new Hono()
      app.use('/test', sizeMiddleware)

      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue('1001')
        },
        json: vi.fn()
      }

      const mockNext = vi.fn()
      await sizeMiddleware(mockContext as any, mockNext)

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
    it('should detect suspicious user agents', async () => {
      const validationMiddleware = inputValidation()
      const app = new Hono()
      app.use('/test', validationMiddleware)

      const mockContext = {
        req: {
          header: vi.fn()
            .mockReturnValueOnce('curl/7.68.0')
            .mockReturnValueOnce('script'),
          url: vi.fn().mockReturnValue('/api/test')
        },
        json: vi.fn()
      }

      const mockNext = vi.fn()
      await validationMiddleware(mockContext as any, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.header).toHaveBeenCalledWith('X-Security-Flag', 'suspicious-user-agent')
    })

    it('should detect SQL injection patterns', async () => {
      const validationMiddleware = inputValidation()
      const app = new Hono()
      app.use('/test', validationMiddleware)

      const mockContext = {
        req: {
          url: vi.fn().mockReturnValue('/api/users?email=test@example.com%27%20OR%201%3D1%27=1'),
          header: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn()
      }

      const mockNext = vi.fn()
      await validationMiddleware(mockContext as any, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid request detected',
        code: 'SUSPICIOUS_INPUT'
      }, 400)
    })
  })

  describe('IP Access Control middleware', () => {
    it('should block requests from blacklisted IPs', async () => {
      const ipMiddleware = ipAccessControl({
        blockedIPs: ['192.168.1.100', '10.0.0.1'],
        stricterLimits: true
      })

      const app = new Hono()
      app.use('/test', ipMiddleware)

      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue('192.168.1.100')
        },
        json: vi.fn()
      }

      const mockNext = vi.fn()
      await ipMiddleware(mockContext as any, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied',
        code: 'IP_BLOCKED'
      }, 403)
    })

    it('should apply stricter limits for suspicious requests', async () => {
      const ipMiddleware = ipAccessControl({
        suspiciousPatterns: [/bot|crawler/i],
        stricterLimits: true
      })

      const app = new Hono()
      app.use('/test', ipMiddleware)

      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue('Python/3.9 urllib/3.4'),
          url: vi.fn().mockReturnValue('/api/test')
        },
        json: vi.fn()
      }

      const mockNext = vi.fn()
      await ipMiddleware(mockContext as any, mockNext)

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

      const app = new Hono()
      app.use('/test', securityMiddleware)

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
      await securityMiddleware(mockContext as any, mockNext)

      expect(mockNext).toHaveBeenCalled()

      // Should have called security headers, size limit, input validation, IP control, and CORS
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://localhost:3000')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
      expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block')
    })
  })
})