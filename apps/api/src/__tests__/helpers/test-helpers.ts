import { db } from '@/db'
import { users, accounts } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// Test database setup and cleanup
export async function setupTestDB() {
  // Clean up any existing test data
  await cleanupTestDB()
}

export async function cleanupTestDB() {
  // Clean up test data
  await db.delete(accounts).where(eq(accounts.userId, sql`user_id LIKE 'test-%'`))
  await db.delete(users).where(eq(users.id, sql`id LIKE 'test-%'`))
}

// Create test user with proper account record
export async function createTestUser(overrides: Partial<any> = {}) {
  const userId = `test-${crypto.randomUUID()}`
  const email = overrides.email || `test-${crypto.randomUUID().slice(0, 8)}@test.com`
  const password = 'password123' // Standard test password
  const hashedPassword = await bcrypt.hash(password, 10)

  const [user] = await db.insert(users).values({
    id: userId,
    email,
    name: overrides.name || email.split('@')[0],
    role: overrides.role || 'user',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }).returning()

  // Create account record for authentication
  await db.insert(accounts).values({
    id: crypto.randomUUID(),
    userId: userId,
    accountId: userId,
    providerId: 'credential',
    provider: 'credential',
    password: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return user
}

// Get auth headers for a user (simplified - doesn't use Better Auth)
export async function getAuthHeaders(email: string, password: string) {
  // For testing purposes, we'll use a simple mock auth token
  // In a real scenario, this would involve Better Auth's session creation
  const mockToken = Buffer.from(`${email}:${password}`).toString('base64')

  return {
    'Authorization': `Bearer ${mockToken}`,
    'X-Test-Auth': 'true',
    'X-Test-Email': email
  }
}

// Mock auth middleware for testing
export const mockAuthMiddleware = async (c: any, next: any) => {
  const testEmail = c.req.header('X-Test-Email')
  const testAuth = c.req.header('X-Test-Auth')

  if (testAuth !== 'true' || !testEmail) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Find user by email
  const user = await db.query.users.findFirst({
    where: eq(users.email, testEmail)
  })

  if (!user) {
    return c.json({ error: 'User not found' }, 401)
  }

  // Set user context
  c.set('user', user)
  c.set('userId', user.id)
  c.set('userRole', user.role)

  await next()
}

// Helper function to run tests with mocked auth
export async function testWithAuth(testFn: (auth: any) => Promise<void>, email: string, role: string = 'user') {
  const user = await createTestUser({ email, role })
  const auth = await getAuthHeaders(email, 'password123')

  try {
    await testFn({ user, auth })
  } finally {
    // Cleanup is handled by cleanupTestDB
  }
}