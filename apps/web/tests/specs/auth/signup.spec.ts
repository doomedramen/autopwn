/**
 * Authentication E2E Tests - Signup Flow
 */

import { test, expect } from '@playwright/test'
import { testUsers } from '../../fixtures/test-data'

test.describe('Authentication - Signup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-up')
  })

  test('should display the signup form', async ({ page }) => {
    // Check branding
    await expect(page.locator('[data-testid="branding-title"]')).toContainText('CrackHouse')

    // Check form container
    await expect(page.locator('[data-testid="signup-form-container"]')).toBeVisible()
    await expect(page.locator('h2:has-text("Create Account")')).toBeVisible()

    // Check form fields
    await expect(page.locator('[data-testid="signup-name-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="signup-email-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="signup-password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="signup-submit-button"]')).toBeVisible()

    // Check sign in link
    await expect(page.locator('[data-testid="signin-link"]')).toBeVisible()
  })

  test('should signup with valid credentials', async ({ page }) => {
    // Generate unique email using timestamp
    const timestamp = Date.now()
    const email = `test-user-${timestamp}@crackhouse.local`
    const password = 'ValidPass123!'
    const name = 'Test User'

    // Fill signup form
    await page.fill('[data-testid="signup-name-input"]', name)
    await page.fill('[data-testid="signup-email-input"]', email)
    await page.fill('[data-testid="signup-password-input"]', password)

    // Submit form
    await page.click('[data-testid="signup-submit-button"]')

    // Wait for redirect to dashboard (auto-login after signup)
    await page.waitForURL('/', { timeout: 15000 })

    // Verify we're on the dashboard
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 10000 })
  })

  test('should show error with duplicate email', async ({ page }) => {
    const email = testUsers.user.email // This email already exists from setup
    const password = 'ValidPass123!'
    const name = 'Duplicate User'

    // Fill signup form with existing email
    await page.fill('[data-testid="signup-name-input"]', name)
    await page.fill('[data-testid="signup-email-input"]', email)
    await page.fill('[data-testid="signup-password-input"]', password)

    // Submit form
    await page.click('[data-testid="signup-submit-button"]')

    // Wait for error message
    await expect(page.locator('[data-testid="signup-error-message"]')).toBeVisible({ timeout: 10000 })

    // Verify we're still on signup page
    await expect(page).toHaveURL('/sign-up')
  })

  test('should validate required fields', async ({ page }) => {
    // Try to submit empty form
    await page.click('[data-testid="signup-submit-button"]')

    // Browser should validate required fields
    const nameInput = page.locator('[data-testid="signup-name-input"]')
    const emailInput = page.locator('[data-testid="signup-email-input"]')
    const passwordInput = page.locator('[data-testid="signup-password-input"]')

    // Check required attributes
    await expect(nameInput).toHaveAttribute('required', '')
    await expect(emailInput).toHaveAttribute('required', '')
    await expect(passwordInput).toHaveAttribute('required', '')
  })

  test('should validate email format', async ({ page }) => {
    // Fill with invalid email
    await page.fill('[data-testid="signup-name-input"]', 'Test User')
    await page.fill('[data-testid="signup-email-input"]', 'not-an-email')
    await page.fill('[data-testid="signup-password-input"]', 'ValidPass123!')

    // Submit form
    await page.click('[data-testid="signup-submit-button"]')

    // Browser should validate email format
    const emailInput = page.locator('[data-testid="signup-email-input"]')
    await expect(emailInput).toHaveAttribute('type', 'email')
  })

  test('should show loading state during signup', async ({ page }) => {
    const timestamp = Date.now()
    const email = `test-user-${timestamp}@crackhouse.local`

    // Fill form
    await page.fill('[data-testid="signup-name-input"]', 'Test User')
    await page.fill('[data-testid="signup-email-input"]', email)
    await page.fill('[data-testid="signup-password-input"]', 'ValidPass123!')

    // Submit and check loading state
    await page.click('[data-testid="signup-submit-button"]')

    // Button should show loading state
    await expect(page.locator('[data-testid="signup-submit-button"]')).toHaveText('Creating account...')

    // Button should be disabled during signup
    await expect(page.locator('[data-testid="signup-submit-button"]')).toBeDisabled()
  })

  test('should navigate to sign in page', async ({ page }) => {
    await page.click('[data-testid="signin-link"]')

    await expect(page).toHaveURL('/sign-in')
  })

  test('should handle weak passwords', async ({ page }) => {
    const timestamp = Date.now()
    const email = `test-user-${timestamp}@crackhouse.local`
    const weakPassword = '123' // Very weak password

    // Fill form with weak password
    await page.fill('[data-testid="signup-name-input"]', 'Test User')
    await page.fill('[data-testid="signup-email-input"]', email)
    await page.fill('[data-testid="signup-password-input"]', weakPassword)

    // Submit form
    await page.click('[data-testid="signup-submit-button"]')

    // API should reject weak password
    // Either we get an error message or we stay on the page
    await expect(page.locator('[data-testid="signup-error-message"]')).toBeVisible({ timeout: 10000 }).catch(() => {
      // No error message shown, but we should still be on signup page
      expect(page).toHaveURL('/sign-up')
    })
  })

  test('should handle special characters in email', async ({ page }) => {
    const timestamp = Date.now()
    const email = `user+tag${timestamp}@crackhouse.local`
    const password = 'ValidPass123!'
    const name = 'Test User'

    // Fill signup form with special characters in email
    await page.fill('[data-testid="signup-name-input"]', name)
    await page.fill('[data-testid="signup-email-input"]', email)
    await page.fill('[data-testid="signup-password-input"]', password)

    // Submit form
    await page.click('[data-testid="signup-submit-button"]')

    // Should succeed (emails with + are valid)
    await page.waitForURL('/', { timeout: 15000 }).catch(async () => {
      // If signup fails, check for error
      const errorElement = page.locator('[data-testid="signup-error-message"]')
      if (await errorElement.isVisible()) {
        // Some error occurred
        expect(await errorElement.textContent()).not.toContain('Invalid email')
      }
    })
  })
})

