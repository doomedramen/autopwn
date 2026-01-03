import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { comprehensiveSecurity } from "../../middleware/security";
import type { Context } from "hono";

describe("Security Middleware Basic Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockContext = (overrides: Partial<Context> = {}): any => ({
    req: {
      header: vi.fn(),
      url: "http://localhost/test",
      path: "/test",
      method: "GET",
      ...overrides?.req,
    },
    res: {
      headers: {
        set: vi.fn(),
        get: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
      },
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

  it("should apply security middleware without errors", async () => {
    const securityMiddleware = comprehensiveSecurity({
      allowedOrigins: ["http://localhost:3000", "https://localhost:3000"],
      trustProxy: false,
    });

    const mockContext = createMockContext({
      req: {
        header: vi
          .fn()
          .mockReturnValueOnce("500") // content-length
          .mockReturnValueOnce("https://localhost:3000") // origin
          .mockReturnValueOnce("Mozilla/5.0") // user-agent
          .mockReturnValueOnce("192.168.1.100"), // x-forwarded-for
        path: "/api/test",
      },
    });

    const mockNext = vi.fn();
    await securityMiddleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();

    // Verify security headers were set
    expect(mockContext.res.headers.set).toHaveBeenCalledWith(
      "X-Content-Type-Options",
      "nosniff",
    );
    expect(mockContext.res.headers.set).toHaveBeenCalledWith(
      "X-Frame-Options",
      "DENY",
    );
  });

  it("should handle requests from different origins", async () => {
    const securityMiddleware = comprehensiveSecurity({
      allowedOrigins: ["https://localhost:3000"],
    });

    const mockContext = createMockContext({
      req: {
        header: vi
          .fn()
          .mockReturnValueOnce("500") // content-length
          .mockReturnValueOnce("https://different.com") // origin
          .mockReturnValueOnce("Mozilla/5.0") // user-agent
          .mockReturnValueOnce("192.168.1.100"), // x-forwarded-for
        path: "/api/test",
      },
    });

    const mockNext = vi.fn();
    await securityMiddleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
    // Should still set security headers even if origin isn't explicitly allowed
    expect(mockContext.res.headers.set).toHaveBeenCalledWith(
      "X-Content-Type-Options",
      "nosniff",
    );
  });

  it("should handle large requests with size limits", async () => {
    const securityMiddleware = comprehensiveSecurity({
      maxRequestSize: 1000,
      stricterLimits: true,
    });

    const mockJson = vi.fn().mockReturnValue({ response: true }); // Return truthy value
    const mockHeader = vi.fn().mockReturnValue("1500"); // All calls return content-length (exceeds limit)

    const mockContext = createMockContext({
      req: {
        header: mockHeader,
        path: "/api/test",
      },
      json: mockJson, // Use the mock that returns a truthy value
    });

    const mockNext = vi.fn();
    await securityMiddleware(mockContext, mockNext);

    // Since size limit is exceeded, it should return early and not call next()
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockJson).toHaveBeenCalledWith(
      {
        success: false,
        error: "Request entity too large",
        code: "PAYLOAD_TOO_LARGE",
        message: expect.stringContaining("exceeds maximum allowed size"),
        maxSize: 1000,
      },
      413,
    );
  });
});
