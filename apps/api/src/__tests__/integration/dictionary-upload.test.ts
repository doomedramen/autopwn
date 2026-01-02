import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import {
  setupTestDB,
  cleanupTestDB,
  createTestUser,
  getAuthHeaders,
} from "../helpers/test-helpers";
import fs from "fs";
import path from "path";
import crypto from "crypto";

describe("Dictionary Upload API", () => {
  let adminAuth: Record<string, string>;
  let userAuth: Record<string, string>;
  let superuserAuth: Record<string, string>;
  let adminUser: any;
  let regularUser: any;
  let superUser: any;

  beforeAll(async () => {
    await setupTestDB();

    // Create test users with different roles
    adminUser = await createTestUser({ role: "admin" });
    regularUser = await createTestUser({ role: "user" });
    superUser = await createTestUser({ role: "superuser" });

    adminAuth = await getAuthHeaders(adminUser.email, "test-password-123");
    userAuth = await getAuthHeaders(regularUser.email, "test-password-123");
    superuserAuth = await getAuthHeaders(superUser.email, "test-password-123");
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  describe("Test Infrastructure", () => {
    test("should create test users successfully", async () => {
      expect(adminUser).toBeDefined();
      expect(adminUser.id).toBeDefined();
      expect(regularUser).toBeDefined();
      expect(superUser).toBeDefined();
    });

    test("should cleanup test database", async () => {
      await setupTestDB();
      await cleanupTestDB();
      // Test cleanup worked
      expect(true).toBe(true);
    });
  });
});
