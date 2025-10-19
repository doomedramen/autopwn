import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  rateLimiter,
  RateLimitPresets,
  getClientIdentifier,
} from '@/lib/rate-limit';

// Create a test instance using the singleton but reset it for each test
describe('RateLimiter', () => {
  beforeEach(() => {
    rateLimiter.resetAll();
  });

  afterEach(() => {
    rateLimiter.resetAll();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const result1 = rateLimiter.check('user1', 5, 60000);
      expect(result1.success).toBe(true);
      expect(result1.remaining).toBe(4);

      const result2 = rateLimiter.check('user1', 5, 60000);
      expect(result2.success).toBe(true);
      expect(result2.remaining).toBe(3);
    });

    it('should reject requests over limit', () => {
      // Use up all 5 requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.check('user1', 5, 60000);
      }

      // 6th request should be rejected
      const result = rateLimiter.check('user1', 5, 60000);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different identifiers separately', () => {
      rateLimiter.check('user1', 5, 60000);
      rateLimiter.check('user1', 5, 60000);

      const user1Result = rateLimiter.check('user1', 5, 60000);
      expect(user1Result.remaining).toBe(2);

      const user2Result = rateLimiter.check('user2', 5, 60000);
      expect(user2Result.remaining).toBe(4);
    });

    it('should include reset timestamp', () => {
      const now = Date.now();
      const windowMs = 60000;

      const result = rateLimiter.check('user1', 5, windowMs);
      expect(result.reset).toBeGreaterThanOrEqual(now + windowMs - 100);
      expect(result.reset).toBeLessThanOrEqual(now + windowMs + 100);
    });
  });

  describe('Window Expiration', () => {
    it('should reset count after window expires', async () => {
      const windowMs = 100; // 100ms window

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.check('user1', 5, windowMs);
      }

      // Should be rate limited
      const blockedResult = rateLimiter.check('user1', 5, windowMs);
      expect(blockedResult.success).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be allowed again
      const allowedResult = rateLimiter.check('user1', 5, windowMs);
      expect(allowedResult.success).toBe(true);
      expect(allowedResult.remaining).toBe(4);
    });

    it('should create new window when previous expired', async () => {
      const windowMs = 100;

      rateLimiter.check('user1', 5, windowMs);
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = rateLimiter.check('user1', 5, windowMs);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe('Reset Functions', () => {
    it('should reset specific identifier', () => {
      rateLimiter.check('user1', 5, 60000);
      rateLimiter.check('user1', 5, 60000);

      rateLimiter.reset('user1');

      const result = rateLimiter.check('user1', 5, 60000);
      expect(result.remaining).toBe(4);
    });

    it('should reset all identifiers', () => {
      rateLimiter.check('user1', 5, 60000);
      rateLimiter.check('user2', 5, 60000);

      rateLimiter.resetAll();

      const result1 = rateLimiter.check('user1', 5, 60000);
      const result2 = rateLimiter.check('user2', 5, 60000);

      expect(result1.remaining).toBe(4);
      expect(result2.remaining).toBe(4);
    });
  });

  describe('Stats', () => {
    it('should return current stats', () => {
      rateLimiter.check('user1', 5, 60000);
      rateLimiter.check('user2', 5, 60000);

      const stats = rateLimiter.getStats();
      expect(stats.totalEntries).toBe(2);
    });

    it('should update stats after cleanup', async () => {
      rateLimiter.check('user1', 5, 100);
      rateLimiter.check('user2', 5, 100);

      expect(rateLimiter.getStats().totalEntries).toBe(2);

      await new Promise(resolve => setTimeout(resolve, 150));

      // Trigger cleanup manually
      rateLimiter['cleanup']();

      expect(rateLimiter.getStats().totalEntries).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle limit of 1', () => {
      const result1 = rateLimiter.check('user1', 1, 60000);
      expect(result1.success).toBe(true);
      expect(result1.remaining).toBe(0);

      const result2 = rateLimiter.check('user1', 1, 60000);
      expect(result2.success).toBe(false);
      expect(result2.remaining).toBe(0);
    });

    it('should handle very large limits', () => {
      const result = rateLimiter.check('user1', 1000000, 60000);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(999999);
    });

    it('should handle very short windows', async () => {
      const result1 = rateLimiter.check('user1', 2, 10);
      expect(result1.success).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 20));

      const result2 = rateLimiter.check('user1', 2, 10);
      expect(result2.success).toBe(true);
      expect(result2.remaining).toBe(1);
    });
  });

  describe('Cleanup', () => {
    it('should clean up expired entries periodically', async () => {
      // Create entries with short window
      rateLimiter.check('user1', 5, 100);
      rateLimiter.check('user2', 5, 100);

      expect(rateLimiter.getStats().totalEntries).toBe(2);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Trigger cleanup
      rateLimiter['cleanup']();

      expect(rateLimiter.getStats().totalEntries).toBe(0);
    });

    it('should not clean up non-expired entries', () => {
      rateLimiter.check('user1', 5, 60000);
      rateLimiter.check('user2', 5, 60000);

      rateLimiter['cleanup']();

      expect(rateLimiter.getStats().totalEntries).toBe(2);
    });
  });

  describe('Destroy', () => {
    it('should clear all data on destroy', () => {
      rateLimiter.check('user1', 5, 60000);
      rateLimiter.check('user2', 5, 60000);

      rateLimiter.destroy();

      expect(rateLimiter.getStats().totalEntries).toBe(0);
    });
  });
});

