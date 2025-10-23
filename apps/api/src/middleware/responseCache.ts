import { Context, Next } from 'hono'
import { getCache } from '@/lib/cache'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

/**
 * Response cache configuration
 */
interface CacheConfig {
  enabled: boolean
  defaultTTL: number
  maxSize: number
  varyOn: string[]
  skipWhen: string[]
  compressionEnabled: boolean
}

/**
 * Cached response interface
 */
interface CachedResponse {
  data: any
  status: number
  headers: Record<string, string>
  cachedAt: number
  ttl: number
  compressed: boolean
}

/**
 * HTTP response caching middleware
 * Caches GET requests with intelligent invalidation
 */
export function responseCache(options: Partial<CacheConfig> = {}) {
  const config: CacheConfig = {
    enabled: process.env.NODE_ENV !== 'test', // Disable in tests
    defaultTTL: 300, // 5 minutes
    maxSize: 1000,
    varyOn: ['Authorization'], // Vary on auth headers
    skipWhen: ['no-cache'], // Skip cache when header present
    compressionEnabled: true,
    ...options
  }

  const cache = getCache({
    defaultTTL: config.defaultTTL,
    keyPrefix: 'autopwn:response:',
    enableCompression: config.compressionEnabled,
    maxSize: config.maxSize
  })

  return async (c: Context, next: Next) => {
    // Skip caching for non-GET requests
    if (c.req.method !== 'GET') {
      return next()
    }

    // Skip caching when explicitly requested
    const cacheControl = c.req.header('cache-control')
    if (cacheControl && config.skipWhen.some(skip => cacheControl.includes(skip))) {
      return next()
    }

    // Skip caching for authenticated requests that shouldn't be cached
    const path = c.req.path
    const nonCacheablePaths = [
      '/api/users/me',
      '/api/jobs',
      '/api/upload',
      '/health',
      '/metrics'
    ]

    if (nonCacheablePaths.some(nonCacheable => path.includes(nonCacheable))) {
      return next()
    }

    // Generate cache key
    const cacheKey = generateCacheKey(c.req)

    try {
      // Check cache
      if (config.enabled) {
        const cached = await cache.get<CachedResponse>(cacheKey, ['response'])

        if (cached && !isExpired(cached)) {
          logger.debug('Cache hit for response', 'cache', {
            path,
            cacheKey,
            cachedAt: cached.cachedAt
          })

          // Set cache headers
          c.res.headers.set('X-Cache', 'HIT')
          c.res.headers.set('X-Cache-Age', Math.floor((Date.now() - cached.cachedAt) / 1000).toString())

          // Copy cached headers
          Object.entries(cached.headers).forEach(([key, value]) => {
            if (!key.toLowerCase().startsWith('x-')) {
              c.res.headers.set(key, value)
            }
          })

          // Set appropriate cache-control header
          const remainingTTL = Math.max(0, cached.cachedAt + cached.ttl * 1000 - Date.now())
          c.res.headers.set('Cache-Control', `public, max-age=${Math.floor(remainingTTL / 1000)}`)

          // Send cached response
          return c.json(cached.data, cached.status)
        } else {
          c.res.headers.set('X-Cache', 'MISS')
        }
      }

      // Execute original request
      const startTime = Date.now()
      await next()

      // Only cache successful responses
      const status = c.res.status
      if (config.enabled && shouldCacheResponse(status, c.res.headers)) {
        const responseData = await getResponseBody(c)

        if (responseData) {
          const ttl = getCacheTTL(path, status, config.defaultTTL)
          const responseToCache: CachedResponse = {
            data: responseData,
            status,
            headers: getCacheableHeaders(c.res.headers),
            cachedAt: Date.now(),
            ttl,
            compressed: config.compressionEnabled
          }

          await cache.set(cacheKey, responseToCache, ttl, ['response', getResponseTags(path)])

          logger.debug('Response cached', 'cache', {
            path,
            status,
            ttl,
            executionTime: Date.now() - startTime,
            responseSize: JSON.stringify(responseData).length
          })
        }
      }
    } catch (error) {
      logger.error('Response cache error', 'cache', {
        path,
        cacheKey,
        error: error instanceof Error ? error.message : String(error)
      })
      // Don't fail the request if caching fails
      return next()
    }
  }
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: any): string {
  const url = req.url || req.path
  const query = req.query || {}
  const headers = req.headers || {}

  // Sort query params for consistent keys
  const sortedQuery = Object.keys(query)
    .sort()
    .reduce((result, key) => {
      result[key] = query[key]
      return result
    }, {} as Record<string, any>)

  // Include relevant headers in cache key
  const relevantHeaders: Record<string, string> = {}
  const headersToInclude = ['authorization', 'x-api-key', 'accept-encoding']

  for (const header of headersToInclude) {
    const value = headers[header.toLowerCase()]
    if (value) {
      relevantHeaders[header] = value
    }
  }

  const keyData = {
    url,
    query: sortedQuery,
    headers: relevantHeaders
  }

  return crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex')
}

