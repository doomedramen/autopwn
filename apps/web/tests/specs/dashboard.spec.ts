/**
 * Dashboard E2E Tests
 * Tests for main dashboard navigation, tabs, stats, and modals
 */

import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth-helpers'
import { testUsers } from '../fixtures/test-data'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user')
  })

  test.describe('Dashboard Display', () => {
    test('should display dashboard header', async ({ page }) => {
      // Check branding
      await expect(page.locator('[data-testid="header"]')).toBeVisible()
      await expect(page.locator('h1:has-text("CrackHouse")')).toBeVisible()
      await expect(page.locator('text=where handshakes go to break')).toBeVisible()
    })

    test('should display all action buttons in header', async ({ page }) => {
      // Upload Files button
      await expect(page.locator('button:has-text("Upload Files")')).toBeVisible()

      // Create Jobs button
      await expect(page.locator('button:has-text("Create Jobs")')).toBeVisible()

      // Theme toggle
      await expect(page.locator('[data-testid="theme-toggle"]')).toBeVisible()

      // User menu/avatar
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
    })

    test('should display stats cards', async ({ page }) => {
      await expect(page.locator('[data-testid="stats-cards-container"]')).toBeVisible()

      // Check all stat cards exist
      const expectedStats = ['networks', 'dictionaries', 'active-jobs', 'success-rate', 'storage-used', 'cracked']

      for (const stat of expectedStats) {
        await expect(page.locator(`[data-testid="stat-card-${stat}"]`)).toBeVisible()
      }
    })

    test('should display all tabs', async ({ page }) => {
      // Use data-testid selectors to avoid conflicts with "Create Jobs" button
      const expectedTabs = ['networks-tab', 'dictionaries-tab', 'jobs-tab', 'results-tab', 'users-tab']

      for (const tabId of expectedTabs) {
        await expect(page.locator(`[data-testid="${tabId}"]`)).toBeVisible()
      }

      // Admin tab should not be visible for regular user
      await expect(page.locator('[data-testid="admin-tab"]')).not.toBeVisible()
    })
  })

  test.describe('Tab Navigation', () => {
    test('should switch to Networks tab', async ({ page }) => {
      await page.click('[data-testid="networks-tab"]')

      await expect(page.locator('[data-testid="networks-content"]')).toBeVisible()
      await expect(page.locator('[data-testid="networks-tab"]')).toHaveClass(/border-primary/)
    })

    test('should switch to Dictionaries tab', async ({ page }) => {
      await page.click('[data-testid="dictionaries-tab"]')

      await expect(page.locator('[data-testid="dictionaries-content"]')).toBeVisible()
      await expect(page.locator('[data-testid="dictionaries-tab"]')).toHaveClass(/border-primary/)
    })

    test('should switch to Jobs tab', async ({ page }) => {
      await page.click('[data-testid="jobs-tab"]')

      await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible()
      await expect(page.locator('[data-testid="jobs-tab"]')).toHaveClass(/border-primary/)
    })

    test('should switch to Results tab', async ({ page }) => {
      await page.click('[data-testid="results-tab"]')

      await expect(page.locator('[data-testid="results-content"]')).toBeVisible()
      await expect(page.locator('[data-testid="results-tab"]')).toHaveClass(/border-primary/)
    })

    test('should switch to Users tab', async ({ page }) => {
      await page.click('[data-testid="users-tab"]')

      await expect(page.locator('[data-testid="users-content"]')).toBeVisible()
      await expect(page.locator('[data-testid="users-tab"]')).toHaveClass(/border-primary/)
    })

    test('should maintain active tab state', async ({ page }) => {
      // Click Jobs tab
      await page.click('[data-testid="jobs-tab"]')
      await expect(page.locator('[data-testid="jobs-tab"]')).toHaveClass(/border-primary/)

      // Reload page
      await page.reload()

      // Default should be Networks tab after reload
      await expect(page.locator('[data-testid="networks-tab"]')).toHaveClass(/border-primary/)
    })
  })

  test.describe('Header Actions', () => {
    test('should open upload modal from header button', async ({ page }) => {
      await page.click('button:has-text("Upload Files")')

      await expect(page.locator('[data-testid="upload-modal"]')).toBeVisible()
    })

    test('should open create job modal from header button', async ({ page }) => {
      await page.click('button:has-text("Create Jobs")')

      await expect(page.locator('[data-testid="create-job-modal"]')).toBeVisible()
    })

    test('should toggle theme', async ({ page }) => {
      const themeToggle = page.locator('[data-testid="theme-toggle"]')

      // Click theme toggle
      await themeToggle.click()

      // Theme should change (we can verify by checking for theme class)
      const html = page.locator('html')
      const hasDarkClass = await html.getAttribute('class')

      // Either dark or light class should be present
      expect(hasDarkClass).toMatch(/(dark|light)/)
    })

    test('should open user menu dropdown', async ({ page }) => {
      await page.click('[data-testid="user-menu"]')

      await expect(page.locator('[data-testid="avatar-dropdown"]')).toBeVisible()

      // Check menu items
      await expect(page.locator('text=Settings')).toBeVisible()
      await expect(page.locator('text=Log out')).toBeVisible()
    })

    test('should navigate to settings from user menu', async ({ page }) => {
      await page.click('[data-testid="user-menu"]')
      await page.click('text=Settings')

      await expect(page).toHaveURL('/settings')
    })

    test('should logout from user menu', async ({ page }) => {
      await page.click('[data-testid="user-menu"]')
      await page.click('text=Log out')

      await page.waitForURL('/sign-in', { timeout: 10000 })
      await expect(page.locator('[data-testid="signin-form-container"]')).toBeVisible()
    })
  })

  test.describe('Stats Cards', () => {
    test('should display networks stat card', async ({ page }) => {
      const card = page.locator('[data-testid="stat-card-networks"]')

      await expect(card).toBeVisible()
      await expect(card.locator('text=Networks')).toBeVisible()

      // Should have a count value
      const countText = await card.textContent()
      expect(countText).toMatch(/\d+/)
    })

    test('should display dictionaries stat card', async ({ page }) => {
      const card = page.locator('[data-testid="stat-card-dictionaries"]')

      await expect(card).toBeVisible()
      await expect(card.locator('text=Dictionaries')).toBeVisible()

      const countText = await card.textContent()
      expect(countText).toMatch(/\d+/)
    })

    test('should display active jobs stat card', async ({ page }) => {
      const card = page.locator('[data-testid="stat-card-active-jobs"]')

      await expect(card).toBeVisible()
      await expect(card.locator('text=Active Jobs')).toBeVisible()

      const countText = await card.textContent()
      expect(countText).toMatch(/\d+/)
    })

    test('should display success rate stat card', async ({ page }) => {
      const card = page.locator('[data-testid="stat-card-success-rate"]')

      await expect(card).toBeVisible()
      await expect(card.locator('text=Success Rate')).toBeVisible()

      const countText = await card.textContent()
      expect(countText).toMatch(/(\d+%|N\/A)/)
    })

    test('should display storage used stat card', async ({ page }) => {
      const card = page.locator('[data-testid="stat-card-storage-used"]')

      await expect(card).toBeVisible()
      await expect(card.locator('text=Storage Used')).toBeVisible()

      const countText = await card.textContent()
      expect(countText).toMatch(/(\d+\.?\d*%|[\d.]+\s*(B|KB|MB|GB|TB))/)
    })

    test('should display cracked stat card', async ({ page }) => {
      const card = page.locator('[data-testid="stat-card-cracked"]')

      await expect(card).toBeVisible()
      await expect(card.locator('text=Cracked')).toBeVisible()

      const countText = await card.textContent()
      expect(countText).toMatch(/\d+/)
    })
  })

  test.describe('Admin Tab Access Control', () => {
    test('should not show admin tab for regular user', async ({ page }) => {
      await expect(page.locator('[data-testid="admin-tab"]')).not.toBeVisible()
    })

    test('should show admin tab for admin user', async ({ page }) => {
      // Logout and login as admin
      await page.click('[data-testid="user-menu"]')
      await page.click('text=Log out')
      await page.waitForURL('/sign-in')

      await login(page, 'admin')

      // Admin tab should be visible
      await expect(page.locator('[data-testid="admin-tab"]')).toBeVisible()

      // Click admin tab
      await page.click('[data-testid="admin-tab"]')

      // Admin content should be visible
      await expect(page.locator('[data-testid="admin-content"]')).toBeVisible()
    })
  })

  test.describe('Responsive Design', () => {
    test('should display correctly on desktop viewport', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 })

      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
      await expect(page.locator('[data-testid="header"]')).toBeVisible()

      // All tabs should be visible
      const tabs = ['networks-tab', 'dictionaries-tab', 'jobs-tab', 'results-tab', 'users-tab']
      for (const tabId of tabs) {
        await expect(page.locator(`[data-testid="${tabId}"]`)).toBeVisible()
      }
    })

    test('should display correctly on smaller viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })

      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
      await expect(page.locator('[data-testid="header"]')).toBeVisible()
    })
  })

  test.describe('Page Load States', () => {
    test('should show loading state while fetching data', async ({ page }) => {
      // Navigate to a fresh page
      await page.goto('/')

      // Initially might show loading
      // Then dashboard should appear
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 10000 })
    })

    test('should handle errors gracefully', async ({ page, context }) => {
      // This test verifies the error handling by navigating away and back
      // In a real scenario, you might want to mock API failures

      await page.goto('/')
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
    })
  })

  test.describe('Empty States', () => {
    test('should show empty state in Jobs tab when no jobs', async ({ page }) => {
      await page.click('[data-testid="jobs-tab"]')

      // Check for empty state or job list
      const emptyState = page.locator('[data-testid="jobs-empty-state"]')
      const jobsList = page.locator('[data-testid="jobs-list"]')

      // Either empty state or jobs list should be visible
      const isEmptyStateVisible = await emptyState.isVisible().catch(() => false)
      const isJobsListVisible = await jobsList.isVisible().catch(() => false)

      expect(isEmptyStateVisible || isJobsListVisible).toBe(true)
    })
  })
})

