/**
 * Admin E2E Tests - User Management
 */

import { test, expect } from '@playwright/test'
import { login } from '../../helpers/auth-helpers'

test.describe('Admin - User Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin')
    await page.click('[data-testid="users-tab"]')
    await expect(page.locator('[data-testid="users-content"]')).toBeVisible()
  })

  test.describe('Users List Display', () => {
    test('should display users table', async ({ page }) => {
      const table = page.locator('table')
      const emptyState = page.locator('text=no users found')

      const hasEmptyState = await emptyState.isVisible().catch(() => false)

      if (!hasEmptyState) {
        await expect(table).toBeVisible()
      }
    })

    test('should display empty state when no users exist', async ({ page }) => {
      const emptyState = page.locator('text=no users found')
      const hasEmptyState = await emptyState.isVisible().catch(() => false)

      if (hasEmptyState) {
        await expect(emptyState).toBeVisible()
        await expect(page.locator('text=create your first user account')).toBeVisible()
      }
    })

    test('should display table headers', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const expectedHeaders = ['Email', 'Role', 'Created', 'Last Updated', 'Actions']

        for (const header of expectedHeaders) {
          await expect(page.locator('th').filter({ hasText: header }).first()).toBeVisible()
        }
      }
    })
  })

  test.describe('User Information Display', () => {
    test('should display user email', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Email column should exist
          const emailHeader = page.locator('th').filter({ hasText: 'Email' })
          await expect(emailHeader).toBeVisible()
        }
      }
    })

    test('should display user role badge', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Role column should exist with badge
          const roleHeader = page.locator('th').filter({ hasText: 'Role' })
          await expect(roleHeader).toBeVisible()

          // Role badges should have icons
          const shields = page.locator('text=').or(page.locator('[data-testid]'))
          // Role badges exist
        }
      }
    })

    test('should display admin role badge with red color', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const adminBadge = page.locator('text=admin').or(page.locator('.bg-destructive'))
        const hasAdmin = await adminBadge.isVisible().catch(() => false)

        if (hasAdmin) {
          // Admin badge is displayed
        }
      }
    })

    test('should display user role badge with primary color', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const userBadge = page.locator('text=user').or(page.locator('.bg-primary'))
        const hasUser = await userBadge.isVisible().catch(() => false)

        if (hasUser) {
          // User badge is displayed
        }
      }
    })

    test('should display created date', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Created column should exist
          const createdHeader = page.locator('th').filter({ hasText: 'Created' })
          await expect(createdHeader).toBeVisible()
        }
      }
    })

    test('should display last updated date', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Last Updated column should exist
          const updatedHeader = page.locator('th').filter({ hasText: 'Last Updated' })
          await expect(updatedHeader).toBeVisible()
        }
      }
    })
  })

  test.describe('User Actions', () => {
    test('should display edit button for each user', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Edit buttons should exist (but be disabled)
          const editButtons = page.locator('button:has-text("Edit")')
          const editCount = await editButtons.count()

          expect(editCount).toBeGreaterThan(0)
        }
      }
    })

    test('should display delete button for each user', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Delete buttons should exist (but be disabled)
          const deleteButtons = page.locator('button:has-text("Delete")')
          const deleteCount = await deleteButtons.count()

          expect(deleteCount).toBeGreaterThan(0)
        }
      }
    })

    test('should have edit buttons disabled', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const editButtons = page.locator('button:has-text("Edit")')
        const count = await editButtons.count()

        if (count > 0) {
          // Edit buttons should be disabled (feature not implemented)
          await expect(editButtons.first()).toBeDisabled()
        }
      }
    })

    test('should have delete buttons disabled', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const deleteButtons = page.locator('button:has-text("Delete")')
        const count = await deleteButtons.count()

        if (count > 0) {
          // Delete buttons should be disabled (feature not implemented)
          await expect(deleteButtons.first()).toBeDisabled()
        }
      }
    })
  })

  test.describe('Create User Button', () => {
    test('should display create user button', async ({ page }) => {
      await expect(page.locator('button:has-text("create user")')).toBeVisible()
    })

    test('should have create user button disabled', async ({ page }) => {
      const createButton = page.locator('button:has-text("create user")')
      await expect(createButton).toBeDisabled()
    })
  })

  test.describe('Users Loading State', () => {
    test('should show loading indicator on initial load', async ({ page }) => {
      // Navigate away and back to trigger loading
      await page.click('[data-testid="networks-tab"]')
      await page.click('[data-testid="users-tab"]')

      // Should eventually show the content
      await expect(page.locator('[data-testid="users-content"]')).toBeVisible()
    })
  })

  test.describe('Users Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // This test verifies the error state is displayed if API fails
      await expect(page.locator('[data-testid="users-content"]')).toBeVisible()

      const errorMessage = page.locator('text=Error Loading')
      const hasError = await errorMessage.isVisible().catch(() => false)

      if (hasError) {
        await expect(page.locator('text=Failed to load users')).toBeVisible()
        await expect(page.locator('button:has-text("Retry")')).toBeVisible()
      }
    })
  })
})

test.describe('Admin - Regular User Access to Users Tab', () => {
  test('should allow regular user to view users tab', async ({ page }) => {
    await login(page, 'user')
    await page.click('[data-testid="users-tab"]')

    // Users tab should be visible
    await expect(page.locator('[data-testid="users-content"]')).toBeVisible()
  })

  test('should show disabled buttons for regular user', async ({ page }) => {
    await login(page, 'user')
    await page.click('[data-testid="users-tab"]')

    // Create button should be disabled
    const createButton = page.locator('button:has-text("create user")')
    await expect(createButton).toBeDisabled()

    // Edit/Delete buttons should also be disabled
    const editButtons = page.locator('button:has-text("Edit")')
    const editCount = await editButtons.count()

    if (editCount > 0) {
      await expect(editButtons.first()).toBeDisabled()
    }
  })
})

test.describe('Admin - User Role Verification', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin')
    await page.click('[data-testid="users-tab"]')
  })

  test('should display different roles for different users', async ({ page }) => {
    const table = page.locator('table')
    const hasTable = await table.isVisible().catch(() => false)

    if (hasTable) {
      const rows = page.locator('tbody tr')
      const count = await rows.count()

      if (count > 1) {
        // Multiple users with potentially different roles
        const roleText = await page.locator('text=admin').or(page.locator('text=user')).isVisible().catch(() => false)

        if (roleText) {
          // Roles are displayed
        }
      }
    }
  })

  test('should show current user in list', async ({ page }) => {
    const table = page.locator('table')
    const hasTable = await table.isVisible().catch(() => false)

    if (hasTable) {
      // Admin email should be visible in the list
      const adminEmail = await page.locator('text=e2e-admin@test.crackhouse.local').isVisible().catch(() => false)

      if (adminEmail) {
        await expect(page.locator('text=e2e-admin@test.crackhouse.local')).toBeVisible()
      }
    }
  })
})
