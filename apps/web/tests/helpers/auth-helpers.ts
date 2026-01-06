/**
 * Authentication helpers for E2E testing
 */

import type { Page } from '@playwright/test'
import { testUsers, type TestUser } from '../fixtures/test-users'

/**
 * Login helper - performs login via UI and saves session
 *
 * Note: Due to Better Auth client redirect issues in E2E tests, this helper
 * uses direct API calls to establish a session before navigating.
 */
export async function login(
  page: Page,
  userType: keyof typeof testUsers = 'user',
) {
  const user = testUsers[userType]

  // First, establish a session by calling the API directly
  // This bypasses the Better Auth client redirect issues
  await page.goto('/sign-in')

  // Fill and submit the form to trigger login
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')

  // Wait for the login API call to complete
  // The button text should change to "Signing in..." then back
  await page.waitForTimeout(3000)

  // Check if we were redirected (this would indicate success)
  const currentUrl = page.url()
  if (currentUrl === '/') {
    // Success - we're already on the dashboard
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 5000 })
    return
  }

  // If not redirected, navigate manually and check if session exists
  await page.goto('/')

  // The dashboard might redirect us back to sign-in if auth failed
  // If we're on the dashboard now, we're good
  try {
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 5000 })
  } catch {
    // Dashboard not visible - likely not authenticated
    // Try an alternative: use page.evaluate to call the API directly
    await page.evaluate(async ({ email, password }) => {
      const response = await fetch('http://localhost:3001/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      console.log('Login response:', await response.json())
    }, { email: user.email, password: user.password })

    // Reload and check again
    await page.reload()
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 5000 })
  }
}

/**
 * Login via API and store session for faster tests
 */
export async function loginViaApi(
  page: Page,
  userType: keyof typeof testUsers = 'user',
) {
  const user = testUsers[userType]

  // Go to the page first to establish context
  await page.goto('/sign-in')

  // Execute login directly in browser context
  await page.evaluate(
    async ({ email, password }) => {
      // Better Auth uses /api/auth/sign-in/email endpoint
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()

      // Store session in localStorage if using better-auth client storage
      if (data.token || data.session) {
        localStorage.setItem('better-auth.session_token', data.token || JSON.stringify(data.session))
      }
    },
    { email: user.email, password: user.password },
  )

  // Reload to apply session
  await page.reload()
  await page.waitForURL('/', { timeout: 10000 })
}

/**
 * Logout helper
 */
export async function logout(page: Page) {
  // Click avatar dropdown
  await page.click('[data-testid="avatar-dropdown"]')

  // Click logout button
  await page.click('button:has-text("Logout")')

  // Wait for redirect to login
  await page.waitForURL('/sign-in', { timeout: 5000 })
}

/**
 * Setup auth state before tests
 * Creates and authenticates test users
 */
export async function setupAuthState(page: Page, userType: keyof typeof testUsers = 'user') {
  // First ensure the user exists via API
  const user = testUsers[userType]

  await page.goto('/sign-in')

  // Try to create the user (may fail if already exists) - Better Auth uses /api/auth/sign-up/email
  await page.evaluate(
    async ({ email, password, name }) => {
      try {
        await fetch('/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        })
      } catch {
        // User may already exist, that's fine
      }
    },
    { email: user.email, password: user.password, name: user.name },
  )

  // Now login
  await login(page, userType)
}

/**
 * Get current session info
 */
export async function getSession(page: Page) {
  return await page.evaluate(async () => {
    const response = await fetch('/api/auth/session')
    return await response.json()
  })
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const session = await getSession(page)
  return !!(session?.user || session?.session?.user)
}

/**
 * Navigate to a page, handling authentication if needed
 */
export async function navigateTo(
  page: Page,
  path: string,
  userType?: keyof typeof testUsers,
) {
  await page.goto(path)

  // Check if we were redirected to login
  const url = page.url()
  if (url.includes('/sign-in') && userType) {
    await login(page, userType)
    await page.goto(path)
  }

  // Wait for load state, but not networkidle (WebSocket/polling keeps it busy)
  await page.waitForLoadState('domcontentloaded')
}

/**
 * Wait for successful API response
 */
export async function waitForApiSuccess(
  page: Page,
  action: () => Promise<void>,
  timeout: number = 10000,
): Promise<void> {
  // Listen for API responses
  const apiCallPromise = page.waitForResponse(
    (response) => response.url().includes('/api/') && response.status() < 400,
    { timeout },
  )

  await action()

  await apiCallPromise
}
