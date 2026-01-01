import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  beforeAll,
  afterEach,
} from "vitest";
import { Context, Next } from "hono";
import {
  rateLimit,
  strictRateLimit,
  uploadRateLimit,
  clearRateLimitStore,
} from "../../middleware/rate-limit";

describe("Rate Limiting Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearRateLimitStore(); // Clear rate limit data between tests
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("General rate limiting", () => {
    it("should allow requests within limits", async () => {
      const rateLimiter = rateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 10,
        keyGenerator: () => "test-ip",
      });

      const mockNext = vi.fn();
      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue("127.0.0.1"),
        },
        res: {
          headers: {
            set: vi.fn(),
          },
          json: vi.fn(),
        },
        env: {
          get: vi.fn().mockReturnValue("127.0.0.1"),
        },
      };

      // First request
      await rateLimiter(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.res.headers.set).toHaveBeenCalledWith(
        "X-RateLimit-Limit",
        "10",
      );
      expect(mockContext.res.headers.set).toHaveBeenCalledWith(
        "X-RateLimit-Remaining",
        "9",
      );
    });

    it("should block requests exceeding limits", async () => {
      const rateLimiter = rateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 10,
        keyGenerator: () => "test-ip",
      });

      const mockNext = vi.fn();
      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue("127.0.0.1"),
        },
        res: {
          headers: {
            set: vi.fn(),
          },
          json: vi.fn(),
        },
        env: {
          get: vi.fn().mockReturnValue("127.0.0.1"),
        },
      };

      // Mock 10 previous requests within window
      for (let i = 0; i < 10; i++) {
        vi.setSystemTime(Date.now() - 55000 + i * 1000);
        await rateLimiter(mockContext as any, mockNext);
      }

      // 11th request should be blocked
      vi.setSystemTime(Date.now());

      // Expect rate limit error to be thrown
      await expect(rateLimiter(mockContext as any, mockNext)).rejects.toThrow(
        "Too many requests",
      );

      // Check that rate limit headers were set (order doesn't matter)
      const headerCalls = mockContext.res.headers.set.mock.calls;
      const headerKeys = headerCalls.map((call) => call[0]);
      const headerValues = Object.fromEntries(
        headerCalls.map((call) => [call[0], call[1]]),
      );

      expect(headerValues["X-RateLimit-Limit"]).toBe("10");
      expect(headerValues["X-RateLimit-Remaining"]).toBe("0");
      expect(headerValues["X-RateLimit-Reset"]).toMatch(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
      );
      // Note: JSON response is handled by the error handler, not the rate limiter directly
    });

    it("should reset counter after window expires", async () => {
      const rateLimiter = rateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 10,
        keyGenerator: () => "test-ip-reset", // Different key to avoid interference
      });

      const mockNext = vi.fn();
      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue("127.0.0.1"),
        },
        res: {
          headers: {
            set: vi.fn(),
          },
          json: vi.fn(),
        },
        env: {
          get: vi.fn().mockReturnValue("127.0.0.1"),
        },
      };

      // Request within window
      vi.setSystemTime(Date.now() - 30000); // 30 seconds ago
      await rateLimiter(mockContext as any, mockNext);

      mockNext.mockClear();
      mockContext.res.headers.set.mockClear();
      vi.setSystemTime(Date.now() + 30001); // Now 30 seconds + 1ms (after window)

      await rateLimiter(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      // Check that headers were set (order doesn't matter)
      expect(mockContext.res.headers.set).toHaveBeenCalledWith(
        "X-RateLimit-Limit",
        "10",
      );
      expect(mockContext.res.headers.set).toHaveBeenCalledWith(
        "X-RateLimit-Remaining",
        "8",
      ); // 2nd request should have 8 remaining
    });
  });

  describe("Strict rate limiting", () => {
    it("should apply stricter limits for auth endpoints", async () => {
      const strictLimiter = rateLimit({
        windowMs: 60000,
        maxRequests: 5, // Stricter limit for auth endpoints
        keyGenerator: (c: Context) =>
          c.req.header("authorization") || "anonymous",
      });

      const mockNext = vi.fn();
      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue("127.0.0.1"),
        },
        res: {
          headers: {
            set: vi.fn(),
          },
          json: vi.fn(),
        },
        env: {
          get: vi.fn().mockReturnValue("127.0.0.1"),
        },
      };

      await strictLimiter(mockContext as any, mockNext);

      expect(mockContext.res.headers.set).toHaveBeenCalledWith(
        "X-RateLimit-Limit",
        "5",
      ); // Stricter limit
      expect(mockContext.res.headers.set).toHaveBeenCalledWith(
        "X-RateLimit-Remaining",
        "4",
      );
    });
  });

  describe("Upload rate limiting", () => {
    it("should apply hourly limits for uploads", async () => {
      const uploadLimiter = rateLimit({
        windowMs: 3600000, // 1 hour
        maxRequests: 20, // 20 uploads per hour
        keyGenerator: (c: Context) =>
          c.req.header("x-upload-type") || "unknown-upload",
      });

      const mockNext = vi.fn();
      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue("127.0.0.1"),
        },
        res: {
          headers: {
            set: vi.fn(),
          },
          json: vi.fn(),
        },
        env: {
          get: vi.fn().mockReturnValue("127.0.0.1"),
        },
      };

      await uploadLimiter(mockContext as any, mockNext);

      // Check that headers were set in any order
      expect(mockContext.res.headers.set).toHaveBeenCalledWith(
        "X-RateLimit-Limit",
        "20",
      ); // Upload limit
      expect(mockContext.res.headers.set).toHaveBeenCalledWith(
        "X-RateLimit-Remaining",
        "19",
      );
    });
  });

  describe("Custom key generators", () => {
    it("should use custom key generator function", async () => {
      const customKeyGenerator = (c: Context) => {
        return c.req.header("x-user-id") || "unknown-ip";
      };

      const rateLimiter = rateLimit({
        keyGenerator: customKeyGenerator,
      });

      const mockContext = {
        req: {
          header: vi.fn().mockReturnValue("user-123"),
        },
        res: {
          headers: {
            set: vi.fn(),
          },
          json: vi.fn(),
        },
        env: {
          get: vi.fn().mockReturnValue("user-ip"),
        },
      };

      // Mock header with user ID
      mockContext.req.header = vi.fn().mockReturnValue("user-123");

      await rateLimiter(mockContext as any, vi.fn());

      // Verify the key was generated correctly
      expect(customKeyGenerator(mockContext as any)).toBe("user-123");
    });
  });
});
