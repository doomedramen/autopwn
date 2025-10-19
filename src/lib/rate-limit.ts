/**
 * Simple in-memory rate limiter
 *
 * NOTE: This implementation stores rate limit data in memory.
 * For production deployments with multiple instances, consider using:
 * - @upstash/ratelimit with Redis/Upstash
 * - next-rate-limit
 * - A distributed rate limiting solution
 *
 * This implementation is suitable for single-instance deployments and development.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Check if a request should be rate limited
   * @param identifier - Unique identifier (e.g., IP address, user ID)
   * @param limit - Maximum number of requests
   * @param windowMs - Time window in milliseconds
   * @returns Object with success status and remaining requests
   */
  check(
    identifier: string,
    limit: number,
    windowMs: number
  ): {
    success: boolean;
    remaining: number;
    reset: number;
  } {
    const now = Date.now();
    const entry = this.store.get(identifier);

    // If no entry or entry expired, create new
    if (!entry || entry.resetAt < now) {
      this.store.set(identifier, {
        count: 1,
        resetAt: now + windowMs,
      });

      return {
        success: true,
        remaining: limit - 1,
        reset: now + windowMs,
      };
    }

    // Entry exists and not expired
    if (entry.count >= limit) {
      // Rate limit exceeded
      return {
        success: false,
        remaining: 0,
        reset: entry.resetAt,
      };
    }

    // Increment count
    entry.count++;
    this.store.set(identifier, entry);

    return {
      success: true,
      remaining: limit - entry.count,
      reset: entry.resetAt,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all rate limit data for an identifier
   */
  reset(identifier: string) {
    this.store.delete(identifier);
  }

  /**
   * Clear all rate limit data
   */
  resetAll() {
    this.store.clear();
  }

  /**
   * Get current stats for monitoring
   */
  getStats() {
    return {
      totalEntries: this.store.size,
    };
  }

  /**
   * Cleanup interval on destroy
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Create singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Common rate limit configurations
 */
export const RateLimitPresets = {
  // Authentication endpoints - strict limits
  auth: {
    limit: 5,
    windowMs: 60 * 1000, // 5 requests per minute
  },
  // API endpoints - moderate limits
  api: {
    limit: 60,
    windowMs: 60 * 1000, // 60 requests per minute
  },
  // File uploads - lenient limits (large files take time)
  upload: {
    limit: 10,
    windowMs: 60 * 60 * 1000, // 10 uploads per hour
  },
  // Job creation - moderate limits
  jobs: {
    limit: 20,
    windowMs: 60 * 60 * 1000, // 20 jobs per hour
  },
};

/**
 * Helper to get client identifier from request
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from headers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const real = request.headers.get('x-real-ip');
  if (real) {
    return real;
  }

  // Fallback to a generic identifier
  // In production, you might want to use session ID or user ID
  return 'unknown';
}
