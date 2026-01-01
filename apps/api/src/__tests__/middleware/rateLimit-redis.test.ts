import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  rateLimit,
  getRateLimitRedisClient,
  closeRateLimitRedis,
} from "../../middleware/rate-limit";
import type { Context } from "hono";

describe("Redis-backed Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up Redis client after tests
    await closeRateLimitRedis();
  });

  const createMockContext = (overrides: Partial<Context> = {}): any => ({
    req: {
      header: vi.fn((name: string) => {
        if (name === "x-forwarded-for") return "192.168.1.1";
        if (name === "x-real-ip") return "192.168.1.1";
        return undefined;
      }),
      url: "http://localhost/test",
      path: "/test",
      method: "GET",
      ...overrides?.req,
    },
    res: {
      headers: new Map(),
      set: vi.fn((key: string, value: string) => {
        // Mock header setting
      }),
      status: vi.fn(),
      json: vi.fn(),
      text: vi.fn(),
      ...overrides?.res,
    },
    header: vi.fn(),
    json: vi.fn(),
    text: vi.fn(),
    env: new Map(),
    ...overrides,
  });

  describe("Redis Integration", () => {
    it("should use in-memory fallback when Redis is disabled in tests", async () => {
      const rateLimitMiddleware = rateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 5,
        useRedis: false, // Explicitly disable Redis for testing
      });

      const mockContext = createMockContext();
      const mockNext = vi.fn();

      // Make 5 requests (should succeed)
      for (let i = 0; i < 5; i++) {
        await rateLimitMiddleware(mockContext, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);

      // 6th request should throw
      try {
        await rateLimitMiddleware(mockContext, mockNext);
        expect.fail("Should have thrown rate limit error");
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain("Too many requests");
      }
    });

    it("should add rate limit headers", async () => {
      const rateLimitMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 10,
        useRedis: false,
      });

      const headers = new Map<string, string>();
      const mockContext = createMockContext({
        res: {
          headers: {
            set: vi.fn((key: string, value: string) => {
              headers.set(key, value);
            }),
            get: vi.fn(),
            has: vi.fn(),
            delete: vi.fn(),
          },
        },
      });
      const mockNext = vi.fn();

      await rateLimitMiddleware(mockContext, mockNext);

      // Check that rate limit headers were set
      expect(mockContext.res.headers.set).toHaveBeenCalledWith(
        "X-RateLimit-Limit",
        "10",
      );
      expect(mockContext.res.headers.set).toHaveBeenCalledWith(
        "X-RateLimit-Remaining",
        "9",
      );
    });
  });

  describe("Rate Limit Errors", () => {
    it("should throw rate limit error when limit exceeded", async () => {
      const rateLimitMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 2,
        useRedis: false,
      });

      const mockContext = createMockContext();
      const mockNext = vi.fn();

      // Make 3 requests (should succeed)
      for (let i = 0; i < 3; i++) {
        await rateLimitMiddleware(mockContext, mockNext);
      }

      // 3rd request should throw
      try {
        await rateLimitMiddleware(mockContext, mockNext);
        expect.fail("Should have thrown rate limit error");
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain("Too many requests");
      }
    });

    it("should include retry-after header when rate limited", async () => {
      const rateLimitMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 1,
        useRedis: false,
      });

      const headers = new Map<string, string>();
      const mockContext = createMockContext({
        res: {
          headers: {
            set: vi.fn((key: string, value: string) => {
              headers.set(key, value);
            }),
            get: vi.fn(),
            has: vi.fn(),
            delete: vi.fn(),
          },
        },
      });
      const mockNext = vi.fn();

      // Make 1 request (should succeed)
      await rateLimitMiddleware(mockContext, mockNext);

      // 2nd request should throw
      try {
        await rateLimitMiddleware(mockContext, mockNext);
        expect.fail("Should have thrown rate limit error");
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Check that retry-after header was set before error
      expect(mockContext.res.headers.set).toHaveBeenCalledWith(
        "Retry-After",
        expect.any(String),
      );
    });
  });

  describe("Window Expiration", () => {
    it("should reset counter after window expires", async () => {
      const rateLimitMiddleware = rateLimit({
        windowMs: 1000, // 1 second window
        maxRequests: 2,
        useRedis: false,
      });

      const mockContext = createMockContext();
      const mockNext = vi.fn();

      vi.useFakeTimers();

      // Make 2 requests (should succeed)
      await rateLimitMiddleware(mockContext, mockNext);
      await rateLimitMiddleware(mockContext, mockNext);

      // 3rd request should fail
      try {
        await rateLimitMiddleware(mockContext, mockNext);
        expect.fail("Should have thrown rate limit error");
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain("Too many requests");
      }

      // Advance time past window
      vi.advanceTimersByTime(1000 + 100);

      // Should be able to make requests again
      await rateLimitMiddleware(mockContext, mockNext);
      await rateLimitMiddleware(mockContext, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });
});
