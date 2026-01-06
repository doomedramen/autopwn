/**
 * Global E2E test setup
 * Runs once before all tests to:
 * 1. Wait for API server to be healthy
 * 2. Create test users via Better Auth API (handles password hashing)
 * 3. Update user roles directly in database (for admin/superuser)
 * 4. Set up any required test data
 *
 * Note: Both API and web servers are started by playwright.config.ts webServer
 */

import { FullConfig } from '@playwright/test'
import postgres from 'postgres'
import { testUsers } from './fixtures/test-users'

const TEST_DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/autopwn_test'
const API_URL = process.env.API_URL || 'http://localhost:3001/api'

/**
 * Wait for the API server to be fully healthy
 */
async function waitForAPI(maxAttempts = 30, delayMs = 1000): Promise<void> {
  const healthUrl = 'http://localhost:3001/health'

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(healthUrl)
      if (response.ok) {
        const data = await response.json()
        if (data.status === 'ok' || data.healthy === true) {
          console.log('✅ API server is healthy')
          return
        }
      }
    } catch {
      // Server not ready yet, continue waiting
    }

    if (i < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw new Error(`API server not healthy after ${maxAttempts * delayMs / 1000} seconds`)
}

/**
 * Check if a user exists by email
 */
async function userExists(sql: postgres.Sql<{}>, email: string): Promise<boolean> {
  const result = await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${email} LIMIT 1`
  return result.length > 0
}

/**
 * Get a user's ID by email
 */
async function getUserId(sql: postgres.Sql<{}>, email: string): Promise<string | null> {
  const result = await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${email} LIMIT 1`
  return result[0]?.id || null
}

/**
 * Update a user's role in the database
 */
async function updateUserRole(sql: postgres.Sql<{}>, email: string, role: string): Promise<void> {
  await sql`UPDATE users SET role = ${role} WHERE email = ${email}`
}

/**
 * Create a user via Better Auth API
 * This uses Better Auth's signup endpoint which handles password hashing correctly
 */
async function createUserViaAPI(
  user: { email: string; password: string; name: string },
): Promise<{ id: string } | null> {
  const response = await fetch(`${API_URL}/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      name: user.name,
    }),
  })

  if (response.ok) {
    const data = await response.json()
    return data.user
  }

  // User might already exist
  if (response.status === 409 || response.status === 422) {
    return null
  }

  throw new Error(`Failed to create user ${user.email}: ${response.statusText}`)
}

async function createTestUsers() {
  const sql = postgres(TEST_DATABASE_URL, { max: 1 })

  try {
    // Create admin user
    const adminExists = await userExists(sql, testUsers.admin.email)
    if (!adminExists) {
      await createUserViaAPI(testUsers.admin)
      console.log(`✅ Created admin user: ${testUsers.admin.email}`)
    } else {
      console.log(`ℹ️  Admin user already exists: ${testUsers.admin.email}`)
    }

    // Ensure admin role is set
    await updateUserRole(sql, testUsers.admin.email, 'admin')

    // Create regular user
    const regularUserExists = await userExists(sql, testUsers.user.email)
    if (!regularUserExists) {
      await createUserViaAPI(testUsers.user)
      console.log(`✅ Created regular user: ${testUsers.user.email}`)
    } else {
      console.log(`ℹ️  Regular user already exists: ${testUsers.user.email}`)
    }

    // Ensure user role is set
    await updateUserRole(sql, testUsers.user.email, 'user')

    // Create superuser
    const superUserExists = await userExists(sql, testUsers.superuser.email)
    if (!superUserExists) {
      await createUserViaAPI(testUsers.superuser)
      console.log(`✅ Created superuser: ${testUsers.superuser.email}`)
    } else {
      console.log(`ℹ️  Superuser already exists: ${testUsers.superuser.email}`)
    }

    // Ensure superuser role is set
    await updateUserRole(sql, testUsers.superuser.email, 'superuser')

    // Delete all sessions for test users to force fresh logins during tests
    await sql`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%@test.crackhouse.local')`
    console.log('✅ Cleared test user sessions')
  } finally {
    await sql.end()
  }
}

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test global setup...')

  // Wait for API to be fully healthy
  await waitForAPI()

  // Create test users via Better Auth API, then update roles
  await createTestUsers()
  console.log('✅ Test users created')

  console.log('✅ Global setup complete!')
}

export default globalSetup
