import { Context, Next } from 'hono'
import { authClient } from '../lib/auth'
import { getCookie } from 'hono/cookie'

export interface AuthContext {
  userId: string
  userRole: 'user' | 'admin'
  userEmail: string
}

/**
 * Authentication middleware to protect API routes
 * Validates session from Better Auth and extracts user information
 */
export const authenticate = async (c: Context, next: Next) => {
  try {
    // Get session from Better Auth
    const session = await authClient.api.getSession({
      headers: c.req.header()
    })

    if (!session.data?.user) {
      return c.json({
        success: false,
        error: 'Unauthorized - Please login to access this resource',
        code: 'AUTH_REQUIRED'
      }, 401)
    }

    // Extract user information
    const user = session.data.user
    const authContext: AuthContext = {
      userId: user.id,
      userRole: (user.role as 'user' | 'admin') || 'user',
      userEmail: user.email
    }

    // Store user context in Hono's context
    c.set('auth', authContext)
    c.set('userId', authContext.userId)
    c.set('userRole', authContext.userRole)
    c.set('userEmail', authContext.userEmail)

    await next()
  } catch (error) {
    console.error('Authentication error:', error)
    return c.json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    }, 401)
  }
}

/**
 * Admin-only middleware - must be used after authenticate
 */
export const requireAdmin = async (c: Context, next: Next) => {
  const userRole = c.get('userRole') as string

  if (userRole !== 'admin') {
    return c.json({
      success: false,
      error: 'Access denied - Admin privileges required',
      code: 'ADMIN_REQUIRED'
    }, 403)
  }

  await next()
}

/**
 * Optional authentication middleware - doesn't block unauthenticated users
 * but sets auth context if user is logged in
 */
export const optionalAuth = async (c: Context, next: Next) => {
  try {
    const session = await authClient.api.getSession({
      headers: c.req.header()
    })

    if (session.data?.user) {
      const user = session.data.user
      const authContext: AuthContext = {
        userId: user.id,
        userRole: (user.role as 'user' | 'admin') || 'user',
        userEmail: user.email
      }

      c.set('auth', authContext)
      c.set('userId', authContext.userId)
      c.set('userRole', authContext.userRole)
      c.set('userEmail', authContext.userEmail)
    }
  } catch (error) {
    // Optional auth - don't fail the request if auth fails
    console.debug('Optional authentication failed:', error)
  }

  await next()
}

/**
 * Helper function to get user ID from context
 */
export const getUserId = (c: Context): string => {
  return c.get('userId') || ''
}

/**
 * Helper function to check if user is admin
 */
export const isAdmin = (c: Context): boolean => {
  return c.get('userRole') === 'admin'
}

/**
 * Helper function to get auth context
 */
export const getAuthContext = (c: Context): AuthContext | undefined => {
  return c.get('auth')
}