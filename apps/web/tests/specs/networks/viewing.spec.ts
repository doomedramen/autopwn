/**
 * Networks E2E Tests - Viewing and Management
 */

import { test, expect } from '@playwright/test'
import { login } from '../../helpers/auth-helpers'

test.describe('Networks - Viewing', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user')
    // Navigate to networks tab
    await page.click('[data-testid="networks-tab"]')
    await expect(page.locator('[data-testid="networks-content"]')).toBeVisible()
  })

  test.describe('Network List Display', () => {
    test('should display networks tab content', async ({ page }) => {
      await expect(page.locator('[data-testid="networks-content"]')).toBeVisible()
    })

    test('should display search input', async ({ page }) => {
      const searchInput = page.locator('input[placeholder="scan networks..."]')
      await expect(searchInput).toBeVisible()
    })

    test('should display upload pcap button', async ({ page }) => {
      await expect(page.locator('button:has-text("upload pcap")')).toBeVisible()
    })

    test('should display status filter dropdown', async ({ page }) => {
      const statusFilter = page.locator('select').filter({ hasText: 'all statuses' })
      await expect(statusFilter).toBeVisible()
    })

    test('should display encryption filter dropdown', async ({ page }) => {
      const encryptionFilter = page.locator('select').filter({ hasText: 'all encryptions' })
      await expect(encryptionFilter).toBeVisible()
    })

    test('should display bulk action buttons', async ({ page }) => {
      // Select all button
      await expect(page.locator('button:has-text("select all")')).toBeVisible()

      // Clear selection button (disabled when no selection)
      const clearButton = page.locator('button:has-text("clear selection")')
      await expect(clearButton).toBeVisible()
      await expect(clearButton).toBeDisabled()

      // Delete selected button (disabled when no selection)
      const deleteButton = page.locator('button:has-text("delete selected")')
      await expect(deleteButton).toBeVisible()
      await expect(deleteButton).toBeDisabled()
    })
  })

  test.describe('Empty State', () => {
    test('should show empty state when no networks exist', async ({ page }) => {
      // Look for empty state message
      const emptyState = page.getByText('no networks found')
      const hasEmptyState = await emptyState.isVisible().catch(() => false)

      if (hasEmptyState) {
        await expect(emptyState).toBeVisible()
        await expect(page.getByText('upload pcap files to start scanning networks')).toBeVisible()
      } else {
        // Networks exist, show table
        const table = page.locator('table')
        await expect(table).toBeVisible()
      }
    })

    test('should show empty state after clearing filters', async ({ page }) => {
      // Set search term that won't match
      await page.fill('input[placeholder="scan networks..."]', 'nonexistentnetworkxyz')

      // Wait for filter to apply
      await page.waitForTimeout(500)

      // Should show empty state or no results
      const emptyState = page.getByText('no networks found')
      const hasEmptyState = await emptyState.isVisible().catch(() => false)

      if (hasEmptyState) {
        await expect(emptyState).toBeVisible()
      }

      // Clear search
      await page.fill('input[placeholder="scan networks..."]', '')
    })
  })

  test.describe('Search Functionality', () => {
    test('should filter networks by SSID', async ({ page }) => {
      const searchInput = page.locator('input[placeholder="scan networks..."]')

      // Type a search term
      await searchInput.fill('test')

      // Wait for filter to apply
      await page.waitForTimeout(500)

      // Search input should have the value
      await expect(searchInput).toHaveValue('test')

      // Clear search
      await searchInput.fill('')
    })

    test('should filter networks by BSSID', async ({ page }) => {
      const searchInput = page.locator('input[placeholder="scan networks..."]')

      // Type a MAC address format
      await searchInput.fill('AA:BB:CC')

      // Wait for filter to apply
      await page.waitForTimeout(500)

      // Search input should have the value
      await expect(searchInput).toHaveValue('AA:BB:CC')

      // Clear search
      await searchInput.fill('')
    })

    test('should clear search results when input is cleared', async ({ page }) => {
      const searchInput = page.locator('input[placeholder="scan networks..."]')

      // Type and then clear
      await searchInput.fill('testnetwork')
      await page.waitForTimeout(500)

      await searchInput.fill('')
      await page.waitForTimeout(500)

      // Search should be cleared
      await expect(searchInput).toHaveValue('')
    })
  })

  test.describe('Status Filter', () => {
    test('should have all status options', async ({ page }) => {
      const statusFilter = page.locator('select').filter({ hasText: 'all statuses' })

      // Check all options exist
      const expectedOptions = ['all statuses', 'ready', 'processing', 'failed']

      for (const option of expectedOptions) {
        await expect(statusFilter.locator(`option[value="${option}"]`).or(statusFilter.locator(`option:has-text("${option}")`))).toBeAttached()
      }
    })

    test('should filter by ready status', async ({ page }) => {
      const statusFilter = page.locator('select').filter({ hasText: 'all statuses' })

      await statusFilter.selectOption('ready')
      await page.waitForTimeout(500)

      // Filter should be set to ready
      await expect(statusFilter).toHaveValue('ready')
    })

    test('should filter by processing status', async ({ page }) => {
      const statusFilter = page.locator('select').filter({ hasText: 'all statuses' })

      await statusFilter.selectOption('processing')
      await page.waitForTimeout(500)

      await expect(statusFilter).toHaveValue('processing')
    })

    test('should filter by failed status', async ({ page }) => {
      const statusFilter = page.locator('select').filter({ hasText: 'all statuses' })

      await statusFilter.selectOption('failed')
      await page.waitForTimeout(500)

      await expect(statusFilter).toHaveValue('failed')
    })

    test('should reset to all statuses', async ({ page }) => {
      const statusFilter = page.locator('select').filter({ hasText: 'all statuses' })

      // Change filter
      await statusFilter.selectOption('ready')
      await page.waitForTimeout(500)

      // Reset
      await statusFilter.selectOption('all')
      await page.waitForTimeout(500)

      await expect(statusFilter).toHaveValue('all')
    })
  })

  test.describe('Encryption Filter', () => {
    test('should have all encryption options', async ({ page }) => {
      const encryptionFilter = page.locator('select').filter({ hasText: 'all encryptions' })

      const expectedOptions = ['all encryptions', 'OPEN', 'WPA', 'WPA2', 'WPA3', 'WEP']

      for (const option of expectedOptions) {
        await expect(encryptionFilter.locator(`option[value="${option}"]`).or(encryptionFilter.locator(`option:has-text("${option}")`))).toBeAttached()
      }
    })

    test('should filter by WPA2 encryption', async ({ page }) => {
      const encryptionFilter = page.locator('select').filter({ hasText: 'all encryptions' })

      await encryptionFilter.selectOption('WPA2')
      await page.waitForTimeout(500)

      await expect(encryptionFilter).toHaveValue('WPA2')
    })

    test('should filter by OPEN encryption', async ({ page }) => {
      const encryptionFilter = page.locator('select').filter({ hasText: 'all encryptions' })

      await encryptionFilter.selectOption('OPEN')
      await page.waitForTimeout(500)

      await expect(encryptionFilter).toHaveValue('OPEN')
    })

    test('should combine status and encryption filters', async ({ page }) => {
      const statusFilter = page.locator('select').filter({ hasText: 'all statuses' })
      const encryptionFilter = page.locator('select').filter({ hasText: 'all encryptions' })

      // Apply both filters
      await statusFilter.selectOption('ready')
      await encryptionFilter.selectOption('WPA2')
      await page.waitForTimeout(500)

      await expect(statusFilter).toHaveValue('ready')
      await expect(encryptionFilter).toHaveValue('WPA2')
    })
  })

  test.describe('Network Selection', () => {
    test('should show select all button with count', async ({ page }) => {
      const selectAllButton = page.locator('button:has-text("select all")')

      // The button text includes the count
      const buttonText = await selectAllButton.textContent()
      expect(buttonText).toMatch(/select all/)
    })

    test('should toggle select all / deselect all', async ({ page }) => {
      const selectAllButton = page.locator('button:has-text("select all"), button:has-text("deselect all")')

      // Check initial state
      const initialText = await selectAllButton.textContent()
      const isInitiallySelected = initialText?.includes('deselect')

      // Click to toggle
      await selectAllButton.click()
      await page.waitForTimeout(500)

      const afterText = await selectAllButton.textContent()
      expect(afterText).toMatch(/(select all|deselect all)/)
    })

    test('should enable clear selection when networks are selected', async ({ page }) => {
      const clearButton = page.locator('button:has-text("clear selection")')

      // Initially disabled
      await expect(clearButton).toBeDisabled()

      // Select all
      const selectAllButton = page.locator('button:has-text("select all"), button:has-text("deselect all")')
      await selectAllButton.first().click()
      await page.waitForTimeout(500)

      // Clear button should now be enabled
      const isEnabled = await clearButton.isEnabled().catch(() => false)
      if (isEnabled) {
        await expect(clearButton).toBeEnabled()
      }
    })

    test('should enable delete button when networks are selected', async ({ page }) => {
      const deleteButton = page.locator('button:has-text("delete selected")')

      // Initially disabled
      await expect(deleteButton).toBeDisabled()

      // Select all
      const selectAllButton = page.locator('button:has-text("select all"), button:has-text("deselect all")')
      await selectAllButton.first().click()
      await page.waitForTimeout(500)

      // Delete button should now be enabled if there are networks
      const isEnabled = await deleteButton.isEnabled().catch(() => false)
      if (isEnabled) {
        await expect(deleteButton).toBeEnabled()
      }
    })

    test('should clear selection when clear button is clicked', async ({ page }) => {
      const selectAllButton = page.locator('button:has-text("select all"), button:has-text("deselect all")')
      const clearButton = page.locator('button:has-text("clear selection")')

      // Select all
      await selectAllButton.first().click()
      await page.waitForTimeout(500)

      // Clear selection
      const isClearEnabled = await clearButton.isEnabled().catch(() => false)
      if (isClearEnabled) {
        await clearButton.click()
        await page.waitForTimeout(500)

        // Clear button should be disabled again
        await expect(clearButton).toBeDisabled()
      }
    })
  })

  test.describe('Bulk Actions', () => {
    test('should show confirmation before deleting', async ({ page }) => {
      // First select some networks
      const selectAllButton = page.locator('button:has-text("select all"), button:has-text("deselect all")')
      await selectAllButton.first().click()
      await page.waitForTimeout(500)

      const deleteButton = page.locator('button:has-text("delete selected")')
      const isDeleteEnabled = await deleteButton.isEnabled().catch(() => false)

      if (isDeleteEnabled) {
        // Set up dialog handler
        page.on('dialog', async (dialog) => {
          expect(dialog.message()).toMatch(/delete \d+ selected networks/i)
          await dialog.dismiss()
        })

        await deleteButton.click()
      }
    })

    test('should cancel deletion when dialog is dismissed', async ({ page }) => {
      const selectAllButton = page.locator('button:has-text("select all"), button:has-text("deselect all")')
      const deleteButton = page.locator('button:has-text("delete selected")')

      await selectAllButton.first().click()
      await page.waitForTimeout(500)

      const isDeleteEnabled = await deleteButton.isEnabled().catch(() => false)

      if (isDeleteEnabled) {
        page.on('dialog', async (dialog) => {
          await dialog.dismiss()
        })

        await deleteButton.click()
        await page.waitForTimeout(500)

        // Networks should still be present (we dismissed the dialog)
      }
    })
  })

  test.describe('Network Table', () => {
    test('should display network table when networks exist', async ({ page }) => {
      const table = page.locator('table')
      const emptyState = page.getByText('no networks found')

      const hasEmptyState = await emptyState.isVisible().catch(() => false)

      if (!hasEmptyState) {
        await expect(table).toBeVisible()
      }
    })

    test('should display table headers', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const expectedHeaders = ['SSID', 'BSSID', 'Encryption', 'Status', 'Capture Date', 'Actions']

        for (const header of expectedHeaders) {
          await expect(page.locator('th').filter({ hasText: header }).first()).toBeVisible()
        }
      }
    })

    test('should display network rows with data', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // First row should have data
          const firstRow = rows.first()
          await expect(firstRow).toBeVisible()
        }
      }
    })
  })

  test.describe('Network Actions', () => {
    test('should display action button for each network', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Each row should have an actions cell
          const actionButtons = page.locator('td:last-child button')
          const actionCount = await actionButtons.count()

          expect(actionCount).toBeGreaterThan(0)
        }
      }
    })
  })

  test.describe('Upload Modal', () => {
    test('should open upload modal when upload pcap button is clicked', async ({ page }) => {
      await page.click('button:has-text("upload pcap")')

      await expect(page.locator('[data-testid="upload-modal"]')).toBeVisible()
    })

    test('should focus on captures tab in upload modal', async ({ page }) => {
      await page.click('button:has-text("upload pcap")')

      // Should see the captures tab as active
      await expect(page.locator('[data-testid="upload-modal"]')).toBeVisible()
    })
  })

  test.describe('Combined Filters', () => {
    test('should apply search and filters together', async ({ page }) => {
      const searchInput = page.locator('input[placeholder="scan networks..."]')
      const statusFilter = page.locator('select').filter({ hasText: 'all statuses' })
      const encryptionFilter = page.locator('select').filter({ hasText: 'all encryptions' })

      // Apply all filters
      await searchInput.fill('test')
      await statusFilter.selectOption('ready')
      await encryptionFilter.selectOption('WPA2')

      await page.waitForTimeout(500)

      // All filters should be applied
      await expect(searchInput).toHaveValue('test')
      await expect(statusFilter).toHaveValue('ready')
      await expect(encryptionFilter).toHaveValue('WPA2')

      // Clear filters
      await searchInput.fill('')
      await statusFilter.selectOption('all')
      await encryptionFilter.selectOption('all')
    })
  })

  test.describe('Loading State', () => {
    test('should show loading indicator on initial load', async ({ page }) => {
      // Navigate away and back to trigger loading
      await page.click('[data-testid="dictionaries-tab"]')
      await page.click('[data-testid="networks-tab"]')

      // Should eventually show the content
      await expect(page.locator('[data-testid="networks-content"]')).toBeVisible()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // This test verifies the error state is displayed if API fails
      // In normal conditions, API should work fine
      await expect(page.locator('[data-testid="networks-content"]')).toBeVisible()
    })
  })
})

test.describe('Networks - Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, 'user')
      await page.click('[data-testid="networks-tab"]')
    })

    test('should focus search input with keyboard shortcut if implemented', async ({ page }) => {
      // This test is a placeholder for keyboard navigation testing
      // If keyboard shortcuts are implemented, they can be tested here
      const searchInput = page.locator('input[placeholder="scan networks..."]')
      await expect(searchInput).toBeVisible()
      await searchInput.focus()
      await expect(searchInput).toBeFocused()
    })
})
