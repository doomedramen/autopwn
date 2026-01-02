// Dictionary statistics caching middleware
// Provides Redis-based caching for dictionary statistics to improve performance

import { Context } from "hono";
import { configService } from "@/services/config.service";
import { logger } from "@/lib/logger";

interface CacheEntry {
  stats: {
    basic: {
      wordCount: number;
      uniqueWords: number;
      averageLength: number;
      minLength: number;
      maxLength: number;
    };
    frequency: {
      entropy: number;
      topWords: Array<{ word: string; count: number }>;
      lengthDistribution: Array<{ length: number; count: number }>;
    };
    size: {
      bytes: number;
      kilobytes: number;
      megabytes: number;
      bytesPerWord: number;
    };
  };
  timestamp: number;
}

interface CacheStats {
  total: number;
  entries: Array<{ key: string; age: number }>;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_PREFIX = "dict:stats:";

export function getCacheKey(dictionaryId: string): string {
  return `${CACHE_PREFIX}${dictionaryId}`;
}

export async function getCachedStats(
  dictionaryId: string,
): Promise<CacheEntry | null> {
  const key = getCacheKey(dictionaryId);
  const entry = cache.get(key);

  if (entry) {
    // Check if cache entry has expired
    const age = (Date.now() - entry.timestamp) / 1000;
    if (age > CACHE_TTL_SECONDS) {
      logger.debug(`Cache expired for dictionary ${dictionaryId}`);
      cache.delete(key);
      return null;
    }

    logger.debug(`Cache hit for dictionary ${dictionaryId}`);
    return entry;
  }

  logger.debug(`Cache miss for dictionary ${dictionaryId}`);
  return null;
}

export async function setCachedStats(
  dictionaryId: string,
  stats: CacheEntry["stats"],
): Promise<void> {
  const key = getCacheKey(dictionaryId);
  const entry: CacheEntry = {
    stats,
    timestamp: Date.now(),
  };

  cache.set(key, entry);
  logger.debug(`Cached statistics for dictionary ${dictionaryId}`);

  // Set expiry (Redis handles this, but we'll track it)
  setTimeout(() => {
    cache.delete(key);
    logger.debug(`Cache expired and removed for dictionary ${dictionaryId}`);
  }, CACHE_TTL_SECONDS * 1000);
}

export async function invalidateCache(dictionaryId: string): Promise<void> {
  const key = getCacheKey(dictionaryId);
  cache.delete(key);
  logger.debug(`Invalidated cache for dictionary ${dictionaryId}`);
}

export async function invalidateAllDictionaryCache(): Promise<void> {
  const keys = Array.from(cache.keys());
  const dictKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));

  for (const key of dictKeys) {
    cache.delete(key);
  }

  logger.debug(`Invalidated all dictionary cache entries (${dictKeys.length})`);
}

export function getCacheStats(): CacheStats {
  const keys = Array.from(cache.keys());
  const dictKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));

  return {
    total: dictKeys.length,
    entries: dictKeys.map((k) => ({
      key: k,
      age: (Date.now() - (cache.get(k) as CacheEntry)?.timestamp || 0) / 1000,
    })),
  };
}

export async function cachingMiddleware(c: Context, next: Function) {
  // Skip caching for test environment
  const cacheEnabled = await configService.getBoolean(
    "cache-dictionaries",
    false,
  );

  if (!cacheEnabled) {
    return next();
  }

  const start = Date.now();
  await next();

  const duration = Date.now() - start;
  if (duration > 100) {
    const stats = getCacheStats();
    logger.info(
      `Dictionary cache stats: ${stats.total} entries, ${stats.entries.filter((e) => e.age < CACHE_TTL_SECONDS).length} active`,
    );
  }
}

export { cachingMiddleware };
