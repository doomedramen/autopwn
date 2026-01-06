/**
 * Test user credentials for E2E testing
 * These users should be created during test setup
 */

export const testUsers = {
  admin: {
    email: 'e2e-admin@test.crackhouse.local',
    password: 'Admin123!',
    name: 'E2E Admin User',
    role: 'admin' as const,
  },
  user: {
    email: 'e2e-user@test.crackhouse.local',
    password: 'User123!',
    name: 'E2E Test User',
    role: 'user' as const,
  },
  superuser: {
    email: 'e2e-super@test.crackhouse.local',
    password: 'Super123!',
    name: 'E2E Super User',
    role: 'superuser' as const,
  },
} as const

export type TestUserType = keyof typeof testUsers
export type TestUser = (typeof testUsers)[TestUserType]

/**
 * API base URL for testing
 */
export const API_URL = process.env.API_URL || 'http://localhost:3001/api'

/**
 * Helper to create a user via the API
 */
export async function createTestUser(
  user: TestUser,
  apiUrl: string = API_URL,
): Promise<{ id: string; email: string; name: string; role: string }> {
  // Better Auth uses /auth/sign-up/email endpoint
  const response = await fetch(`${apiUrl}/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      name: user.name,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create test user: ${error}`)
  }

  return await response.json()
}

/**
 * Helper to delete a user via the API
 * Note: This requires admin authentication
 */
export async function deleteTestUser(
  userId: string,
  adminToken: string,
  apiUrl: string = API_URL,
): Promise<void> {
  await fetch(`${apiUrl}/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
  })
}

/**
 * Helper to login and get session token
 */
export async function loginUser(
  user: TestUser,
  apiUrl: string = API_URL,
): Promise<{ token: string; session: any }> {
  // Better Auth uses /auth/sign-in/email endpoint
  const response = await fetch(`${apiUrl}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to login: ${error}`)
  }

  return await response.json()
}
