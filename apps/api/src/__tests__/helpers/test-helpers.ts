import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import crypto from "crypto";
import "../../config/env";

let testDb: any = null;

function getTestDb() {
  if (!testDb) {
    const connectionString =
      process.env.DATABASE_URL ||
      "postgresql://postgres:password@localhost:5432/autopwn_test";
    const client = postgres(connectionString);
    testDb = drizzle(client, { schema });
  }
  return testDb;
}

export { getTestDb };

export async function setupTestDB() {
  const database = getTestDb();
  const { config } = schema;

  await cleanupTestDB();
  await seedTestConfig(database, config);
}

async function seedTestConfig(database: any, config: any) {
  const requiredConfigs = [
    { id: "rateLimitUpload", value: 5 },
    { id: "email-enabled", value: true },
  ];

  for (const cfg of requiredConfigs) {
    const exists = await database.query.config.findFirst({
      where: eq(config.id, cfg.id),
    });

    if (!exists) {
      await database.insert(config).values({
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
  const database = getTestDb();
  const testPrefix = "test-%";

  await database.execute(
    sql`DELETE FROM accounts WHERE user_id LIKE ${testPrefix}`,
  );
  await database.execute(sql`DELETE FROM users WHERE id LIKE ${testPrefix}`);
}

export async function createTestUser(overrides: Partial<any> = {}) {
  const database = getTestDb();
  const { users, accounts } = schema;
  const userId = `test-${crypto.randomUUID()}`;
  const email =
    overrides.email || `test-${crypto.randomUUID().slice(0, 8)}@test.com`;
  const password = "test-password-123";

  const [user] = await database
    .insert(users)
    .values({
      id: userId,
      email,
      name: overrides.name || email.split("@")[0],
      role: overrides.role || "user",
      emailVerified: true,
      password: password,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })
    .returning();

  await database.insert(accounts).values({
    id: crypto.randomUUID(),
    userId: userId,
    accountId: userId,
    providerId: "credential",
    provider: "credential",
    password: password,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return user;
}

export async function getAuthHeaders(email: string, password: string) {
  const mockToken = Buffer.from(`${email}:${password}`).toString("base64");

  return {
    authorization: `Bearer ${mockToken}`,
    Authorization: `Bearer ${mockToken}`,
    "X-Test-Auth": "true",
    "X-Test-Email": email,
  };
}

export const mockAuthMiddleware = async (c: any, next: any) => {
  const testEmail = c.req.header("X-Test-Email");
  const testAuth = c.req.header("X-Test-Auth");

  if (testAuth !== "true" || !testEmail) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const database = getTestDb();
  const { users } = schema;

  const user = await database.query.users.findFirst({
    where: eq(users.email, testEmail),
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  c.set("user", user);
  c.set("userId", user.id);
  c.set("userRole", user.role);

  await next();
};

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
  }
}