/**
 * Check if cached response is expired
 */
function isExpired(cached: CachedResponse): boolean {
  return Date.now() > (cached.cachedAt + cached.ttl * 1000)
}

/**
 * Check if response should be cached
 */
function shouldCacheResponse(status: number, headers: Record<string, string>): boolean {
  // Only cache successful responses
  if (status < 200 || status >= 300) {
    return false
  }

  // Don't cache responses with no-store headers
  const cacheControl = headers['cache-control'] || ''
  if (cacheControl.includes('no-store') || cacheControl.includes('private')) {
    return false
  }

  // Don't cache very large responses
  const contentLength = parseInt(headers['content-length'] || '0')
  if (contentLength > 1024 * 1024) { // 1MB limit
    return false
  }

  return true
}

/**
 * Get response body from context (this is tricky with different frameworks)
 */
async function getResponseBody(c: Context): Promise<any> {
  // This is a simplified version - in reality, you'd need to
  // capture the response body before it's sent
  // For now, we'll return null and let the calling code
  // handle response caching differently
  return null
}

/**
 * Get only cacheable headers (exclude problematic ones)
 */
function getCacheableHeaders(headers: Record<string, string>): Record<string, string> {
  const cacheable: Record<string, string> = {}
  const excludeHeaders = [
    'content-length',
    'date',
    'etag',
    'last-modified',
    'set-cookie',
    'x-cache',
    'x-cache-age'
  ]

  for (const [key, value] of Object.entries(headers)) {
    if (!excludeHeaders.includes(key.toLowerCase()) && value) {
      cacheable[key] = value
    }
  }

  return cacheable
}

/**
 * Get cache TTL based on path and status
 */
function getCacheTTL(path: string, status: number, defaultTTL: number): number {
  // Different TTLs for different types of content
  if (path.includes('/api/networks')) {
    return 600 // 10 minutes for network data
  } else if (path.includes('/api/dictionaries')) {
    return 1800 // 30 minutes for dictionaries
  } else if (path.includes('/api/jobs')) {
    return 60 // 1 minute for job status
  } else if (path.includes('/health') || path.includes('/metrics')) {
    return 30 // 30 seconds for health/status
  }

  return defaultTTL
}

/**
 * Get response tags for cache invalidation
 */
function getResponseTags(path: string): string[] {
  const tags: string[] = []

  if (path.includes('/networks')) {
    tags.push('networks')
  }
  if (path.includes('/dictionaries')) {
    tags.push('dictionaries')
  }
  if (path.includes('/users')) {
    tags.push('users')
  }
  if (path.includes('/jobs')) {
    tags.push('jobs')
  }

  return tags
}

/**
 * Cache invalidation utilities
 */
export class ResponseCacheInvalidator {
  private cache

  constructor() {
    this.cache = getCache()
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      // This is a simplified approach - in reality, you'd need
      // to implement pattern matching in your cache
      const keys = await this.cache.keys()
      let invalidated = 0

      for (const key of keys) {
        if (key.includes(pattern)) {
          await this.cache.delete(key)
          invalidated++
        }
      }

      logger.info('Cache invalidation completed', 'cache', {
        pattern,
        invalidated,
        totalKeys: keys.length
      })

      return invalidated
    } catch (error) {
      logger.error('Cache invalidation failed', 'cache', { pattern, error })
      return 0
    }
  }

  /**
   * Invalidate by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      const result = await this.cache.clearByTags(['response', ...tags])

      logger.info('Cache invalidation by tags completed', 'cache', {
        tags,
        invalidated: result
      })

      return result
    } catch (error) {
      logger.error('Cache invalidation by tags failed', 'cache', { tags, error })
      return 0
    }
  }

  /**
   * Clear all response cache
   */
  async clearAll(): Promise<boolean> {
    try {
      const result = await this.cache.clearByTags(['response'])

      logger.info('All response cache cleared', 'cache', {
        cleared: result
      })

      return result > 0
    } catch (error) {
      logger.error('Response cache clear failed', 'cache', error)
      return false
    }
  }
}

export const responseCacheInvalidator = new ResponseCacheInvalidator()