import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { AuthTestUtils, createTestApp, createTestClient } from '../test/utils/test-utils'
import { authenticate, requireAdmin } from '../middleware/auth'
import { fileSecurityMiddleware } from '../middleware/fileSecurity'
import { comprehensiveSecurity, securityHeaders, cors } from '../middleware/security'
import { rateLimit } from '../middleware/rateLimit'

describe('End-to-End Security Workflow Integration Tests', () => {
  let app: Hono
  let testUtils: AuthTestUtils
  let testUser: any

  beforeAll(async () => {
    console.log('Setting up end-to-end security workflow integration tests...')
    app = new Hono()
    testUtils = new AuthTestUtils()

    // Apply individual security middlewares for better test control
    app.use('*', securityHeaders())
    app.use('*', cors({
      allowedOrigins: ['http://localhost:3000', 'https://localhost:3000']
    }))
    app.use('*', rateLimit({
      windowMs: 60000, // 1 minute
      maxRequests: 30, // Higher for integration tests
      keyGenerator: (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    }))

    // Mock authentication middleware for testing
    app.use('/api/*', async (c, next) => {
      const authHeader = c.req.header('authorization')
      if (authHeader?.startsWith('Bearer test-token-')) {
        // Extract user info from test token
        const [, tokenData] = authHeader.split('Bearer test-token-')
        const [userId, role] = tokenData.split('-')

        c.set('userId', userId)
        c.set('userRole', role)
        c.set('userEmail', 'test@example.com')
      }
      await next()
    })

    // Apply admin middleware to admin routes
    app.use('/api/admin/*', async (c, next) => {
      const userRole = c.get('userRole')
      if (userRole !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
      }
      await next()
    })

    // Add workflow routes
    app.use('/api/upload/*', fileSecurityMiddleware({
      maxFileSize: 50 * 1024 * 1024, // 50MB for testing
      allowedExtensions: ['.pcap', '.cap', '.txt'],
      blockedExtensions: ['.exe', '.bat', '.js'],
      scanFiles: true
    }))

    app.post('/api/upload/pcap', async (c) => {
      const fileInfo = c.get('fileInfo')
      return c.json({
        success: true,
        file: {
          name: fileInfo?.name,
          uploadType: 'pcap',
          scanned: fileInfo?.scanResult?.safe || false
        }
      })
    })

    app.get('/api/user/profile', (c) => {
      const userId = c.get('userId')
      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }
      return c.json({ userId, authenticated: true })
    })

    app.get('/api/admin/dashboard', (c) => {
      return c.json({ message: 'Admin dashboard accessed' })
    })
  })

  afterAll(() => {
    console.log('End-to-end security workflow integration tests completed')
  })

  describe('Complete Security Workflow', () => {
    beforeEach(async () => {
      vi.clearAllMocks()
      // Create a mock user for testing
      testUser = {
        id: 'test-user-' + Date.now(),
        email: 'test@example.com',
        role: 'user',
        token: 'test-token-test-user-user-' + Date.now()
      }
    })

    it('should allow complete authenticated workflow', async () => {
      // Step 1: Access user profile
      const profileResponse = await app.request('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${testUser.token}`
        }
      })
      expect(profileResponse.status).toBe(200)
      const profileJson = await profileResponse.json()
      expect(profileJson).toMatchObject({
        authenticated: true
      })

      // Step 2: Upload PCAP file
      const pcapContent = Buffer.from('d4c3b2a1' + '02'.repeat(100), 'hex') // Smaller PCAP header + content
      const formData = new FormData()
      formData.append('file', new Blob([pcapContent], { type: 'application/octet-stream' }), 'integration-test.pcap')

      const uploadResponse = await app.request('/api/upload/pcap', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.token}`,
          'Content-Type': 'multipart/form-data'
        },
        body: formData
      })

      expect(uploadResponse.status).toBe(200)
      const uploadJson = await uploadResponse.json()
      expect(uploadJson).toMatchObject({
        success: true,
        file: expect.objectContaining({
          name: 'integration-test.pcap',
          uploadType: 'pcap'
        })
      })

      // Step 3: Access admin dashboard (should fail)
      const adminResponse = await app.request('/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${testUser.token}`
        }
      })
      expect(adminResponse.status).toBe(403)
      const adminJson = await adminResponse.json()
      expect(adminJson.error).toBe('Admin access required')
    })

    it('should handle security threats in upload workflow', async () => {
      // Attempt to upload malicious file
      const maliciousContent = Buffer.from('<script>alert("xss")</script>', 'utf8')
      const maliciousFormData = new FormData()
      maliciousFormData.append('file', new Blob([maliciousContent], { type: 'text/javascript' }), 'malicious.js')

      const maliciousResponse = await app.request('/api/upload/pcap', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.token}`,
          'Content-Type': 'multipart/form-data'
        },
        body: maliciousFormData
      })

      expect(maliciousResponse.status).toBe(403)
      const maliciousJson = await maliciousResponse.json()
      expect(maliciousJson.code).toBe('FILE_QUARANTINED')
    })

    it('should handle CORS correctly in security workflow', async () => {
      // Test preflight OPTIONS request
      const optionsResponse = await app.request('/api/user/profile', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization'
        }
      })

      expect(optionsResponse.status).toBe(204)
      expect(optionsResponse.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
      expect(optionsResponse.headers.get('access-control-allow-methods')?.split(', ')).toContain('GET')
      expect(optionsResponse.headers.get('access-control-allow-headers')?.split(', ')).toContain('Authorization')
    })

    it('should prevent XSS through security headers', async () => {
      const response = await app.request('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${testUser.token}`
        }
      })
      expect(response.status).toBe(200)

      // Verify security headers are present
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('x-frame-options')).toBe('DENY')
      expect(response.headers.get('x-xss-protection')).toBe('1; mode=block')
      expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains')
      expect(response.headers.get('content-security-policy')).toContain('default-src')
    })
  })
})