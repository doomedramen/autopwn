import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { authenticate, requireAdmin, getUserId, getAuthContext, optionalAuth } from '../../middleware/auth'
import { authClient } from '../../lib/auth'

// Mock Better Auth client
vi.mock('../../lib/auth', () => ({
  authClient: {
    api: {
      getSession: vi.fn()
    }
  }
}))

describe('Authentication Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authenticate middleware', () => {
    it('should allow access with valid session', async () => {
      // Mock successful session
      const mockUser = { id: 'user-123', email: 'test@example.com', role: 'user' }
      vi.mocked(authClient).api.getSession.mockResolvedValue({
        data: { user: mockUser },
        success: true
      })

      const app = new Hono()
      app.use('*', authenticate)

      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue(''),
          json: vi.fn().mockReturnValue({ data: 'test' })
        },
        set: vi.fn(),
        json: vi.fn()
      }

      // Call middleware
      const next = vi.fn()
      await authenticate(mockContext as any, next)

      expect(next).toHaveBeenCalled()
      expect(mockContext.set).toHaveBeenCalledWith('userId', 'user-123')
      expect(mockContext.set).toHaveBeenCalledWith('userRole', 'user')
      expect(mockContext.set).toHaveBeenCalledWith('userEmail', 'test@example.com')
    })

    it('should reject access with invalid session', async () => {
      // Mock failed session
      vi.mocked(authClient).api.getSession.mockResolvedValue({
        data: null,
        success: false
      })

      const app = new Hono()
      app.use('*', authenticate)

      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue(''),
          json: vi.fn().mockReturnValue({ data: 'test' })
        },
        set: vi.fn(),
        json: vi.fn()
      }

      const next = vi.fn()

      // Call middleware
      await authenticate(mockContext as any, next)

      expect(next).not.toHaveBeenCalled()
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized - Please login to access this resource',
        code: 'AUTH_REQUIRED'
      }, 401)
    })

    it('should handle Better Auth errors gracefully', async () => {
      // Mock Better Auth throwing error
      vi.mocked(authClient).api.getSession.mockRejectedValue(new Error('Auth service unavailable'))

      const app = new Hono()
      app.use('*', authenticate)

      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue(''),
          json: vi.fn().mockReturnValue({ data: 'test' })
        },
        set: vi.fn(),
        json: vi.fn()
      }

      const next = vi.fn()

      // Call middleware
      await authenticate(mockContext as any, next)

      expect(next).not.toHaveBeenCalled()
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      }, 401)
    })
  })

  describe('requireAdmin middleware', () => {
    it('should allow access for admin users', async () => {
      // Mock admin user session
      const mockAdminUser = { id: 'admin-123', email: 'admin@example.com', role: 'admin' }
      vi.mocked(authClient).api.getSession.mockResolvedValue({
        data: { user: mockAdminUser },
        success: true
      })

      const app = new Hono()
      app.use('*', authenticate)
      app.use('/admin', requireAdmin)

      const mockContext = {
        req: { header: vi.fn() },
        set: vi.fn((key, value) => {
          if (key === 'userRole') {
            mockContext.userRole = value
          }
        }),
        json: vi.fn(),
        get: vi.fn((key) => key === 'userRole' ? mockContext.userRole : undefined)
      }

      // First set up the user role from authenticate middleware
      const next1 = vi.fn()
      await authenticate(mockContext as any, next1)
      mockContext.set('userRole', 'admin')

      // Then call requireAdmin middleware
      const next2 = vi.fn()
      await requireAdmin(mockContext as any, next2)

      expect(next1).toHaveBeenCalled()
      expect(next2).toHaveBeenCalled()
      expect(mockContext.set).toHaveBeenCalledWith('userRole', 'admin')
    })

    it('should reject access for non-admin users', async () => {
      // Mock regular user session
      const mockRegularUser = { id: 'user-123', email: 'user@example.com', role: 'user' }
      vi.mocked(authClient).api.getSession.mockResolvedValue({
        data: { user: mockRegularUser },
        success: true
      })

      const app = new Hono()
      app.use('*', authenticate)
      app.use('/admin', requireAdmin)

      const mockContext = {
        req: { header: vi.fn() },
        set: vi.fn((key, value) => {
          if (key === 'userRole') {
            mockContext.userRole = value
          }
        }),
        json: vi.fn(),
        get: vi.fn((key) => key === 'userRole' ? mockContext.userRole : undefined)
      }

      // First set up the user role from authenticate middleware
      const next1 = vi.fn()
      await authenticate(mockContext as any, next1)
      mockContext.set('userRole', 'user')

      // Then call requireAdmin middleware
      const next2 = vi.fn()
      await requireAdmin(mockContext as any, next2)

      expect(next1).toHaveBeenCalled()
      expect(next2).not.toHaveBeenCalled()
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied - Admin privileges required',
        code: 'ADMIN_REQUIRED'
      }, 403)
    })

    it('should reject access without user role', async () => {
      // Mock session without user role
      const mockUserNoRole = { id: 'user-123', email: 'user@example.com' }
      vi.mocked(authClient).api.getSession.mockResolvedValue({
        data: { user: mockUserNoRole },
        success: true
      })

      const app = new Hono()
      app.use('*', authenticate)
      app.use('/admin', requireAdmin)

      const mockContext = {
        req: { header: vi.fn() },
        set: vi.fn(),
        json: vi.fn(),
        get: vi.fn(() => undefined)
      }

      // First set up authenticate middleware
      const next1 = vi.fn()
      await authenticate(mockContext as any, next1)

      // Then call requireAdmin middleware
      const next2 = vi.fn()
      await requireAdmin(mockContext as any, next2)

      expect(next1).toHaveBeenCalled()
      expect(next2).not.toHaveBeenCalled()
      expect(mockContext.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied - Admin privileges required',
        code: 'ADMIN_REQUIRED'
      }, 403)
    })
  })

  describe('optionalAuth middleware', () => {
    it('should set auth context when user is logged in', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com', role: 'user' }
      vi.mocked(authClient).api.getSession.mockResolvedValue({
        data: { user: mockUser },
        success: true
      })

      const app = new Hono()
      app.use('*', optionalAuth)

      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue(''),
          json: vi.fn().mockReturnValue({ data: 'test' })
        },
        set: vi.fn(),
        get: vi.fn()
      }

      const next = vi.fn()
      await optionalAuth(mockContext as any, next)

      expect(next).toHaveBeenCalled()
      expect(mockContext.set).toHaveBeenCalledWith('userId', 'user-123')
      expect(mockContext.set).toHaveBeenCalledWith('userRole', 'user')
      expect(mockContext.set).toHaveBeenCalledWith('userEmail', 'test@example.com')
    })

    it('should not fail when user is not logged in', async () => {
      // Mock failed session
      vi.mocked(authClient).api.getSession.mockResolvedValue({
        data: null,
        success: false
      })

      const app = new Hono()
      app.use('*', optionalAuth)

      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue(''),
          json: vi.fn().mockReturnValue({ data: 'test' })
        },
        set: vi.fn(),
        get: vi.fn()
      }

      const next = vi.fn()
      await optionalAuth(mockContext as any, next)

      expect(next).toHaveBeenCalled()
      expect(mockContext.set).not.toHaveBeenCalled()
    })
  })

  describe('Helper functions', () => {
    it('should get user ID from context', () => {
      const mockContext = {
        get: vi.fn((key) => key === 'userId' ? 'test-user-id' : undefined)
      }

      expect(getUserId(mockContext as any)).toBe('test-user-id')
      expect(mockContext.get).toHaveBeenCalledWith('userId')
    })

    it('should return empty string when user ID not set', () => {
      const mockContext = {
        get: vi.fn(() => undefined)
      }

      expect(getUserId(mockContext as any)).toBe('')
      expect(mockContext.get).toHaveBeenCalledWith('userId')
    })

    it('should check admin status correctly', () => {
      const mockContext = {
        get: vi.fn((key) => {
          if (key === 'userRole') return 'admin'
          if (key === 'not-admin') return 'user'
          return undefined
        })
      }

      // Test admin check
      mockContext.get.mockClear()
      mockContext.get.mockImplementation((key) => {
        if (key === 'userRole') return 'admin'
        return undefined
      })

      expect(requireAdmin(mockContext as any, () => Promise.resolve())).resolves.toBeUndefined()

      // Test non-admin check
      mockContext.get.mockClear()
      mockContext.get.mockImplementation((key) => {
        if (key === 'userRole') return 'user'
        return undefined
      })

      expect(requireAdmin(mockContext as any, () => Promise.resolve())).rejects.toThrow()
    })

    it('should get auth context', () => {
      const mockUser = { id: 'user-123', email: 'test@example.com', role: 'user' }
      const mockContext = {
        get: vi.fn((key) => key === 'auth' ? { user: mockUser } : undefined)
      }

      expect(getAuthContext(mockContext as any)).toEqual({ user: mockUser })
      expect(mockContext.get).toHaveBeenCalledWith('auth')
    })
  })
})