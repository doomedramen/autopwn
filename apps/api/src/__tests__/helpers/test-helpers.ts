import { db } from "@/db";
import { users, accounts, config } from "@/db/schema";
import { eq, sql, like } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Test database setup and cleanup
export async function setupTestDB() {
  // Clean up any existing test data
  await cleanupTestDB();

  // Ensure required config values exist
  await seedTestConfig();
}

// Seed test configuration values
async function seedTestConfig() {
  const requiredConfigs = [
    { id: "rateLimitUpload", value: 5 },
    { id: "email-enabled", value: true },
  ];

  for (const cfg of requiredConfigs) {
    const exists = await db.query.config.findFirst({
      where: eq(config.id, cfg.id),
    });

    if (!exists) {
      await db.insert(config).values({
        id: cfg.id,
        value: cfg.value,
        category: "general",
        type: typeof cfg.value as any,
        defaultValue: cfg.value,
        minValue: typeof cfg.value === "number" ? 1 : undefined,
        maxValue: typeof cfg.value === "number" ? 100 : undefined,
        isReadOnly: false,
        requiresRestart: false,
        updatedAt: new Date(),
      });
    }
  }
}

export async function cleanupTestDB() {
  // Clean up test data using raw SQL with LIKE
  await db.execute(sql`DELETE FROM accounts WHERE user_id LIKE 'test-%'`);
  await db.execute(sql`DELETE FROM users WHERE id LIKE 'test-%'`);
}

// Create test user with proper account record
export async function createTestUser(overrides: Partial<any> = {}) {
  const userId = `test-${crypto.randomUUID()}`;
  const email =
    overrides.email || `test-${crypto.randomUUID().slice(0, 8)}@test.com`;
  const password = "password123"; // Standard test password
  // Skip bcrypt hashing for tests - use plain text password
  // The test DB uses auth but we're using mock auth headers anyway
  const hashedPassword = password;

  const [user] = await db
    .insert(users)
    .values({
      id: userId,
      email,
      name: overrides.name || email.split("@")[0],
      role: overrides.role || "user",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })
    .returning();

  // Create account record for authentication
  await db.insert(accounts).values({
    id: crypto.randomUUID(),
    userId: userId,
    accountId: userId,
    providerId: "credential",
    provider: "credential",
    password: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return user;
}

// Get auth headers for a user (simplified - doesn't use Better Auth)
export async function getAuthHeaders(email: string, password: string) {
  // For testing purposes, we'll use a simple mock auth token
  // In a real scenario, this would involve Better Auth's session creation
  const mockToken = Buffer.from(`${email}:${password}`).toString("base64");

  return {
    Authorization: `Bearer ${mockToken}`,
    "X-Test-Auth": "true",
    "X-Test-Email": email,
  };
}

// Mock auth middleware for testing
export const mockAuthMiddleware = async (c: any, next: any) => {
  const testEmail = c.req.header("X-Test-Email");
  const testAuth = c.req.header("X-Test-Auth");

  if (testAuth !== "true" || !testEmail) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Find user by email
  const user = await db.query.users.findFirst({
    where: eq(users.email, testEmail),
  });

  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  // Set user context
  c.set("user", user);
  c.set("userId", user.id);
  c.set("userRole", user.role);

  await next();
};

// Helper function to run tests with mocked auth
export async function testWithAuth(
  testFn: (auth: any) => Promise<void>,
  email: string,
  role: string = "user",
) {
  const user = await createTestUser({ email, role });
  const auth = await getAuthHeaders(email, "password123");

  try {
    await testFn({ user, auth });
  } finally {
    // Cleanup is handled by cleanupTestDB
  }
}
