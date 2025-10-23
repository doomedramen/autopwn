import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Hono } from 'hono'

describe('Core Security Workflow Integration Tests', () => {
  let app: Hono

  beforeAll(async () => {
    console.log('Setting up core security workflow integration tests...')
    app = new Hono()

    // Apply security middleware with different configurations
    app.use('/api/upload/*', (c, next) => {
      c.res.headers.set('X-Content-Type-Options', 'nosniff')
      c.res.headers.set('X-Frame-Options', 'DENY')
      c.res.headers.set('X-XSS-Protection', '1; mode=block')
      c.res.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'")
      return next()
    })

    app.use('/api/secure/*', (c, next) => {
      c.res.headers.set('X-Content-Type-Options', 'nosniff')
      c.res.headers.set('X-Frame-Options', 'DENY')
      c.res.headers.set('X-XSS-Protection', '1; mode=block')
      return next()
    })

    app.get('/api/secure/test', (c) => {
      return c.json({
        message: 'Secure endpoint accessed',
        headers: {
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'x-xss-protection': '1; mode=block'
        }
      })
    })

    app.post('/api/secure/upload', async (c) => {
      try {
        const formData = await c.req.formData()
        const file = formData.get('file') as File
        if (!file) {
          return c.json({ error: 'No file provided' }, 400)
        }

        // Test different file scenarios
        const fileBuffer = Buffer.from(await file.arrayBuffer())

        // Basic security checks
        const allowedExtensions = ['.pcap', '.cap', '.txt']
        const fileExtension = file.name.substring(file.name.lastIndexOf('.'))

        if (!allowedExtensions.includes(fileExtension)) {
          return c.json({
            error: 'File type not allowed',
            code: 'FILE_TYPE_NOT_ALLOWED'
          }, 400)
        }

        // Size check
        if (fileBuffer.length > 50 * 1024 * 1024) { // 50MB limit
          return c.json({
            error: 'File too large',
            code: 'FILE_TOO_LARGE'
          }, 413)
        }

        // Content scanning
        const content = fileBuffer.toString('utf8', 0, Math.min(1024, fileBuffer.length))
        const suspiciousPatterns = [/<script/i, /javascript:/i, /eval\s*\(/i]
        const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(content))

        if (isSuspicious) {
          return c.json({
            error: 'File quarantined due to security scan',
            code: 'FILE_QUARANTINED'
          }, 403)
        }

        return c.json({
          message: 'File processed successfully',
          fileScanned: true,
          fileName: file.name
        })
      } catch (error) {
        return c.json({ error: 'Upload processing error' }, 500)
      }
    })

    app.get('/api/admin/dashboard', (c) => {
      const authHeader = c.req.header('authorization')
      if (!authHeader || !authHeader.startsWith('Bearer admin-token')) {
        return c.json({ error: 'Admin access required' }, 403)
      }
      return c.json({ message: 'Admin dashboard accessed' })
    })
  })

  afterAll(() => {
    console.log('Core security workflow integration tests completed')
  })

  describe('Security Headers Testing', () => {
    it('should add security headers to all responses', async () => {
      const secureResponse = await app.request('/api/secure/test')
      expect(secureResponse.status).toBe(200)
      expect(secureResponse.headers.get('x-content-type-options')).toBe('nosniff')
      expect(secureResponse.headers.get('x-frame-options')).toBe('DENY')
      expect(secureResponse.headers.get('x-xss-protection')).toBe('1; mode=block')
      expect(secureResponse.headers.get('x-content-security-policy')).toContain('default-src \'self\'')
    })

    it('should protect against clickjacking', async () => {
      const secureResponse = await app.request('/api/secure/test')
      expect(secureResponse.status).toBe(200)
      expect(secureResponse.headers.get('x-content-type-options')).toBe('nosniff')
      expect(secureResponse.headers.get('x-frame-options')).toBe('DENY')
      expect(secureResponse.headers.get('x-xss-protection')).toBe('1; mode=block')
      expect(secureResponse.headers.get('x-content-security-policy')).toContain('default-src \'self\'')
    })

    describe('File Upload Security Workflow', () => {
    it('should allow safe file uploads', async () => {
      const safeContent = Buffer.from('safe content', 'utf8')
      const safeFile = new File([safeContent], 'test.pcap', { type: 'application/octet-stream' })

      const formData = new FormData()
      formData.append('file', safeFile)

      const response = await app.request('/api/secure/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
        body: formData
      })

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toMatchObject({
        fileScanned: true,
        fileName: 'test.pcap'
      })
    })

    it('should reject malicious file uploads', async () => {
      const maliciousContent = Buffer.from('<script>alert("xss")</script>', 'utf8')
      const maliciousFile = new File([maliciousContent], 'malicious.js', { type: 'text/javascript' })

      const formData = new FormData()
      formData.append('file', maliciousFile)

      const response = await app.request('/api/secure/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
        body: formData
      })

      expect(response.status).toBe(403)
      const json = await response.json()
      expect(json.code).toBe('FILE_QUARANTINED')
    })

    it('should block oversized file uploads', async () => {
      // Create a smaller test file for memory efficiency in tests
      const oversizedContent = Buffer.alloc(100 * 1024 * 1024, 'A') // 100MB for testing

      const formData = new FormData()
      formData.append('file', new File([oversizedContent], 'large.pcap'))

      const response = await app.request('/api/secure/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
        body: formData
      })

      expect(response.status).toBe(413) // Request Entity Too Large
      const json = await response.json()
      expect(json.code).toBe('FILE_TOO_LARGE')
    })
  })

  describe('Admin Access Control', () => {
    it('should allow admin access with correct token', async () => {
      const response = await app.request('/api/admin/dashboard', {
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      })

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.message).toBe('Admin dashboard accessed')
    })

    it('should reject admin access with invalid token', async () => {
      const response = await app.request('/api/admin/dashboard', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      })

      expect(response.status).toBe(403)
      const json = await response.json()
      expect(json.error).toBe('Admin access required')
    })

    it('should reject admin access without token', async () => {
      const response = await app.request('/api/admin/dashboard')

      expect(response.status).toBe(403)
      const json = await response.json()
      expect(json.error).toBe('Admin access required')
    })
  })
})