describe('RateLimitPresets', () => {
  it('should have auth preset with strict limits', () => {
    expect(RateLimitPresets.auth.limit).toBe(5);
    expect(RateLimitPresets.auth.windowMs).toBe(60 * 1000);
  });

  it('should have api preset with moderate limits', () => {
    expect(RateLimitPresets.api.limit).toBe(60);
    expect(RateLimitPresets.api.windowMs).toBe(60 * 1000);
  });

  it('should have upload preset with lenient limits', () => {
    expect(RateLimitPresets.upload.limit).toBe(10);
    expect(RateLimitPresets.upload.windowMs).toBe(60 * 60 * 1000);
  });

  it('should have jobs preset with moderate limits', () => {
    expect(RateLimitPresets.jobs.limit).toBe(20);
    expect(RateLimitPresets.jobs.windowMs).toBe(60 * 60 * 1000);
  });
});

describe('getClientIdentifier', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      },
    });

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('192.168.1.1');
  });

  it('should extract IP from x-real-ip header', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-real-ip': '192.168.1.1',
      },
    });

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('192.168.1.1');
  });

  it('should prefer x-forwarded-for over x-real-ip', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'x-real-ip': '10.0.0.1',
      },
    });

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('192.168.1.1');
  });

  it('should return unknown when no IP headers present', () => {
    const request = new Request('http://localhost');

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('unknown');
  });

  it('should handle multiple IPs in x-forwarded-for', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '  192.168.1.1  , 10.0.0.1, 172.16.0.1',
      },
    });

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('192.168.1.1');
  });
});

describe('RateLimiter Integration', () => {
  beforeEach(() => {
    rateLimiter.resetAll();
  });

  afterEach(() => {
    rateLimiter.resetAll();
  });

  it('should work with auth preset', () => {
    const { limit, windowMs } = RateLimitPresets.auth;

    for (let i = 0; i < limit; i++) {
      const result = rateLimiter.check('user1', limit, windowMs);
      expect(result.success).toBe(true);
    }

    const result = rateLimiter.check('user1', limit, windowMs);
    expect(result.success).toBe(false);
  });

  it('should work with API preset', () => {
    const { limit, windowMs } = RateLimitPresets.api;

    for (let i = 0; i < limit; i++) {
      rateLimiter.check('user1', limit, windowMs);
    }

    const result = rateLimiter.check('user1', limit, windowMs);
    expect(result.success).toBe(false);
  });

  it('should handle concurrent requests from different IPs', () => {
    const request1 = new Request('http://localhost', {
      headers: { 'x-real-ip': '192.168.1.1' },
    });
    const request2 = new Request('http://localhost', {
      headers: { 'x-real-ip': '192.168.1.2' },
    });

    const ip1 = getClientIdentifier(request1);
    const ip2 = getClientIdentifier(request2);

    const result1 = rateLimiter.check(ip1, 5, 60000);
    const result2 = rateLimiter.check(ip2, 5, 60000);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.remaining).toBe(4);
    expect(result2.remaining).toBe(4);
  });
});