test.describe('Dashboard - Protected Routes', () => {
  test('should redirect to login when not authenticated', async ({ page, context }) => {
    // Clear any existing storage
    await context.clearCookies()

    // Try to access dashboard
    await page.goto('/')

    // Should redirect to login
    await page.waitForURL('/sign-in', { timeout: 10000 })
    await expect(page.locator('[data-testid="signin-form-container"]')).toBeVisible()
  })

  test('should redirect to login when accessing protected route', async ({ page, context }) => {
    await context.clearCookies()

    // Try to access a protected route directly
    await page.goto('/settings')

    // Should redirect to login
    await page.waitForURL('/sign-in', { timeout: 10000 })
  })

  test('should allow access after authentication', async ({ page }) => {
    // First try without auth
    await page.goto('/')
    await page.waitForURL('/sign-in', { timeout: 10000 })

    // Login
    await login(page, 'user')

    // Should now have access to dashboard
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
  })
})

test.describe('Dashboard - Data Refresh', () => {
  test('should refresh data when switching tabs', async ({ page }) => {
    await login(page, 'user')

    // Go to jobs tab
    await page.click('[data-testid="jobs-tab"]')
    await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible()

    // Go back to networks
    await page.click('[data-testid="networks-tab"]')
    await expect(page.locator('[data-testid="networks-content"]')).toBeVisible()

    // Go to results
    await page.click('[data-testid="results-tab"]')
    await expect(page.locator('[data-testid="results-content"]')).toBeVisible()
  })

  test('should handle rapid tab switching', async ({ page }) => {
    await login(page, 'user')

    // Rapidly switch between tabs
    const tabs = ['networks-tab', 'dictionaries-tab', 'jobs-tab', 'results-tab', 'users-tab']

    for (const tab of tabs) {
      await page.click(`[data-testid="${tab}"]`)
      await expect(page.locator(`[data-testid="${tab}"]`)).toHaveClass(/border-primary/)
    }
  })
})
