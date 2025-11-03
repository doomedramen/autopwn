import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { app } from '@/index'
import { setupTestDB, cleanupTestDB, createTestUser, getAuthHeaders } from '../helpers/test-helpers'
import { db } from '@/db'
import { users, accounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

describe('User CRUD API', () => {
  let superuserAuth: Record<string, string>
  let adminAuth: Record<string, string>
  let userAuth: Record<string, string>
  let superUser: any
  let adminUser: any
  let regularUser: any

  beforeAll(async () => {
    await setupTestDB()

    // Create test users with different roles
    superUser = await createTestUser({ role: 'superuser' })
    adminUser = await createTestUser({ role: 'admin' })
    regularUser = await createTestUser({ role: 'user' })

    superuserAuth = await getAuthHeaders(superUser.email, 'password123')
    adminAuth = await getAuthHeaders(adminUser.email, 'password123')
    userAuth = await getAuthHeaders(regularUser.email, 'password123')
  })

  afterAll(async () => {
    await cleanupTestDB()
  })

  describe('POST /api/users', () => {
    test('should create user as admin', async () => {
      const userData = {
        email: 'newuser@test.com',
        name: 'New User',
        password: 'newpassword123',
        role: 'user'
      }

      const response = await app.request('/api/users', {
        method: 'POST',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.message).toBe('User created successfully')
      expect(data.data).toMatchObject({
        email: 'newuser@test.com',
        name: 'New User',
        role: 'user',
        emailVerified: true
      })
      expect(data.data.id).toBeDefined()
      expect(data.data.createdAt).toBeDefined()

      // Verify user exists in database
      const createdUser = await db.query.users.findFirst({
        where: eq(users.email, 'newuser@test.com')
      })
      expect(createdUser).toBeTruthy()
      expect(createdUser!.name).toBe('New User')
      expect(createdUser!.role).toBe('user')

      // Verify account record exists
      const accountRecord = await db.query.accounts.findFirst({
        where: eq(accounts.userId, createdUser!.id)
      })
      expect(accountRecord).toBeTruthy()
      expect(accountRecord!.provider).toBe('credential')
    })

    test('should create admin user as superuser', async () => {
      const userData = {
        email: 'newadmin@test.com',
        name: 'New Admin',
        password: 'adminpass123',
        role: 'admin'
      }

      const response = await app.request('/api/users', {
        method: 'POST',
        headers: {
          ...superuserAuth,
          'Authorization': superuserAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.role).toBe('admin')
    })

    test('should create superuser user as superuser', async () => {
      const userData = {
        email: 'newsuper@test.com',
        name: 'New Superuser',
        password: 'superpass123',
        role: 'superuser'
      }

      const response = await app.request('/api/users', {
        method: 'POST',
        headers: {
          ...superuserAuth,
          'Authorization': superuserAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.role).toBe('superuser')
    })

    test('should prevent admin from creating superuser', async () => {
      const userData = {
        email: 'forbidden@test.com',
        name: 'Forbidden',
        password: 'forbidden123',
        role: 'superuser'
      }

      const response = await app.request('/api/users', {
        method: 'POST',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      expect(response.status).toBe(403)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Only superusers can create superuser accounts')
    })

    test('should prevent regular user from creating users', async () => {
      const userData = {
        email: 'forbidden2@test.com',
        name: 'Forbidden 2',
        password: 'forbidden123',
        role: 'user'
      }

      const response = await app.request('/api/users', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      expect(response.status).toBe(403) // Should be caught by requireAdmin middleware
    })

    test('should reject duplicate email addresses', async () => {
      const userData = {
        email: regularUser.email, // Duplicate
        name: 'Duplicate User',
        password: 'password123',
        role: 'user'
      }

      const response = await app.request('/api/users', {
        method: 'POST',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      expect(response.status).toBe(409)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('User with this email already exists')
    })

    test('should validate email format', async () => {
      const userData = {
        email: 'invalid-email',
        name: 'Invalid Email',
        password: 'password123',
        role: 'user'
      }

      const response = await app.request('/api/users', {
        method: 'POST',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      expect(response.status).toBe(400)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toContain('email')
    })

    test('should validate password length', async () => {
      const userData = {
        email: 'weak@test.com',
        name: 'Weak Password',
        password: '123', // Too short
        role: 'user'
      }

      const response = await app.request('/api/users', {
        method: 'POST',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      expect(response.status).toBe(400)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toContain('Password must be at least 8 characters')
    })

    test('should auto-generate name from email if not provided', async () => {
      const userData = {
        email: 'noname@test.com',
        password: 'password123',
        role: 'user'
      }

      const response = await app.request('/api/users', {
        method: 'POST',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.name).toBe('noname')
    })
  })

  describe('PATCH /api/users/:id', () => {
    let testUser: any

    beforeEach(async () => {
      // Create a test user for updates
      testUser = await createTestUser({
        email: 'updateme@test.com',
        name: 'Update Me',
        role: 'user'
      })
    })

    test('should allow user to update own name', async () => {
      const updates = {
        name: 'Updated Name'
      }

      const response = await app.request(`/api/users/${testUser.id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(testUser.email, 'password123'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Updated Name')
      expect(data.data.email).toBe(testUser.email) // Unchanged
    })

    test('should prevent user from updating own role', async () => {
      const updates = {
        role: 'admin'
      }

      const response = await app.request(`/api/users/${testUser.id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(testUser.email, 'password123'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      expect(response.status).toBe(403)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Only administrators can change user roles')
    })

    test('should allow admin to update any field', async () => {
      const updates = {
        name: 'Admin Updated',
        role: 'admin',
        emailVerified: false
      }

      const response = await app.request(`/api/users/${testUser.id}`, {
        method: 'PATCH',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Admin Updated')
      expect(data.data.role).toBe('admin')
      expect(data.data.emailVerified).toBe(false)
    })

    test('should prevent admin from changing to/from superuser role', async () => {
      // Try to promote user to superuser
      const updates = {
        role: 'superuser'
      }

      const response = await app.request(`/api/users/${testUser.id}`, {
        method: 'PATCH',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      expect(response.status).toBe(403)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Only superusers can modify superuser accounts')
    })

    test('should allow superuser to modify any role', async () => {
      const updates = {
        name: 'Super Updated',
        role: 'superuser',
        emailVerified: true
      }

      const response = await app.request(`/api/users/${testUser.id}`, {
        method: 'PATCH',
        headers: {
          ...superuserAuth,
          'Authorization': superuserAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Super Updated')
      expect(data.data.role).toBe('superuser')
    })

    test('should prevent user from updating others data', async () => {
      const anotherUser = await createTestUser({ email: 'another@test.com' })
      const updates = {
        name: 'Hacked Name'
      }

      const response = await app.request(`/api/users/${anotherUser.id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(testUser.email, 'password123'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      expect(response.status).toBe(403)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Access denied')
    })

    test('should return 404 for non-existent user', async () => {
      const fakeUserId = crypto.randomUUID()
      const updates = {
        name: 'Should Not Work'
      }

      const response = await app.request(`/api/users/${fakeUserId}`, {
        method: 'PATCH',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      expect(response.status).toBe(404)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('User not found')
    })

    test('should validate email format when updating', async () => {
      const updates = {
        email: 'invalid-email-format'
      }

      const response = await app.request(`/api/users/${testUser.id}`, {
        method: 'PATCH',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      expect(response.status).toBe(400)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toContain('email')
    })
  })

  describe('DELETE /api/users/:id', () => {
    let testUser: any
    let testAdminUser: any
    let testSuperUser: any

    beforeEach(async () => {
      // Create test users for deletion
      testUser = await createTestUser({ email: 'deleteme@test.com', role: 'user' })
      testAdminUser = await createTestUser({ email: 'deletemeadmin@test.com', role: 'admin' })
      testSuperUser = await createTestUser({ email: 'deletemesuper@test.com', role: 'superuser' })
    })

    test('should delete regular user as superuser', async () => {
      const response = await app.request(`/api/users/${testUser.id}`, {
        method: 'DELETE',
        headers: {
          ...superuserAuth,
          'Authorization': superuserAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.message).toBe('User deleted successfully')

      // Verify user is deleted from database
      const deletedUser = await db.query.users.findFirst({
        where: eq(users.id, testUser.id)
      })
      expect(deletedUser).toBeNull()
    })

    test('should delete admin user as superuser', async () => {
      const response = await app.request(`/api/users/${testAdminUser.id}`, {
        method: 'DELETE',
        headers: {
          ...superuserAuth,
          'Authorization': superuserAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
    })

    test('should prevent deleting last superuser', async () => {
      // Create a second superuser first
      const secondSuperUser = await createTestUser({ email: 'secondsuper@test.com', role: 'superuser' })

      // Now try to delete the original superuser (there are now 2 superusers)
      const response = await app.request(`/api/users/${superUser.id}`, {
        method: 'DELETE',
        headers: {
          ...superuserAuth,
          'Authorization': superuserAuth.authorization
        }
      })

      expect(response.status).toBe(400)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Cannot delete the last superuser account')
    })

    test('should prevent admin from deleting users', async () => {
      const response = await app.request(`/api/users/${testUser.id}`, {
        method: 'DELETE',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization
        }
      })

      expect(response.status).toBe(403) // requireSuperuser middleware
    })

    test('should prevent user from deleting themselves', async () => {
      const response = await app.request(`/api/users/${testUser.id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(testUser.email, 'password123')
        }
      })

      expect(response.status).toBe(400)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('You cannot delete your own account')
    })

    test('should return 404 for non-existent user', async () => {
      const fakeUserId = crypto.randomUUID()

      const response = await app.request(`/api/users/${fakeUserId}`, {
        method: 'DELETE',
        headers: {
          ...superuserAuth,
          'Authorization': superuserAuth.authorization
        }
      })

      expect(response.status).toBe(404)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('User not found')
    })
  })

  describe('GET /api/users/:id', () => {
    test('should allow user to view own profile', async () => {
      const response = await app.request(`/api/users/${regularUser.id}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.id).toBe(regularUser.id)
      expect(data.data.email).toBe(regularUser.email)
      expect(data.data.role).toBe(regularUser.role)
      // Should not include sensitive fields
      expect(data.data.password).toBeUndefined()
    })

    test('should allow admin to view any user profile', async () => {
      const response = await app.request(`/api/users/${regularUser.id}`, {
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.id).toBe(regularUser.id)
    })

    test('should prevent user from viewing others profiles', async () => {
      const anotherUser = await createTestUser({ email: 'private@test.com' })

      const response = await app.request(`/api/users/${anotherUser.id}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(403)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Access denied')
    })

    test('should return 404 for non-existent user', async () => {
      const fakeUserId = crypto.randomUUID()

      const response = await app.request(`/api/users/${fakeUserId}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(404)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('User not found')
    })
  })

  describe('Role-based Access Control', () => {
    test('should properly enforce superuser role hierarchy', async () => {
      // Create user with each role
      const [testRegular] = await createTestUser({ email: 'regular@test.com', role: 'user' })
      const [testAdmin] = await createTestUser({ email: 'admin2@test.com', role: 'admin' })
      const [testSuper] = await createTestUser({ email: 'super2@test.com', role: 'superuser' })

      // Regular user should not be able to access admin endpoints
      const regularAccess = await app.request('/api/users', {
        method: 'GET',
        headers: getAuthHeaders(testRegular.email, 'password123')
      })
      expect([403, 401]).toContain(regularAccess.status)

      // Admin should be able to access admin endpoints
      const adminAccess = await app.request('/api/users', {
        method: 'GET',
        headers: getAuthHeaders(testAdmin.email, 'password123')
      })
      expect(adminAccess.status).toBe(200)

      // Superuser should be able to access admin endpoints
      const superAccess = await app.request('/api/users', {
        method: 'GET',
        headers: getAuthHeaders(testSuper.email, 'password123')
      })
      expect(superAccess.status).toBe(200)
    })
  })
})