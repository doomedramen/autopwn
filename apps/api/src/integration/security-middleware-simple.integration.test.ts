import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { fileSecurityMiddleware } from '../middleware/fileSecurity'
import { comprehensiveSecurity, securityHeaders, cors } from '../middleware/security'
import { rateLimit } from '../middleware/rateLimit'

describe('Simple Security Middleware Integration Tests', () => {
  let app: Hono

  beforeAll(async () => {
    console.log('Setting up simple security integration tests...')
    app = new Hono()

    // Apply individual security middlewares for better test isolation
    app.use('*', securityHeaders())
    app.use('*', cors({
      allowedOrigins: ['http://localhost:3000']
    }))
    app.use('*', rateLimit({
      windowMs: 60000,
      maxRequests: 20
    }))

    // Apply file security to upload routes
    app.use('/api/upload/*', fileSecurityMiddleware({
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedExtensions: ['.pcap', '.cap', '.txt'],
      blockedExtensions: ['.exe', '.bat', '.js'],
      scanFiles: true
    }))

    // Add simple test endpoints
    app.get('/api/test/auth-required', (c) => {
      const authHeader = c.req.header('authorization')
      if (!authHeader) {
        return c.json({ error: 'Authentication required' }, 401)
      }
      return c.json({ message: 'Authenticated' })
    })

    app.post('/api/test/upload', async (c) => {
      try {
        const formData = await c.req.formData()
        const file = formData.get('file') as File

        if (!file) {
          return c.json({ error: 'No file provided' }, 400)
        }

        const fileInfo = c.get('fileInfo')
        return c.json({
          message: 'File processed',
          file: {
            name: file.name,
            size: file.size,
            scanned: fileInfo?.scanResult?.safe || false
          }
        })
      } catch (error) {
        return c.json({ error: 'Upload failed' }, 500)
      }
    })

    app.get('/api/test/rate-limit', (c) => {
      return c.json({ message: 'Rate limit endpoint' })
    })
  })

  afterAll(() => {
    console.log('Simple security integration tests completed')
  })

  describe('Security Headers', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should add security headers to all responses', async () => {
      const response = await app.request('/api/test/auth-required')
      expect(response.status).toBe(200)
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('x-frame-options')).toBe('DENY')
      expect(response.headers.get('x-xss-protection')).toBe('1; mode=block')
    })
  })

  describe('File Upload Security', () => {
    beforeEach(async () => {
      vi.clearAllMocks()
    })

    it('should allow safe file uploads', async () => {
      const safeContent = Buffer.from('safe file content', 'utf8')
      const formData = new FormData()
      formData.append('file', new Blob([safeContent]), 'test.pcap')

      const response = await app.request('/api/test/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        body: formData
      })

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.file).toMatchObject({
        name: 'test.pcap',
        size: safeContent.length
      })
    })

    it('should reject malicious file uploads', async () => {
      const maliciousContent = Buffer.from('<script>alert("xss")</script>', 'utf8')
      const formData = new FormData()
      formData.append('file', new Blob([maliciousContent]), 'malicious.js')

      const response = await app.request('/api/test/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        body: formData
      })

      // Should get 403 response
      expect(response.status).toBe(403)
      const json = await response.json()
      expect(json.code).toBe('FILE_QUARANTINED')
    })

    it('should block oversized files', async () => {
      // Create a smaller test file for memory efficiency in tests
      const largeContent = Buffer.alloc(100 * 1024 * 1024, 'A') // 100MB for testing
      const formData = new FormData()
      formData.append('file', new Blob([largeContent]), 'large.pcap')

      const response = await app.request('/api/test/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        body: formData
      })

      expect(response.status).toBe(413)
      const json = await response.json()
      expect(json.code).toBe('FILE_TOO_LARGE')
    })
  })

  describe('Rate Limiting', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should allow requests within limits', async () => {
      const responses = await Promise.all(Array.from({ length: 5 }, () =>
        app.request('/api/test/rate-limit')
      ))

      expect(responses.every(r => r.status === 200)).toBe(true)
    })

    it('should block requests exceeding limits', async () => {
      const responses = await Promise.all(Array.from({ length: 15 }, () =>
        app.request('/api/test/rate-limit')
      ))

      const successCount = responses.filter(r => r.status === 200).length
      const rateLimitedCount = responses.filter(r => r.status === 429).length

      expect(successCount).toBeGreaterThan(0) // Some should succeed
      expect(rateLimitedCount).toBeGreaterThan(0) // Some should be rate limited
      expect(rateLimitedCount).toBeLessThan(15) // But not all should be rate limited
    })
  })
})