import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import { app } from "@/index";
import {
  setupTestDB,
  cleanupTestDB,
  createTestUser,
  getAuthHeaders,
} from "../helpers/test-helpers";
import { db } from "@/db";
import { config, captures, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("New Features Integration Test", () => {
  let superuserAuth: Record<string, string>;
  let adminAuth: Record<string, string>;
  let userAuth: Record<string, string>;
  let superUser: any;
  let adminUser: any;
  let regularUser: any;
  let testCaptureId: string;
  let testNetworkId: string;

  beforeAll(async () => {
    await setupTestDB();

    superUser = await createTestUser({ role: "superuser" });
    adminUser = await createTestUser({ role: "admin" });
    regularUser = await createTestUser({ role: "user" });

    superuserAuth = await getAuthHeaders(superUser.email, "password123");
    adminAuth = await getAuthHeaders(adminUser.email, "password123");
    userAuth = await getAuthHeaders(regularUser.email, "password123");

    const testUUID = crypto.randomUUID();

    testCaptureId = testUUID;
    testNetworkId = testUUID;
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  beforeEach(async () => {
    const dbSpy = vi.spyOn(db, "select", "mockResolvedValue");
    dbSpy.mockResolvedValue([]);

    const [capture] = await db
      .insert(captures)
      .values({
        id: testCaptureId,
        filename: "test.pcap",
        userId: regularUser.id,
        status: "completed",
        fileSize: 1024,
        filePath: `/data/uploads/captures/${testCaptureId}/test.pcap`,
        networkCount: 1,
        uploadedAt: new Date(),
        metadata: {},
      })
      .returning();

    const [network] = await db
      .insert(networks)
      .values({
        id: testNetworkId,
        ssid: "Test Network",
        bssid: "AA:BB:CC:DD:EE:FF:00:11:22",
        encryption: "WPA2",
        hasHandshake: true,
        hasPMKID: false,
        channel: 6,
        frequency: 2437,
        signalStrength: -45,
        status: "ready",
        captureDate: new Date(),
        userId: regularUser.id,
        notes: "Test network for integration tests",
      })
      .returning();
  });

  afterEach(async () => {
    await db.delete(captures).where(eq(captures.id, testCaptureId));
    await db.delete(networks).where(eq(networks.id, testNetworkId));
    await db.delete(auditLogs).where(eq(auditLogs.userId, regularUser.id));
  });

  describe("ConfigService Integration", () => {
    test("should load config on startup", async () => {
      const response = await app.request("/api/config/reload", {
        method: "POST",
        headers: {
          ...superuserAuth,
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe("Config reloaded successfully");
    });

    test("should get all config values", async () => {
      const response = await app.request("/api/config", {
        method: "GET",
        headers: {
          ...superuserAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThan(0);
    });

    test("should update config value", async () => {
      const response = await app.request("/api/config", {
        method: "PATCH",
        headers: {
          ...superuserAuth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          updates: [
            {
              id: "max-pcap-size",
              value: 104857600, // 100MB instead of 500MB for testing
            },
          ],
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.updated).toHaveLength(1);
    });

    test("should validate config value before update", async () => {
      const response = await app.request("/api/config/validate", {
        method: "POST",
        headers: {
          ...superuserAuth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          updates: [
            {
              id: "max-pcap-size",
              value: 0, // Invalid value
            },
          ],
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].valid).toBe(false);
      expect(body.data[0].error).toBeDefined();
    });

    test("should reject update from non-superuser", async () => {
      const response = await app.request("/api/config", {
        method: "PATCH",
        headers: {
          ...userAuth, // Regular user trying to update config
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          updates: [
            {
              id: "max-pcap-size",
              value: 104857600,
            },
          ],
        }),
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });

  describe("AuditService Integration", () => {
    test("should get audit logs for user", async () => {
      const response = await app.request("/api/audit/user/test-user-id", {
        method: "GET",
        headers: {
          ...adminAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
    });

    test("should get audit statistics", async () => {
      const response = await app.request("/api/audit/statistics", {
        method: "GET",
        headers: {
          ...adminAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("total");
      expect(body.data).toHaveProperty("successful");
      expect(body.data).toHaveProperty("failed");
    });

    test("should get audit logs by entity type", async () => {
      const response = await app.request(
        `/api/audit/entity/capture/${testCaptureId}`,
        {
          method: "GET",
          headers: {
            ...adminAuth,
          },
        },
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      expect(
        body.data.every(
          (log: any) =>
            log.entityType === "capture" && log.entityId === testCaptureId,
        ),
      ).toBe(true);
    });

    test("should export audit logs to CSV", async () => {
      const response = await app.request(
        "/api/audit/export?userId=test-user-id",
        {
          method: "GET",
          headers: {
            ...adminAuth,
          },
        },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/csv");
      expect(response.headers.get("content-disposition")).toContain(
        "audit-logs",
      );
    });

    test("should delete old audit logs", async () => {
      const response = await app.request("/api/audit/cleanup", {
        method: "DELETE",
        headers: {
          ...superuserAuth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          olderThanDays: 90,
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.deletedCount).toBeGreaterThanOrEqual(0);
    });

    test("should reject audit access from regular user", async () => {
      const response = await app.request("/api/audit/user/test-user-id", {
        method: "GET",
        headers: {
          ...userAuth, // Regular user
        },
      });

      expect(response.status).toBe(403);
    });
  });

  describe("HealthCheckService Integration", () => {
    test("should get overall health status", async () => {
      const response = await app.request("/api/v1/health", {
        method: "GET",
        headers: {
          ...userAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toMatch(/healthy|degraded|unhealthy/);
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("uptime");
      expect(body).toHaveProperty("checks");
      expect(body.checks).toHaveProperty("database");
      expect(body.checks).toHaveProperty("redis");
      expect(body.checks).toHaveProperty("workers");
      expect(body.checks).toHaveProperty("disk");
    });

    test("should get database health status", async () => {
      const response = await app.request("/api/v1/health/database", {
        method: "GET",
        headers: {
          ...userAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toMatch(/healthy|degraded|unhealthy/);
      expect(body).toHaveProperty("database");
    });

    test("should get Redis health status", async () => {
      const response = await app.request("/api/v1/health/redis", {
        method: "GET",
        headers: {
          ...userAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toMatch(/healthy|degraded|unhealthy/);
      expect(body).toHaveProperty("redis");
      expect(body.redis).toHaveProperty("status");
      expect(body.redis).toHaveProperty("message");
      expect(body.redis).toHaveProperty("latency");
      expect(body.redis).toHaveProperty("queueStats");
    });

    test("should get disk health status", async () => {
      const response = await app.request("/api/v1/health/disk", {
        method: "GET",
        headers: {
          ...userAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toMatch(/healthy|degraded|unhealthy/);
      expect(body).toHaveProperty("disk");
      expect(body.disk).toHaveProperty("usedPercentage");
      expect(body.disk).toHaveProperty("usedBytes");
      expect(body.disk).toHaveProperty("totalBytes");
    });

    test("should get workers health status", async () => {
      const response = await app.request("/api/v1/health/workers", {
        method: "GET",
        headers: {
          ...userAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toMatch(/healthy|degraded|unhealthy/);
      expect(body).toHaveProperty("workers");
    });

    test("should get health summary", async () => {
      const response = await app.request("/api/v1/health/summary", {
        method: "GET",
        headers: {
          ...userAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("ok");
      expect(body).toHaveProperty("summary");
      expect(body.summary).toHaveProperty("uptime");
      expect(body.summary).toHaveProperty("uptimeFormatted");
      expect(body.summary).toHaveProperty("startTime");
    });

    test("health endpoints are accessible without authentication", async () => {
      const response = await app.request("/api/v1/health", {
        method: "GET",
        headers: {}, // No auth
      });

      expect(response.status).toBe(200);
    });
  });

  describe("Captures Integration", () => {
    test("should create capture record", async () => {
      const FormData = require("form-data");
      const form = new FormData();
      const pcapFile = Buffer.from("test pcap data");
      form.append(
        "file",
        new File([pcapFile], "test.pcap", {
          type: "application/vnd.tcpdump.pcap",
        }),
      );

      const response = await app.request("/api/captures", {
        method: "POST",
        headers: {
          ...userAuth,
        },
        body: form,
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("id");
      expect(body.data).toHaveProperty("filename");
      expect(body.data).toHaveProperty("status");
    });

    test("should list captures", async () => {
      const response = await app.request("/api/captures?page=1&limit=10", {
        method: "GET",
        headers: {
          ...userAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.pagination).toBeDefined();
    });

    test("should get capture by ID", async () => {
      const response = await app.request(`/api/captures/${testCaptureId}`, {
        method: "GET",
        headers: {
          ...userAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(testCaptureId);
    });

    test("should delete capture", async () => {
      const response = await app.request(`/api/captures/${testCaptureId}`, {
        method: "DELETE",
        headers: {
          ...userAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should only allow user to see their own captures", async () => {
      const createResponse = await app.request("/api/captures", {
        method: "POST",
        headers: {
          ...adminAuth,
        },
        body: new FormData(),
      });

      const userCaptureId = (await createResponse.json()).data.id;

      const response = await app.request(`/api/captures/${userCaptureId}`, {
        method: "GET",
        headers: {
          ...userAuth, // Different user
        },
      });

      expect(response.status).toBe(403); // Forbidden
    });
  });

  describe("Cross-Service Integration", () => {
    test("upload should create audit log entry", async () => {
      const FormData = require("form-data");
      const form = new FormData();
      const pcapFile = Buffer.from("test pcap data");
      form.append(
        "file",
        new File([pcapFile], "test.pcap", {
          type: "application/vnd.tcpdump.pcap",
        }),
      );

      await app.request("/api/captures", {
        method: "POST",
        headers: {
          ...userAuth,
        },
        body: form,
      });

      const response = await app.request("/api/audit/user/test-user-id", {
        method: "GET",
        headers: {
          ...adminAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;

      const uploadLogs = body.data.filter(
        (log: any) => log.action === "capture.upload",
      );
      expect(uploadLogs.length).toBeGreaterThan(0);
    });

    test("config changes should be audited", async () => {
      await app.request("/api/config/reload", {
        method: "POST",
        headers: {
          ...superuserAuth,
        },
      });

      const response = await app.request("/api/audit/entity/config/null", {
        method: "GET",
        headers: {
          ...superuserAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;

      const configLogs = body.data.filter(
        (log: any) => log.action === "config.reload",
      );
      expect(configLogs.length).toBeGreaterThan(0);
    });

    test("config update with capture.create creates audit trail", async () => {
      const FormData = require("form-data");
      const form = new FormData();
      const pcapFile = Buffer.from("test pcap data");
      form.append(
        "file",
        new File([pcapFile], "test.pcap", {
          type: "application/vnd.tcpdump.pcap",
        }),
      );

      await app.request("/api/config", {
        method: "PATCH",
        headers: {
          ...superuserAuth,
        },
        body: JSON.stringify({
          updates: [
            {
              id: "max-pcap-size",
              value: 104857600,
            },
          ],
        }),
      });

      await app.request("/api/audit/entity/config/max-pcap-size", {
        method: "GET",
        headers: {
          ...superuserAuth,
        },
      });

      const response = await app.request("/api/captures", {
        method: "GET",
        headers: {
          ...superuserAuth,
        },
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;

      const configUpdateLogs = body.data.filter(
        (log: any) => log.action === "config.update",
      );
      const captureUploadLogs = body.data.filter(
        (log: any) => log.action === "capture.upload",
      );

      expect(configUpdateLogs.length).toBeGreaterThan(0);
      expect(captureUploadLogs.length).toBeGreaterThan(0);
    });

    test("health checks are logged and accessible", async () => {
      await app.request("/api/v1/health", {
        method: "GET",
        headers: {
          ...userAuth,
        },
      });

      const response = await app.request("/api/v1/health/database", {
        method: "GET",
        headers: {
          ...userAuth,
        },
      });

      expect(response.status).toBe(200);
      expect(await (await response.json()).status).toMatch(
        /healthy|degraded|unhealthy/,
      );
      expect(await (await response.json()).status).toMatch(
        /healthy|degraded|unhealthy/,
      );
    });
  });
});
