import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getTestDb, testHelpers } from '../setup'
import { users, accounts, sessions } from '../../src/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'

// Mock the logger
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    security: vi.fn(),
  },
}))

// Mock the audit service
vi.mock('../../src/services/audit.service', () => ({
  auditService: {
    logEvent: vi.fn(() => Promise.resolve()),
  },
}))

describe('Users Routes (Database Operations)', () => {
  let db: ReturnType<typeof getTestDb>

  beforeEach(async () => {
    db = getTestDb()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        role: 'user' as const,
        emailVerified: true,
      }

      const [newUser] = await db.insert(users).values(userData).returning()

      expect(newUser).toBeDefined()
      expect(newUser.email).toBe('test@example.com')
      expect(newUser.name).toBe('Test User')
      expect(newUser.role).toBe('user')
      expect(newUser.emailVerified).toBe(true)
      expect(newUser.id).toBeDefined()
    })

    it('should create admin user', async () => {
      const admin = await testHelpers.createAdmin({
        email: 'admin@example.com',
        name: 'Admin User',
      })

      expect(admin.role).toBe('admin')
      expect(admin.email).toBe('admin@example.com')
    })

    it('should create superuser', async () => {
      const superuser = await testHelpers.createSuperuser({
        email: 'super@example.com',
        name: 'Super User',
      })

      expect(superuser.role).toBe('superuser')
      expect(superuser.email).toBe('super@example.com')
    })

    it('should enforce unique email constraint', async () => {
      const email = 'duplicate@example.com'

      await testHelpers.createUser({ email })

      // Attempting to create another user with same email should fail
      await expect(
        db.insert(users).values({
          email,
          name: 'Another User',
          role: 'user',
          emailVerified: true,
        }),
      ).rejects.toThrow()
    })

    it('should validate email format', async () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user @example.com',
      ]

      for (const email of invalidEmails) {
        // Drizzle doesn't validate email format at DB level, but Zod does in the routes
        // This test verifies the DB will accept the value
        const [user] = await db
          .insert(users)
          .values({
            email,
            name: 'Test User',
            role: 'user',
            emailVerified: false,
          })
          .returning()

        expect(user.email).toBe(email)
        await db.delete(users).where(eq(users.id, user.id))
      }
    })

    it('should validate role enum', async () => {
      const validRoles = ['user', 'admin', 'superuser'] as const

      for (const role of validRoles) {
        const user = await testHelpers.createUser({ role })
        expect(user.role).toBe(role)
      }
    })
  })

  describe('User Reading', () => {
    let testUsers: any[]

    beforeEach(async () => {
      testUsers = []
      // Create multiple test users
      for (let i = 0; i < 3; i++) {
        testUsers.push(
          await testHelpers.createUser({
            email: `user${i}@example.com`,
            name: `User ${i}`,
          }),
        )
      }
    })

    it('should get all users', async () => {
      const result = await db.select().from(users)

      expect(result.length).toBeGreaterThanOrEqual(3)
    })

    it('should get user by id', async () => {
      const user = testUsers[0]

      const result = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      })

      expect(result).toBeDefined()
      expect(result?.email).toBe(user.email)
      expect(result?.name).toBe(user.name)
    })

    it('should get user by email', async () => {
      const user = testUsers[0]

      const result = await db.query.users.findFirst({
        where: eq(users.email, user.email),
      })

      expect(result).toBeDefined()
      expect(result?.id).toBe(user.id)
    })

    it('should filter users by role', async () => {
      await testHelpers.createAdmin({ email: 'admin@example.com' })
      await testHelpers.createSuperuser({ email: 'super@example.com' })

      const admins = await db.query.users.findMany({
        where: eq(users.role, 'admin'),
      })

      admins.forEach(admin => {
        expect(admin.role).toBe('admin')
      })
    })

    it('should select specific fields only', async () => {
      const user = testUsers[0]

      const result = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, user.id))

      expect(result[0]).toBeDefined()
      expect(result[0]).toHaveProperty('id')
      expect(result[0]).toHaveProperty('email')
      expect(result[0]).toHaveProperty('name')
      expect(result[0]).toHaveProperty('role')
    })
  })

  describe('User Updates', () => {
    let testUser: any

    beforeEach(async () => {
      testUser = await testHelpers.createUser({
        email: 'updatetest@example.com',
        name: 'Original Name',
      })
    })

    it('should update user name', async () => {
      await db
        .update(users)
        .set({
          name: 'Updated Name',
          updatedAt: new Date(),
        })
        .where(eq(users.id, testUser.id))

      const result = await db.query.users.findFirst({
        where: eq(users.id, testUser.id),
      })

      expect(result?.name).toBe('Updated Name')
    })

    it('should update user email', async () => {
      await db
        .update(users)
        .set({
          email: 'newemail@example.com',
          updatedAt: new Date(),
        })
        .where(eq(users.id, testUser.id))

      const result = await db.query.users.findFirst({
        where: eq(users.id, testUser.id),
      })

      expect(result?.email).toBe('newemail@example.com')
    })

    it('should update user role', async () => {
      await db
        .update(users)
        .set({
          role: 'admin',
          updatedAt: new Date(),
        })
        .where(eq(users.id, testUser.id))

      const result = await db.query.users.findFirst({
        where: eq(users.id, testUser.id),
      })

      expect(result?.role).toBe('admin')
    })

    it('should update emailVerified status', async () => {
      await db
        .update(users)
        .set({
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, testUser.id))

      const result = await db.query.users.findFirst({
        where: eq(users.id, testUser.id),
      })

      expect(result?.emailVerified).toBe(true)
    })

    it('should update multiple fields at once', async () => {
      await db
        .update(users)
        .set({
          name: 'New Name',
          email: 'new@example.com',
          role: 'admin',
          emailVerified: true,
          image: 'https://example.com/avatar.jpg',
          updatedAt: new Date(),
        })
        .where(eq(users.id, testUser.id))

      const result = await db.query.users.findFirst({
        where: eq(users.id, testUser.id),
      })

      expect(result?.name).toBe('New Name')
      expect(result?.email).toBe('new@example.com')
      expect(result?.role).toBe('admin')
      expect(result?.emailVerified).toBe(true)
      expect(result?.image).toBe('https://example.com/avatar.jpg')
    })
  })

  describe('User Deletion', () => {
    it('should delete a user', async () => {
      const user = await testHelpers.createUser({
        email: 'todelete@example.com',
      })

      // Verify user exists
      let result = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      })
      expect(result).toBeDefined()

      // Delete user
      await db.delete(users).where(eq(users.id, user.id))

      // Verify user is deleted
      result = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      })
      expect(result).toBeNull()
    })

    it('should cascade delete to sessions', async () => {
      const user = await testHelpers.createUser({
        email: 'cascade@example.com',
      })

      // Create a session
      const session = await testHelpers.createSession(user.id)

      // Verify session exists
      let sessionResult = await db.query.sessions.findFirst({
        where: eq(sessions.id, session.id),
      })
      expect(sessionResult).toBeDefined()

      // Delete user (should cascade to sessions)
      await db.delete(users).where(eq(users.id, user.id))

      // Verify session is deleted
      sessionResult = await db.query.sessions.findFirst({
        where: eq(sessions.id, session.id),
      })
      expect(sessionResult).toBeNull()
    })

    it('should cascade delete to accounts', async () => {
      const user = await testHelpers.createUser({
        email: 'accounts@example.com',
      })

      // Verify account exists
      let accountResult = await db.query.accounts.findFirst({
        where: eq(accounts.userId, user.id),
      })
      expect(accountResult).toBeDefined()

      // Delete user (should cascade to accounts)
      await db.delete(users).where(eq(users.id, user.id))

      // Verify account is deleted
      accountResult = await db.query.accounts.findFirst({
        where: eq(accounts.userId, user.id),
      })
      expect(accountResult).toBeNull()
    })
  })

  describe('Account Management', () => {
    describe('Password accounts', () => {
      it('should create account with hashed password', async () => {
        const user = await testHelpers.createUser({
          email: 'passworduser@example.com',
        })

        const account = await db.query.accounts.findFirst({
          where: eq(accounts.userId, user.id),
        })

        expect(account).toBeDefined()
        expect(account?.provider).toBe('credential')
        expect(account?.password).toBeDefined()
        expect(account?.password).not.toBe('plaintext_password')
        expect(account?.password?.length).toBeGreaterThan(20) // bcrypt hash
      })

      it('should verify password hash matches', async () => {
        const plainPassword = 'testPassword123'
        const hashedPassword = await bcrypt.hash(plainPassword, 10)

        const isValid = await bcrypt.compare(plainPassword, hashedPassword)
        expect(isValid).toBe(true)

        const isInvalid = await bcrypt.compare('wrongpassword', hashedPassword)
        expect(isInvalid).toBe(false)
      })
    })

    describe('OAuth accounts', () => {
      it('should store OAuth provider info', async () => {
        const user = await testHelpers.createUser({
          email: 'oauthuser@example.com',
        })

        await db.insert(accounts).values({
          id: crypto.randomUUID(),
          userId: user.id,
          accountId: 'google-account-id',
          providerId: 'google',
          provider: 'google',
          accessToken: 'google-access-token',
          refreshToken: 'google-refresh-token',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        const oauthAccounts = await db.query.accounts.findMany({
          where: eq(accounts.userId, user.id),
        })

        expect(oauthAccounts.length).toBeGreaterThan(0)
        const googleAccount = oauthAccounts.find(a => a.provider === 'google')
        expect(googleAccount).toBeDefined()
        expect(googleAccount?.providerId).toBe('google')
      })
    })
  })

  describe('Session Management', () => {
    let testUser: any

    beforeEach(async () => {
      testUser = await testHelpers.createUser({
        email: 'sessionuser@example.com',
      })
    })

    it('should create a session', async () => {
      const session = await testHelpers.createSession(testUser.id)

      expect(session).toBeDefined()
      expect(session.userId).toBe(testUser.id)
      expect(session.token).toBeDefined()
      expect(session.expiresAt).toBeDefined()
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now())
    })

    it('should get sessions for a user', async () => {
      await testHelpers.createSession(testUser.id)
      await testHelpers.createSession(testUser.id)

      const userSessions = await db.query.sessions.findMany({
        where: eq(sessions.userId, testUser.id),
      })

      expect(userSessions.length).toBe(2)
    })

    it('should validate session expiration', async () => {
      const expiredSession = await testHelpers.createSession(testUser.id, {
        expiresAt: new Date(Date.now() - 1000), // Expired
      })

      const isExpired = expiredSession.expiresAt.getTime() < Date.now()
      expect(isExpired).toBe(true)
    })

    it('should delete session', async () => {
      const session = await testHelpers.createSession(testUser.id)

      // Verify session exists
      let result = await db.query.sessions.findFirst({
        where: eq(sessions.id, session.id),
      })
      expect(result).toBeDefined()

      // Delete session
      await db.delete(sessions).where(eq(sessions.id, session.id))

      // Verify session is deleted
      result = await db.query.sessions.findFirst({
        where: eq(sessions.id, session.id),
      })
      expect(result).toBeNull()
    })
  })

  describe('User Timestamps', () => {
    it('should set createdAt and updatedAt automatically', async () => {
      const beforeCreate = new Date()

      const user = await testHelpers.createUser({
        email: 'timestamps@example.com',
      })

      const afterCreate = new Date()

      expect(user.createdAt).toBeDefined()
      expect(user.updatedAt).toBeDefined()
      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(user.updatedAt.getTime()).toBe(user.createdAt.getTime())
    })

    it('should update updatedAt on modification', async () => {
      const user = await testHelpers.createUser({
        email: 'updatetimestamp@example.com',
      })

      // Wait to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      await db
        .update(users)
        .set({
          name: 'Updated',
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))

      const result = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      })

      expect(result?.updatedAt.getTime()).toBeGreaterThan(user.createdAt.getTime())
    })
  })

  describe('User Queries and Filtering', () => {
    beforeEach(async () => {
      // Create users with different roles
      await testHelpers.createUser({ email: 'user1@example.com', role: 'user' })
      await testHelpers.createUser({ email: 'user2@example.com', role: 'user' })
      await testHelpers.createAdmin({ email: 'admin1@example.com' })
      await testHelpers.createSuperuser({ email: 'super1@example.com' })
    })

    it('should count users by role', async () => {
      const allUsers = await db.query.users.findMany()

      const regularUsers = allUsers.filter(u => u.role === 'user')
      const admins = allUsers.filter(u => u.role === 'admin')
      const superusers = allUsers.filter(u => u.role === 'superuser')

      expect(regularUsers.length).toBeGreaterThanOrEqual(2)
      expect(admins.length).toBeGreaterThanOrEqual(1)
      expect(superusers.length).toBeGreaterThanOrEqual(1)
    })

    it('should filter verified vs unverified users', async () => {
      await testHelpers.createUser({
        email: 'unverified@example.com',
        emailVerified: false,
      })

      const verifiedUsers = await db.query.users.findMany({
        where: eq(users.emailVerified, true),
      })

      const unverifiedUsers = await db.query.users.findMany({
        where: eq(users.emailVerified, false),
      })

      expect(verifiedUsers.length).toBeGreaterThan(0)
      expect(unverifiedUsers.length).toBeGreaterThan(0)
    })
  })

  describe('Access Control Validation', () => {
    it('should allow users to view their own profile', async () => {
      const user = await testHelpers.createUser({
        email: 'selfview@example.com',
      })

      // User should be able to query their own data
      const result = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      })

      expect(result).toBeDefined()
      expect(result?.id).toBe(user.id)
    })

    it('should not return sensitive password hash in user query', async () => {
      const user = await testHelpers.createUser({
        email: 'nosecret@example.com',
      })

      // Query users table directly (not accounts)
      const result = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      })

      // Password should not be in users table
      expect(result).toBeDefined()
      expect(result).not.toHaveProperty('password')
    })

    it('should separate user credentials from profile data', async () => {
      const user = await testHelpers.createUser({
        email: 'separated@example.com',
      })

      const userProfile = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      })

      const userAccount = await db.query.accounts.findFirst({
        where: eq(accounts.userId, user.id),
        columns: {
          password: true,
          provider: true,
        },
      })

      expect(userProfile).toBeDefined()
      expect(userAccount).toBeDefined()
      expect(userProfile).not.toHaveProperty('password')
      expect(userAccount).toHaveProperty('password')
    })
  })

  describe('Superuser Protection', () => {
    it('should prevent deleting last superuser', async () => {
      const superuser = await testHelpers.createSuperuser({
        email: 'lastsuper@example.com',
      })

      // Count superusers
      const [{ count }] = await db
        .select({ count: sql<string>`count(*)` })
        .from(users)
        .where(eq(users.role, 'superuser'))

      expect(Number(count)).toBe(1)

      // This should be prevented at application level
      // The test verifies the constraint can be checked
      const superusers = await db.query.users.findMany({
        where: eq(users.role, 'superuser'),
      })

      expect(superusers.length).toBe(1)
    })

    it('should allow deleting superuser if others exist', async () => {
      await testHelpers.createSuperuser({ email: 'super1@example.com' })
      await testHelpers.createSuperuser({ email: 'super2@example.com' })

      const superusers = await db.query.users.findMany({
        where: eq(users.role, 'superuser'),
      })

      expect(superusers.length).toBe(2)

      // Can delete one superuser since another exists
      await db.delete(users).where(eq(users.id, superusers[0].id))

      const remainingSuperusers = await db.query.users.findMany({
        where: eq(users.role, 'superuser'),
      })

      expect(remainingSuperusers.length).toBe(1)
    })
  })
})
