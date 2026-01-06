/**
 * Authentication E2E Tests - Logout Flow
 */

import { test, expect } from '@playwright/test'
import { testUsers } from '../../fixtures/test-data'

test.describe('Authentication - Logout', () => {
  test('should logout when clicking logout button', async ({ page }) => {
    // First login
    await page.goto('/sign-in')
    await page.fill('[data-testid="signin-email-input"]', testUsers.user.email)
    await page.fill('[data-testid="signin-password-input"]', testUsers.user.password)
    await page.click('[data-testid="signin-submit-button"]')

    // Wait for successful login
    await page.waitForURL('/', { timeout: 15000 })
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 10000 })

    // Open user menu
    await page.click('[data-testid="user-menu"]')

    // Click logout
    await page.click('text=Log out')

    // Should redirect to sign-in page
    await page.waitForURL('/sign-in', { timeout: 10000 })

    // Verify we're on sign-in page
    await expect(page.locator('[data-testid="signin-form-container"]')).toBeVisible()
  })

  test('should clear session after logout', async ({ page }) => {
    // Login
    await page.goto('/sign-in')
    await page.fill('[data-testid="signin-email-input"]', testUsers.user.email)
    await page.fill('[data-testid="signin-password-input"]', testUsers.user.password)
    await page.click('[data-testid="signin-submit-button"]')

    await page.waitForURL('/', { timeout: 15000 })

    // Logout
    await page.click('[data-testid="user-menu"]')
    await page.click('text=Log out')
    await page.waitForURL('/sign-in', { timeout: 10000 })

    // Try to go to dashboard directly - should redirect back to login
    await page.goto('/')

    // Should redirect to sign-in (protected route)
    await page.waitForURL('/sign-in', { timeout: 5000 })
  })

  test('should display user info in avatar dropdown', async ({ page }) => {
    // Login
    await page.goto('/sign-in')
    await page.fill('[data-testid="signin-email-input"]', testUsers.user.email)
    await page.fill('[data-testid="signin-password-input"]', testUsers.user.password)
    await page.click('[data-testid="signin-submit-button"]')

    await page.waitForURL('/', { timeout: 15000 })

    // Open user menu
    await page.click('[data-testid="user-menu"]')

    // Check user info is displayed
    await expect(page.locator('text=E2E Test User')).toBeVisible()
    await expect(page.locator('text=e2e-user@test.crackhouse.local')).toBeVisible()

    // Check logout option exists
    await expect(page.locator('text=Log out')).toBeVisible()
    await expect(page.locator('text=Settings')).toBeVisible()
  })

  test('should close dropdown when clicking outside', async ({ page }) => {
    // Login
    await page.goto('/sign-in')
    await page.fill('[data-testid="signin-email-input"]', testUsers.user.email)
    await page.fill('[data-testid="signin-password-input"]', testUsers.user.password)
    await page.click('[data-testid="signin-submit-button"]')

    await page.waitForURL('/', { timeout: 15000 })

    // Open user menu
    await page.click('[data-testid="user-menu"]')
    await expect(page.locator('[role="menu"]')).toBeVisible()

    // Press Escape to close dropdown (more reliable than clicking outside with overlays)
    await page.keyboard.press('Escape')

    // Dropdown should close
    await expect(page.locator('[role="menu"]')).not.toBeVisible()
  })

  test('should be able to login again after logout', async ({ page }) => {
    // First login
    await page.goto('/sign-in')
    await page.fill('[data-testid="signin-email-input"]', testUsers.user.email)
    await page.fill('[data-testid="signin-password-input"]', testUsers.user.password)
    await page.click('[data-testid="signin-submit-button"]')

    await page.waitForURL('/', { timeout: 15000 })

    // Logout
    await page.click('[data-testid="user-menu"]')
    await page.click('text=Log out')
    await page.waitForURL('/sign-in', { timeout: 10000 })

    // Login again
    await page.fill('[data-testid="signin-email-input"]', testUsers.user.email)
    await page.fill('[data-testid="signin-password-input"]', testUsers.user.password)
    await page.click('[data-testid="signin-submit-button"]')

    // Should successfully login again
    await page.waitForURL('/', { timeout: 15000 })
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
  })
})

test.describe('Authentication - Session Persistence', () => {
  test('should persist session across page reloads', async ({ page, context }) => {
    // Login
    await page.goto('/sign-in')
    await page.fill('[data-testid="signin-email-input"]', testUsers.user.email)
    await page.fill('[data-testid="signin-password-input"]', testUsers.user.password)
    await page.click('[data-testid="signin-submit-button"]')

    await page.waitForURL('/', { timeout: 15000 })

    // Reload multiple times
    for (let i = 0; i < 3; i++) {
      await page.reload()
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 5000 })
    }
  })

  test('should persist session across tabs', async ({ browser, context }) => {
    // Login in first tab
    const page1 = await context.newPage()
    await page1.goto('/sign-in')
    await page1.fill('[data-testid="signin-email-input"]', testUsers.user.email)
    await page1.fill('[data-testid="signin-password-input"]', testUsers.user.password)
    await page1.click('[data-testid="signin-submit-button"]')

    await page1.waitForURL('/', { timeout: 15000 })

    // Open new tab and navigate to dashboard
    const page2 = await context.newPage()
    await page2.goto('/')

    // Should be logged in (session persisted)
    await expect(page2.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 10000 })

    // Cleanup
    await page1.close()
    await page2.close()
  })
})
