/**
 * Authentication setup for E2E tests
 * This file creates authenticated browser state files for faster tests
 */

import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
import path from 'path'
import { testUsers } from './fixtures/test-users'

// Define our custom test fixtures
export const expect = base.expect
export const test = base.extend<{
  authenticatedPage: any
  adminPage: any
  superuserPage: any
}>({
  // Regular authenticated user page
  authenticatedPage: async ({ page }: { page: Page }, use: any) => {
    await loginAsUser(page, 'user')
    await use(page)
  },

  // Admin user page
  adminPage: async ({ page }: { page: Page }, use: any) => {
    await loginAsUser(page, 'admin')
    await use(page)
  },

  // Superuser page
  superuserPage: async ({ page }: { page: Page }, use: any) => {
    await loginAsUser(page, 'superuser')
    await use(page)
  },
})

/**
 * Login as a specific user type and save session state
 */
async function loginAsUser(page: Page, userType: keyof typeof testUsers) {
  const user = testUsers[userType]

  // Navigate to sign in
  await page.goto('/sign-in')

  // Fill and submit login form
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')

  // Wait for successful login - redirect to dashboard
  await page.waitForURL('/', { timeout: 15000 })

  // Wait for dashboard to be visible (don't use networkidle - WebSocket/polling keeps it busy)
  await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 })
}

/**
 * Setup authenticated context for a user type
 * This is run once per user type before dependent tests
 */
async function setupAuthenticatedContext(userType: keyof typeof testUsers) {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await loginAsUser(page, userType)

  // Save the authenticated state
  const authDir = path.join(process.cwd(), 'playwright', '.auth')
  await page.context().storageState({ path: `${authDir}/${userType}.json` })

  await browser.close()
}

// Run setup when this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  async function runSetup() {
    console.log('🔐 Setting up authenticated browser states...')

    const userTypes: (keyof typeof testUsers)[] = ['user', 'admin', 'superuser']

    for (const userType of userTypes) {
      try {
        await setupAuthenticatedContext(userType)
        console.log(`✅ Created auth state for ${userType}`)
      } catch (error) {
        console.log(`❌ Failed to create auth state for ${userType}:`, error)
      }
    }

    console.log('✅ Auth setup complete!')
    process.exit(0)
  }

  runSetup().catch((error) => {
    console.error('Auth setup failed:', error)
    process.exit(1)
  })
}

export default test
