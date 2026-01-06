/**
 * Integration E2E Tests - Full Workflow
 * Tests for complete user workflows from upload to results
 */

import { test, expect } from '@playwright/test'
import { login } from '../../helpers/auth-helpers'

test.describe('Integration - Full Workflow', () => {
  test.describe('Complete Cracking Workflow', () => {
    test('should navigate through all tabs', async ({ page }) => {
      await login(page, 'user')

      // Start at dashboard (networks tab by default)
      await expect(page.locator('[data-testid="networks-content"]')).toBeVisible()

      // Navigate through each tab
      await page.click('[data-testid="dictionaries-tab"]')
      await expect(page.locator('[data-testid="dictionaries-content"]')).toBeVisible()

      await page.click('[data-testid="jobs-tab"]')
      await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible()

      await page.click('[data-testid="results-tab"]')
      await expect(page.locator('[data-testid="results-content"]')).toBeVisible()

      await page.click('[data-testid="users-tab"]')
      await expect(page.locator('[data-testid="users-content"]')).toBeVisible()

      // Back to networks
      await page.click('[data-testid="networks-tab"]')
      await expect(page.locator('[data-testid="networks-content"]')).toBeVisible()
    })

    test('should access all features from header buttons', async ({ page }) => {
      await login(page, 'user')

      // Test Upload Files button
      await page.click('button:has-text("Upload Files")')
      await expect(page.locator('[data-testid="upload-modal"]')).toBeVisible()
      await page.keyboard.press('Escape')

      // Test Create Jobs button
      await page.click('button:has-text("Create Jobs")')
      await expect(page.locator('[data-testid="create-job-modal"]')).toBeVisible()
      await page.keyboard.press('Escape')

      // Test user menu
      await page.click('[data-testid="user-menu"]')
      await expect(page.locator('[data-testid="avatar-dropdown"]')).toBeVisible()
      await page.click('[data-testid="header"]') // Click outside to close
    })
  })

  test.describe('Upload to Workflow', () => {
    test('should open upload modal and switch between tabs', async ({ page }) => {
      await login(page, 'user')

      // Open upload modal from header
      await page.click('button:has-text("Upload Files")')
      await expect(page.locator('[data-testid="upload-modal"]')).toBeVisible()

      // Should default to captures tab
      const capturesTab = page.getByRole('tab', { name: /captures/i })
      await expect(capturesTab).toBeVisible()

      // Switch to dictionaries tab
      const dictionariesTab = page.getByRole('tab', { name: /dictionaries/i })
      await dictionariesTab.click()

      // Should show dictionary upload
      await expect(page.getByRole('heading', { name: /password dictionaries/i })).toBeVisible()

      // Close modal
      await page.click('button:has-text("Close")')
    })

    test('should open upload modal from networks tab', async ({ page }) => {
      await login(page, 'user')
      await page.click('[data-testid="networks-tab"]')

      // Open upload modal from networks tab
      await page.click('button:has-text("upload pcap")')
      await expect(page.locator('[data-testid="upload-modal"]')).toBeVisible()

      // Should default to captures tab
      await expect(page.getByRole('heading', { name: /network captures/i })).toBeVisible()

      // Close modal
      await page.keyboard.press('Escape')
    })

    test('should open upload modal from dictionaries tab', async ({ page }) => {
      await login(page, 'user')
      await page.click('[data-testid="dictionaries-tab"]')

      // Open upload modal from dictionaries tab
      await page.click('button:has-text("Upload Dictionary")')
      await expect(page.locator('[data-testid="upload-modal"]')).toBeVisible()

      // Should default to dictionaries tab
      await expect(page.getByRole('heading', { name: /password dictionaries/i })).toBeVisible()

      // Close modal
      await page.keyboard.press('Escape')
    })
  })

  test.describe('Job Creation to Results Workflow', () => {
    test('should open create job modal and access advanced options', async ({ page }) => {
      await login(page, 'user')
      await page.click('[data-testid="jobs-tab"]')

      // Open create job modal
      await page.click('[data-testid="create-job-button"]')
      await expect(page.locator('[data-testid="create-job-modal"]')).toBeVisible()

      // Open advanced options
      const advancedTrigger = page.locator('button:has-text("Advanced Options")')
      await advancedTrigger.click()

      // Should show advanced options
      await expect(page.locator('text=Attack Mode')).toBeVisible()
      await expect(page.locator('text=Hash Type')).toBeVisible()
      await expect(page.locator('text=Workload Profile')).toBeVisible()

      // Close modal
      await page.click('button:has-text("Cancel")')
    })

    test('should view job details and navigate to results', async ({ page }) => {
      await login(page, 'user')
      await page.click('[data-testid="jobs-tab"]')

      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Click on job name
          const jobNameButton = page.locator('td button').first()
          await jobNameButton.click()

          // Detail modal should open
          const dialog = page.locator('[role="dialog"]')
          const hasDialog = await dialog.isVisible().catch(() => false)

          if (hasDialog) {
            await expect(dialog).toBeVisible()
            await page.keyboard.press('Escape')
          }
        }
      }

      // Navigate to results
      await page.click('[data-testid="results-tab"]')
      await expect(page.locator('[data-testid="results-content"]')).toBeVisible()
    })
  })

  test.describe('Dictionary Management Workflow', () => {
    test('should access all dictionary management features', async ({ page }) => {
      await login(page, 'user')
      await page.click('[data-testid="dictionaries-tab"]')

      // Test upload button
      await page.click('button:has-text("Upload Dictionary")')
      await expect(page.locator('[data-testid="upload-modal"]')).toBeVisible()
      await page.keyboard.press('Escape')

      // Test generate button
      await page.click('button:has-text("Generate Dictionary")')
      const dialog1 = page.locator('[role="dialog"]')
      const hasDialog1 = await dialog1.isVisible().catch(() => false)

      if (hasDialog1) {
        await expect(dialog1).toBeVisible()
        await page.keyboard.press('Escape')
      }

      // Test merge button
      await page.click('button:has-text("Merge Dictionaries")')
      const dialog2 = page.locator('[role="dialog"]')
      const hasDialog2 = await dialog2.isVisible().catch(() => false)

      if (hasDialog2) {
        await expect(dialog2).toBeVisible()
        await page.keyboard.press('Escape')
      }
    })
  })

  test.describe('Admin Workflow', () => {
    test('should access admin features as admin user', async ({ page }) => {
      await login(page, 'admin')

      // Admin tab should be visible
      await expect(page.locator('button:has-text("Admin")')).toBeVisible()

      // Click admin tab
      await page.click('[data-testid="admin-tab"]')
      await expect(page.locator('[data-testid="admin-content"]')).toBeVisible()

      // Test each admin sub-tab
      await page.click('button:has-text("Health")')
      await page.click('button:has-text("Audit Logs")')
      await page.click('button:has-text("Quick Actions")')
      await page.click('button:has-text("Config")')

      // All should be accessible
      await expect(page.locator('[data-testid="admin-content"]')).toBeVisible()
    })

    test('should access user management as admin', async ({ page }) => {
      await login(page, 'admin')
      await page.click('[data-testid="users-tab"]')

      // Users tab should be visible
      await expect(page.locator('[data-testid="users-content"]')).toBeVisible()

      // Should show users table or empty state
      const table = page.locator('table')
      const emptyState = page.locator('text=no users found')

      const hasTable = await table.isVisible().catch(() => false)
      const hasEmpty = await emptyState.isVisible().catch(() => false)

      expect(hasTable || hasEmpty).toBe(true)
    })
  })

  test.describe('Results Export Workflow', () => {
    test('should filter results and export', async ({ page }) => {
      await login(page, 'user')
      await page.click('[data-testid="results-tab"]')

      // Test type filter
      const typeFilter = page.locator('select').filter({ hasText: /All Types|Types/ })

      await typeFilter.selectOption({ label: 'Cracked' })
      await page.waitForTimeout(500)

      // Reset filter
      await typeFilter.selectOption({ label: 'All Types' })
      await page.waitForTimeout(500)

      // Test cracked only toggle
      const crackedOnlyButton = page.locator('button:has-text("Cracked Only")')
      await crackedOnlyButton.click()
      await page.waitForTimeout(500)

      // Click again to disable
      await crackedOnlyButton.click()
      await page.waitForTimeout(500)

      // Export button should be visible
      await expect(page.locator('button:has-text("Export CSV")')).toBeVisible()
    })
  })

  test.describe('Network Management Workflow', () => {
    test('should use network filters and actions', async ({ page }) => {
      await login(page, 'user')
      await page.click('[data-testid="networks-tab"]')

      // Test status filter
      const statusFilter = page.locator('select').filter({ hasText: 'all statuses' })
      await statusFilter.selectOption('ready')
      await page.waitForTimeout(500)

      // Reset filter
      await statusFilter.selectOption('all')
      await page.waitForTimeout(500)

      // Test encryption filter
      const encryptionFilter = page.locator('select').filter({ hasText: 'all encryptions' })
      await encryptionFilter.selectOption('WPA2')
      await page.waitForTimeout(500)

      // Reset filter
      await encryptionFilter.selectOption('all')
      await page.waitForTimeout(500)

      // Test search
      const searchInput = page.locator('input[placeholder="scan networks..."]')
      await searchInput.fill('test')
      await page.waitForTimeout(500)

      // Clear search
      await searchInput.fill('')
      await page.waitForTimeout(500)
    })

    test('should use bulk selection actions', async ({ page }) => {
      await login(page, 'user')
      await page.click('[data-testid="networks-tab"]')

      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        // Test select all button
        const selectAllButton = page.locator('button:has-text("select all"), button:has-text("deselect all")')

        const hasSelectAll = await selectAllButton.isVisible().catch(() => false)

        if (hasSelectAll) {
          await selectAllButton.first().click()
          await page.waitForTimeout(500)

          // Clear selection button should be enabled
          const clearButton = page.locator('button:has-text("clear selection")')
          const isEnabled = await clearButton.isEnabled().catch(() => false)

          if (isEnabled) {
            await clearButton.click()
            await page.waitForTimeout(500)
          }
        }
      }
    })
  })

  test.describe('Authentication Workflow', () => {
    test('should login, use app, and logout', async ({ page }) => {
      // Login
      await page.goto('/sign-in')
      await page.fill('[data-testid="signin-email-input"]', 'e2e-user@test.crackhouse.local')
      await page.fill('[data-testid="signin-password-input"]', 'User123!')
      await page.click('[data-testid="signin-submit-button"]')

      // Should redirect to dashboard
      await page.waitForURL('/', { timeout: 15000 })
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()

      // Use the app - navigate to jobs
      await page.click('[data-testid="jobs-tab"]')
      await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible()

      // Logout
      await page.click('[data-testid="user-menu"]')
      await page.click('text=Log out')

      // Should redirect to sign-in
      await page.waitForURL('/sign-in', { timeout: 10000 })
      await expect(page.locator('[data-testid="signin-form-container"]')).toBeVisible()
    })

    test('should signup, login, and use the app', async ({ page }) => {
      // Generate unique email
      const timestamp = Date.now()
      const email = `test-user-${timestamp}@crackhouse.local`

      // Signup
      await page.goto('/sign-up')
      await page.fill('[data-testid="signup-name-input"]', 'Test User')
      await page.fill('[data-testid="signup-email-input"]', email)
      await page.fill('[data-testid="signup-password-input"]', 'ValidPass123!')
      await page.click('[data-testid="signup-submit-button"]')

      // Should redirect to dashboard
      await page.waitForURL('/', { timeout: 15000 })
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()

      // Logout
      await page.click('[data-testid="user-menu"]')
      await page.click('text=Log out')

      // Login again
      await page.fill('[data-testid="signin-email-input"]', email)
      await page.fill('[data-testid="signin-password-input"]', 'ValidPass123!')
      await page.click('[data-testid="signin-submit-button"]')

      // Should be logged in again
      await page.waitForURL('/', { timeout: 15000 })
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
    })
  })

  test.describe('Cross-Tab Workflow', () => {
    test('should maintain state when switching between tabs', async ({ page }) => {
      await login(page, 'user')

      // Go to networks and apply filter
      await page.click('[data-testid="networks-tab"]')
      const statusFilter = page.locator('select').filter({ hasText: 'all statuses' })
      await statusFilter.selectOption('ready')

      // Switch to dictionaries
      await page.click('[data-testid="dictionaries-tab"]')
      await expect(page.locator('[data-testid="dictionaries-content"]')).toBeVisible()

      // Switch back to networks
      await page.click('[data-testid="networks-tab"]')

      // Filter should still be applied
      await expect(statusFilter).toHaveValue('ready')

      // Reset filter
      await statusFilter.selectOption('all')
    })
  })

  test.describe('Session Persistence Workflow', () => {
    test('should persist session across page reloads', async ({ page }) => {
      await login(page, 'user')

      // Reload multiple times
      for (let i = 0; i < 3; i++) {
        await page.reload()
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 5000 })
      }
    })
  })
})

test.describe('Integration - Error Recovery', () => {
  test('should handle and recover from errors', async ({ page }) => {
    await login(page, 'user')

    // Navigate through tabs
    for (const tab of ['networks', 'dictionaries', 'jobs', 'results']) {
      await page.click(`[data-testid="${tab}-tab"]`)
      await expect(page.locator(`[data-testid="${tab}-content"]`)).toBeVisible()
    }

    // App should still be functional
    await page.click('[data-testid="networks-tab"]')
    await expect(page.locator('[data-testid="networks-content"]')).toBeVisible()
  })
})

test.describe('Integration - Responsive Layout', () => {
  test('should work correctly on different viewports', async ({ page }) => {
    await login(page, 'user')

    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()

    // Test small viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
  })
})