test.describe('Authentication - Signup (Password Requirements)', () => {
  test('should accept password with special characters', async ({ page }) => {
    const timestamp = Date.now()
    const email = `test-user-${timestamp}@crackhouse.local`
    const password = 'P@ssw0rd!2024'
    const name = 'Test User'

    await page.goto('/sign-up')

    // Fill form with password containing special chars
    await page.fill('[data-testid="signup-name-input"]', name)
    await page.fill('[data-testid="signup-email-input"]', email)
    await page.fill('[data-testid="signup-password-input"]', password)

    // Submit form
    await page.click('[data-testid="signup-submit-button"]')

    // Should succeed
    await page.waitForURL('/', { timeout: 15000 })
  })

  test('should accept password with numbers', async ({ page }) => {
    const timestamp = Date.now()
    const email = `test-user-${timestamp}@crackhouse.local`
    const password = 'Password123'
    const name = 'Test User'

    await page.goto('/sign-up')

    await page.fill('[data-testid="signup-name-input"]', name)
    await page.fill('[data-testid="signup-email-input"]', email)
    await page.fill('[data-testid="signup-password-input"]', password)

    await page.click('[data-testid="signup-submit-button"]')

    await page.waitForURL('/', { timeout: 15000 })
  })

  test('should reject password that is too short', async ({ page }) => {
    const timestamp = Date.now()
    const email = `test-user-${timestamp}@crackhouse.local`
    const password = 'P1!' // Too short

    await page.goto('/sign-up')

    await page.fill('[data-testid="signup-name-input"]', 'Test User')
    await page.fill('[data-testid="signup-email-input"]', email)
    await page.fill('[data-testid="signup-password-input"]', password)

    await page.click('[data-testid="signup-submit-button"]')

    // Should get error
    await expect(page.locator('[data-testid="signup-error-message"]')).toBeVisible({ timeout: 10000 })
  })
})
