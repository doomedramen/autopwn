import { Context, Next } from 'hono'
import { env } from '../config/env'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

// In-memory rate limiting store (for production, use Redis)
const rateLimitStore: RateLimitStore = {}

/**
 * Rate limiting middleware to protect API endpoints
 * Limits requests based on IP address and configurable windows
 */
export const rateLimit = (options: {
  windowMs?: number
  maxRequests?: number
  keyGenerator?: (c: Context) => string
} = {}) => {
  const {
    windowMs = parseInt(env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes default
    maxRequests = parseInt(env.RATE_LIMIT_MAX) || 100,
    keyGenerator = (c: Context) => c.req.header('x-forwarded-for') ||
                       c.req.header('x-real-ip') ||
                       c.env.get('remote_addr') || 'unknown'
  } = options

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c)
    const now = Date.now()

    // Initialize or reset counter
    if (!rateLimitStore[key]) {
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + windowMs
      }
    } else if (now > rateLimitStore[key].resetTime) {
      // Window expired, reset counter
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + windowMs
      }
    } else {
      // Increment counter within window
      rateLimitStore[key].count++
    }

    const { count, resetTime } = rateLimitStore[key]

    // Add rate limit headers
    c.res.headers.set('X-RateLimit-Limit', maxRequests.toString())
    c.res.headers.set('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString())
    try {
    c.res.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString())
  } catch (error) {
    // Fallback in case Date is mocked
    c.res.headers.set('X-RateLimit-Reset', resetTime.toString())
  }

    // Check if rate limit exceeded
    if (count > maxRequests) {
      const retryAfter = Math.ceil((resetTime - now) / 1000)
      c.res.headers.set('Retry-After', retryAfter.toString())

      return c.json({
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Maximum ${maxRequests} requests per ${Math.ceil(windowMs / 60000)} minute(s) allowed.`,
        retryAfter
      }, 429)
    }

    await next()
  }
}

/**
 * Stricter rate limiting for sensitive endpoints like authentication
 */
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // Stricter limit for auth endpoints
  keyGenerator: (c: Context) => {
    const ip = c.req.header('x-forwarded-for') ||
               c.req.header('x-real-ip') ||
               c.env.get('remote_addr') || 'unknown'
    return `auth-${ip}`
  }
})

/**
 * Rate limiting for file uploads
 */
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20, // 20 uploads per hour
  keyGenerator: (c: Context) => {
    const ip = c.req.header('x-forwarded-for') ||
               c.req.header('x-real-ip') ||
               c.env.get('remote_addr') || 'unknown'
    return `upload-${ip}`
  }
})