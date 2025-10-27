import { Context, Next } from 'hono'
import Redis from 'ioredis'
import { env } from '../config/env'
import { createRateLimitError } from '../lib/error-handler'
import { logger } from '../lib/logger'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

// In-memory rate limiting store (fallback for testing or when Redis is unavailable)
const rateLimitStore: RateLimitStore = {}

// Redis client for rate limiting
let redisClient: Redis | null = null

// Initialize Redis client for rate limiting
const initializeRedisClient = () => {
  if (redisClient) return redisClient

  try {
    const redisConfig: any = {
      host: env.REDIS_HOST,
      port: parseInt(env.REDIS_PORT),
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        // Exponential backoff: start with 100ms, double each time, max 5 seconds
        const delay = Math.min(100 * Math.pow(2, times - 1), 5000)
        return delay
      },
      connectTimeout: 10000, // 10 seconds
      commandTimeout: 5000,  // 5 seconds
    }

    // Add password conditionally
    if (env.REDIS_PASSWORD) {
      redisConfig.password = env.REDIS_PASSWORD
    }

    redisClient = new Redis(redisConfig)

    redisClient.on('error', (err: Error) => {
      logger.error('Rate limit Redis client error', 'rate_limit', err)
    })

    redisClient.on('connect', () => {
      logger.info('Rate limit Redis client connected', 'rate_limit')
    })

    return redisClient
  } catch (error) {
    logger.error('Failed to initialize rate limit Redis client', 'rate_limit', error)
    return null
  }
}

// Initialize Redis client on module load (only in production/non-test environments)
if (env.NODE_ENV !== 'test') {
  initializeRedisClient()
}

// Export function to clear the rate limit store (for testing)
export const clearRateLimitStore = () => {
  Object.keys(rateLimitStore).forEach(key => delete rateLimitStore[key])
}

// Export function to get Redis client (for testing purposes)
export const getRateLimitRedisClient = () => redisClient

// Export function to close Redis connection (for testing cleanup)
export const closeRateLimitRedis = async () => {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}

/**
 * Rate limiting middleware to protect API endpoints using Redis
 * Automatically falls back to in-memory storage if Redis is unavailable
 * Limits requests based on IP address and configurable windows
 */
export const rateLimit = (options: {
  windowMs?: number
  maxRequests?: number
  keyGenerator?: (c: Context) => string
  useRedis?: boolean
} = {}) => {
  const {
    windowMs = parseInt(env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes default
    maxRequests = parseInt(env.RATE_LIMIT_MAX) || 100,
    keyGenerator = (c: Context) => c.req.header('x-forwarded-for') ||
                       c.req.header('x-real-ip') ||
                       (c.env?.get?.('remote_addr')) || 'unknown',
    useRedis = env.NODE_ENV !== 'test' // Use Redis by default except in tests
  } = options

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c)
    const now = Date.now()
    const windowSeconds = Math.ceil(windowMs / 1000)

    let count: number = 0
    let resetTime: number = now + windowMs
    let usingRedis = false

    // Try to use Redis if available and enabled
    if (useRedis && redisClient) {
      try {
        const redisKey = `rate_limit:${key}`

        // Use Redis MULTI/EXEC for atomic operations
        const pipeline = redisClient.pipeline()

        // Increment the counter
        pipeline.incr(redisKey)

        // Get TTL to check if key exists and has expiration
        pipeline.ttl(redisKey)

        const results = await pipeline.exec()

        if (results && results.length === 2) {
          const [incrResult, ttlResult] = results

          // Check for errors
          if (incrResult?.[0] || ttlResult?.[0]) {
            throw new Error('Redis pipeline error')
          }

          count = (incrResult?.[1] as number) || 0
          const ttl = (ttlResult?.[1] as number) || -1

          // If TTL is -1, the key exists but has no expiration (first request or expired)
          if (ttl === -1 || count === 1) {
            await redisClient.expire(redisKey, windowSeconds)
            resetTime = now + windowMs
          } else {
            // Calculate reset time from TTL
            resetTime = now + (ttl * 1000)
          }

          usingRedis = true
        } else {
          throw new Error('Invalid Redis pipeline response')
        }
      } catch (error) {
        // Redis failed, fall back to in-memory store
        logger.warn('Redis rate limiting failed, falling back to in-memory', 'rate_limit', {
          error: error instanceof Error ? error.message : 'Unknown error',
          key
        })
        usingRedis = false
      }
    }

    // Fall back to in-memory rate limiting if Redis is not available or disabled
    if (!usingRedis) {
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

      count = rateLimitStore[key].count
      resetTime = rateLimitStore[key].resetTime
    }

    // Add rate limit headers
    c.res.headers.set('X-RateLimit-Limit', maxRequests.toString())
    c.res.headers.set('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString())
    c.res.headers.set('X-RateLimit-Backend', usingRedis ? 'redis' : 'memory')

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

      const rateLimitError = createRateLimitError(
        `Too many requests. Maximum ${maxRequests} requests per ${Math.ceil(windowMs / 60000)} minute(s) allowed.`,
        'RATE_LIMIT_EXCEEDED'
      )

      logger.security('rate_limit_exceeded', 'medium', {
        key,
        count,
        maxRequests,
        windowMs,
        retryAfter,
        backend: usingRedis ? 'redis' : 'memory',
        clientIP: (c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || (c.env?.get?.('remote_addr')))
      })

      // Re-throw to be handled by global error handler
      throw rateLimitError
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
               (c.env?.get?.('remote_addr')) || 'unknown'
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
               (c.env?.get?.('remote_addr')) || 'unknown'
    return `upload-${ip}`
  }
})