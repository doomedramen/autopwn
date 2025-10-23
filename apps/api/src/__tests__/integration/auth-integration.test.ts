import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { authenticate, requireAdmin, getUserId } from '@/middleware/auth'
import { authClient } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Mock database and Better Auth
const mockDb = {
  query: {
    users: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}

vi.mock('@/db', () => mockDb)

describe('Authentication Integration Tests', () => {
  let app: Hono

  beforeAll(() => {
    app = new Hono()
    app.use('/protected', authenticate)
    app.use('/admin', requireAdmin)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should protect routes without authentication', async () => {
    // Mock no session
    vi.mocked(authClient).api.getSession.mockResolvedValue({
      data: null,
      success: false
    })

    const mockContext = {
      req: { header: vi.fn().mockReturnValue('') },
      json: vi.fn()
    }

    await app.request('/protected/test', mockContext as any)

    expect(mockContext.json).toHaveBeenCalledWith({
      success: false,
      error: 'Unauthorized - Please login to access this resource',
      code: 'AUTH_REQUIRED'
    }, 401)
  })

  it('should allow access with valid authentication', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com', role: 'user' }
    vi.mocked(authClient).api.getSession.mockResolvedValue({
      data: { user: mockUser },
      success: true
    })

    const mockContext = {
      req: { header: vi.fn().mockReturnValue('') },
      json: vi.fn()
    }

    await app.request('/protected/test', mockContext as any)

    expect(mockDb.query.users.findFirst).not.toHaveBeenCalled()
    expect(mockContext.json).not.toHaveBeenCalledWith(expect.objectContaining({
      success: false
    }))
  })

  it('should protect admin routes for non-admin users', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com', role: 'user' }
    vi.mocked(authClient).api.getSession.mockResolvedValue({
      data: { user: mockUser },
      success: true
    })

    const mockContext = {
      req: { header: vi.fn().mockReturnValue('') },
      json: vi.fn()
    }

    await app.request('/admin/test', mockContext as any)

    expect(mockContext.json).toHaveBeenCalledWith({
      success: false,
      error: 'Access denied - Admin privileges required',
      code: 'ADMIN_REQUIRED'
    }, 403)
  })

  it('should allow admin access for admin users', async () => {
    const mockAdminUser = { id: 'admin-123', email: 'admin@example.com', role: 'admin' }
    vi.mocked(authClient).api.getSession.mockResolvedValue({
      data: { user: mockAdminUser },
      success: true
    })

    const mockContext = {
      req: { header: vi.fn().mockReturnValue('') },
      json: vi.fn()
    }

    await app.request('/admin/test', mockContext as any)

    expect(mockContext.json).not.toHaveBeenCalledWith(expect.objectContaining({
      success: false
    }))
  })

  it('should handle database errors in authentication', async () => {
    // Mock Better Auth throwing database error
    vi.mocked(authClient).api.getSession.mockRejectedValue(new Error('Database connection failed'))

    const mockContext = {
      req: { header: vi.fn().mockReturnValue('') },
      json: vi.fn()
    }

    await app.request('/protected/test', mockContext as any)

    expect(mockContext.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    }, 401)
  })

  describe('Route-specific authentication', () => {
    it('should apply authentication to different route types', async () => {
      const app = new Hono()

      // Routes that should be protected
      const protectedRoutes = [
        '/api/networks',
        '/api/upload',
        '/api/jobs',
        '/api/queue'
      ]

      // Apply authentication to all routes
      for (const route of protectedRoutes) {
        app.use(route, authenticate)
      }

      // Mock valid session
      vi.mocked(authClient).api.getSession.mockResolvedValue({
        data: { user: { id: 'user-123', role: 'user' } },
        success: true
      })

      const mockContext = {
        req: { header: vi.fn().mockReturnValue('') },
        json: vi.fn()
      }

      // Test that authentication middleware works on different routes
      for (const route of protectedRoutes) {
        await app.request(route, mockContext as any)
        expect(authClient.api.getSession).toHaveBeenCalled()
      }
    })
  })
})