import Redis from 'ioredis'
import { env } from '@/config/env'
import { logger } from './logger'
import crypto from 'crypto'

// Cache configuration
interface CacheConfig {
  defaultTTL: number
  maxRetries: number
  keyPrefix: string
  enableCompression: boolean
  maxSize: number
}

// Cache entry with metadata
interface CacheEntry {
  data: any
  expires: number
  version: string
  compressed: boolean
  tags: string[]
}

// Cache statistics
interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
  size: number
  lastReset: Date
}

/**
 * Advanced Caching System for AutoPWN
 * Provides intelligent caching with compression, tagging, and statistics
 */
export class AutoPwnCache {
  private redis: Redis
  private config: CacheConfig
  private stats: CacheStats
  private readonly STATS_KEY = 'autopwn:cache:stats'

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 300, // 5 minutes
      maxRetries: 3,
      keyPrefix: 'autopwn:cache:',
      enableCompression: true,
      maxSize: 1000, // Max 1000 cached items
      ...config
    }

    this.redis = new Redis({
      host: env.REDIS_HOST,
      port: parseInt(env.REDIS_PORT),
      password: env.REDIS_PASSWORD,
      maxRetriesPerRequest: this.config.maxRetries,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      commandTimeout: 5000,
      connectTimeout: 10000,
    })

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      size: 0,
      lastReset: new Date()
    }

    // Load existing stats
    this.loadStats()

    // Handle Redis errors
    this.redis.on('error', (error) => {
      logger.error('Redis cache error', 'cache', error)
      this.stats.errors++
    })
  }

  /**
   * Generate cache key with namespace and versioning
   */
  private generateKey(key: string, tags: string[] = []): string {
    const keyHash = crypto.createHash('md5').update(key).digest('hex')
    const tagHash = tags.length > 0
      ? ':' + crypto.createHash('md5').update(tags.join(':')).digest('hex').substring(0, 8)
      : ''
    return `${this.config.keyPrefix}${keyHash}${tagHash}`
  }

  /**
   * Serialize and optionally compress data
   */
  private serialize(data: any): string {
    const serialized = JSON.stringify(data)
    if (this.config.enableCompression && serialized.length > 1024) {
      // For large items, we could add compression here
      // For now, just return serialized data
      return serialized
    }
    return serialized
  }

  /**
   * Deserialize and decompress data
   */
  private deserialize(data: string): any {
    try {
      return JSON.parse(data)
    } catch (error) {
      logger.error('Cache deserialization error', 'cache', { error, data })
      return null
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expires
  }

  /**
   * Update cache statistics
   */
  private async updateStats(): Promise<void> {
    try {
      await this.redis.hset(this.STATS_KEY, {
        hits: this.stats.hits.toString(),
        misses: this.stats.misses.toString(),
        sets: this.stats.sets.toString(),
        deletes: this.stats.deletes.toString(),
        errors: this.stats.errors.toString(),
        size: this.stats.size.toString(),
        lastReset: this.stats.lastReset.toISOString()
      })
    } catch (error) {
      logger.error('Failed to update cache stats', 'cache', error)
    }
  }

  /**
   * Load cache statistics from Redis
   */
  private async loadStats(): Promise<void> {
    try {
      const stats = await this.redis.hgetall(this.STATS_KEY)
      if (stats && Object.keys(stats).length > 0) {
        this.stats = {
          hits: parseInt(stats.hits || '0'),
          misses: parseInt(stats.misses || '0'),
          sets: parseInt(stats.sets || '0'),
          deletes: parseInt(stats.deletes || '0'),
          errors: parseInt(stats.errors || '0'),
          size: parseInt(stats.size || '0'),
          lastReset: new Date(stats.lastReset || Date.now())
        }
      }
    } catch (error) {
      logger.error('Failed to load cache stats', 'cache', error)
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string, tags: string[] = []): Promise<T | null> {
    const cacheKey = this.generateKey(key, tags)

    try {
      const result = await this.redis.get(cacheKey)
      if (!result) {
        this.stats.misses++
        await this.updateStats()
        return null
      }

      const entry: CacheEntry = JSON.parse(result)

      // Check if expired
      if (this.isExpired(entry)) {
        await this.delete(key, tags)
        this.stats.misses++
        await this.updateStats()
        return null
      }

      this.stats.hits++
      await this.updateStats()
      return this.deserialize(entry.data) as T
    } catch (error) {
      this.stats.errors++
      await this.updateStats()
      logger.error('Cache get error', 'cache', { key, tags, error })
      return null
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set<T = any>(
    key: string,
    value: T,
    ttl: number = this.config.defaultTTL,
    tags: string[] = []
  ): Promise<boolean> {
    const cacheKey = this.generateKey(key, tags)
    const expires = Date.now() + (ttl * 1000)

    const entry: CacheEntry = {
      data: this.serialize(value),
      expires,
      version: '1.0',
      compressed: this.config.enableCompression && JSON.stringify(value).length > 1024,
      tags
    }

    try {
      // Check cache size limit
      if (this.stats.size >= this.config.maxSize) {
        logger.warn('Cache size limit reached, skipping set', 'cache', {
          currentSize: this.stats.size,
          maxSize: this.config.maxSize,
          key
        })
        return false
      }

      await this.redis.setex(cacheKey, ttl, JSON.stringify(entry))
      this.stats.sets++
      this.stats.size++
      await this.updateStats()
      return true
    } catch (error) {
      this.stats.errors++
      await this.updateStats()
      logger.error('Cache set error', 'cache', { key, tags, error })
      return false
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, tags: string[] = []): Promise<boolean> {
    const cacheKey = this.generateKey(key, tags)

    try {
      const result = await this.redis.del(cacheKey)
      if (result > 0) {
        this.stats.deletes++
        this.stats.size = Math.max(0, this.stats.size - 1)
        await this.updateStats()
        return true
      }
      return false
    } catch (error) {
      this.stats.errors++
      await this.updateStats()
      logger.error('Cache delete error', 'cache', { key, tags, error })
      return false
    }
  }

  /**
   * Clear cache by tags
   */
  async clearByTags(tags: string[]): Promise<number> {
    try {
      // Get all cache keys
      const keys = await this.redis.keys(this.config.keyPrefix + '*')
      let deletedCount = 0

      for (const fullKey of keys) {
        const cachedData = await this.redis.get(fullKey)
        if (cachedData) {
          const entry: CacheEntry = JSON.parse(cachedData)
          // Check if any tag matches
          const hasMatchingTag = tags.some(tag => entry.tags.includes(tag))
          if (hasMatchingTag) {
            await this.redis.del(fullKey)
            deletedCount++
            this.stats.deletes++
            this.stats.size = Math.max(0, this.stats.size - 1)
          }
        }
      }

      await this.updateStats()
      return deletedCount
    } catch (error) {
      this.stats.errors++
      await this.updateStats()
      logger.error('Cache clear by tags error', 'cache', { tags, error })
      return 0
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      const keys = await this.redis.keys(this.config.keyPrefix + '*')
      if (keys.length > 0) {
        await this.redis.del(...keys)
        this.stats.deletes += keys.length
        this.stats.size = 0
        await this.updateStats()
      }
      return true
    } catch (error) {
      this.stats.errors++
      await this.updateStats()
      logger.error('Cache clear error', 'cache', error)
      return false
    }
  }

  /**
   * Get multiple values in pipeline
   */
  async mget<T = any>(keys: string[]): Promise<Record<string, T>> {
    const cacheKeys = keys.map(key => this.generateKey(key))

    try {
      const results = await this.redis.mget(...cacheKeys)
      const output: Record<string, T> = {}

      for (let i = 0; i < keys.length; i++) {
        const result = results[i]
        if (result) {
          const entry: CacheEntry = JSON.parse(result)
          if (!this.isExpired(entry)) {
            output[keys[i]] = this.deserialize(entry.data) as T
          } else {
            // Clean up expired entry
            await this.delete(keys[i])
          }
        }
      }

      // Update stats
      this.stats.hits += Object.keys(output).length
      this.stats.misses += (keys.length - Object.keys(output).length)
      await this.updateStats()

      return output
    } catch (error) {
      this.stats.errors += keys.length
      await this.updateStats()
      logger.error('Cache mget error', 'cache', { keys, error })
      return {}
    }
  }

  /**
   * Set multiple values in pipeline
   */
  async mset<T = any>(
    items: Array<{ key: string; value: T; ttl?: number }>
  ): Promise<boolean[]> {
    const pipeline = this.redis.pipeline()

    try {
      for (const item of items) {
        const cacheKey = this.generateKey(item.key)
        const ttl = item.ttl || this.config.defaultTTL
        const expires = Date.now() + (ttl * 1000)

        const entry: CacheEntry = {
          data: this.serialize(item.value),
          expires,
          version: '1.0',
          compressed: false,
          tags: []
        }

        pipeline.setex(cacheKey, ttl, JSON.stringify(entry))
      }

      const results = await pipeline.exec()

      // Update stats
      const successCount = results.filter(([err]) => !err).length
      this.stats.sets += successCount
      this.stats.size += successCount
      await this.updateStats()

      return results.map(([err]) => !err)
    } catch (error) {
      this.stats.errors += items.length
      await this.updateStats()
      logger.error('Cache mset error', 'cache', { itemCount: items.length, error })
      return items.map(() => false)
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    await this.loadStats() // Refresh stats
    return { ...this.stats }
  }

  /**
   * Reset cache statistics
   */
  async resetStats(): Promise<void> {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      size: 0,
      lastReset: new Date()
    }
    await this.updateStats()
  }

  /**
   * Check if Redis is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch (error) {
      return false
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    try {
      await this.updateStats() // Final stats update
      await this.redis.quit()
      logger.info('Cache disconnected gracefully', 'cache')
    } catch (error) {
      logger.error('Cache disconnect error', 'cache', error)
    }
  }
}

// Singleton cache instance
let cacheInstance: AutoPwnCache | null = null

export function getCache(config?: Partial<CacheConfig>): AutoPwnCache {
  if (!cacheInstance) {
    cacheInstance = new AutoPwnCache(config)
  }
  return cacheInstance
}

// Export cache factory for different configurations
export function createCache(config: Partial<CacheConfig>): AutoPwnCache {
  return new AutoPwnCache(config)
}