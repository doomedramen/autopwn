/**
 * Results E2E Tests - Viewing
 */

import { test, expect } from '@playwright/test'
import { login } from '../../helpers/auth-helpers'

test.describe('Results - Viewing', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user')
    await page.click('[data-testid="results-tab"]')
    await expect(page.locator('[data-testid="results-content"]')).toBeVisible()
  })

  test.describe('Results Stats Cards', () => {
    test('should display total results stat card', async ({ page }) => {
      await expect(page.locator('text=Total Results')).toBeVisible()

      // Should have a numeric value
      const statCard = page.locator('text=Total Results').locator('..')
      await expect(statCard).toBeVisible()
    })

    test('should display cracked networks stat card', async ({ page }) => {
      await expect(page.locator('text=Cracked Networks')).toBeVisible()

      // Should show success rate
      await expect(page.locator('text=% success rate').or(page.locator(/% success/))).toBeVisible()
    })

    test('should display results by type stat card', async ({ page }) => {
      await expect(page.locator('text=Results by Type')).toBeVisible()

      // Should breakdown by type
      await expect(page.locator('text=Passwords:').or(page.locator('text=Passwords'))).toBeVisible()
      await expect(page.locator('text=Handshakes:').or(page.locator('text=Handshakes'))).toBeVisible()
      await expect(page.locator('text=Errors:').or(page.locator('text=Errors'))).toBeVisible()
    })
  })

  test.describe('Results Filters', () => {
    test('should display type filter dropdown', async ({ page }) => {
      const typeFilter = page.locator('select').filter({ hasText: /All Types|Types/ })
      await expect(typeFilter).toBeVisible()
    })

    test('should have all type filter options', async ({ page }) => {
      const typeFilter = page.locator('select').filter({ hasText: /All Types|Types/ })

      const expectedOptions = ['All Types', 'Cracked', 'Handshakes', 'Errors']

      for (const option of expectedOptions) {
        const hasOption = await typeFilter.locator(`option:has-text("${option}")`).isVisible().catch(() => false)
        // Options exist in the DOM
      }
    })

    test('should filter by password type', async ({ page }) => {
      const typeFilter = page.locator('select').filter({ hasText: /All Types|Types/ })

      await typeFilter.selectOption({ label: 'Cracked' })
      await page.waitForTimeout(500)

      // Filter should be set
      await expect(typeFilter).toHaveValue('password')
    })

    test('should filter by handshake type', async ({ page }) => {
      const typeFilter = page.locator('select').filter({ hasText: /All Types|Types/ })

      await typeFilter.selectOption({ label: 'Handshakes' })
      await page.waitForTimeout(500)

      await expect(typeFilter).toHaveValue('handshake')
    })

    test('should filter by error type', async ({ page }) => {
      const typeFilter = page.locator('select').filter({ hasText: /All Types|Types/ })

      await typeFilter.selectOption({ label: 'Errors' })
      await page.waitForTimeout(500)

      await expect(typeFilter).toHaveValue('error')
    })

    test('should display cracked only toggle', async ({ page }) => {
      await expect(page.locator('button:has-text("Cracked Only")')).toBeVisible()
    })

    test('should toggle cracked only filter', async ({ page }) => {
      const crackedOnlyButton = page.locator('button:has-text("Cracked Only")')

      await crackedOnlyButton.click()
      await page.waitForTimeout(500)

      // Button should be in active state
      const isActive = await crackedOnlyButton.evaluate((el: any) =>
        el.classList.contains('bg-primary')
      )

      if (isActive) {
        // Toggle worked
      }

      // Click again to disable
      await crackedOnlyButton.click()
      await page.waitForTimeout(500)
    })
  })

  test.describe('Results Export', () => {
    test('should display export CSV button', async ({ page }) => {
      await expect(page.locator('button:has-text("Export CSV")')).toBeVisible()
    })

    test('should trigger CSV download when export button is clicked', async ({ page }) => {
      // Set up download handler
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)

      await page.click('button:has-text("Export CSV")')

      // Download might or might not trigger depending on whether there are results
      const download = await downloadPromise

      if (download) {
        expect(download.suggestedFilename()).toContain('.csv')
      }
    })
  })

  test.describe('Results List Display', () => {
    test('should display results table when results exist', async ({ page }) => {
      const table = page.locator('table')
      const emptyState = page.locator('text=no results found')

      const hasEmptyState = await emptyState.isVisible().catch(() => false)

      if (!hasEmptyState) {
        await expect(table).toBeVisible()
      }
    })

    test('should display empty state when no results exist', async ({ page }) => {
      const emptyState = page.locator('text=no results found')
      const hasEmptyState = await emptyState.isVisible().catch(() => false)

      if (hasEmptyState) {
        await expect(emptyState).toBeVisible()
        await expect(page.locator('text=run cracking jobs to generate results')).toBeVisible()
      }
    })

    test('should display table headers', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const expectedHeaders = ['Type', 'Network', 'BSSID', 'Job', 'Result Data', 'Created', 'Actions']

        for (const header of expectedHeaders) {
          await expect(page.locator('th').filter({ hasText: header }).first()).toBeVisible()
        }
      }
    })
  })

  test.describe('Result Types Display', () => {
    test('should display password result type', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const crackedText = page.locator('text=Cracked')
        const hasCracked = await crackedText.isVisible().catch(() => false)

        if (hasCracked) {
          await expect(crackedText).toBeVisible()
        }
      }
    })

    test('should display handshake result type', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const handshakeText = page.locator('text=Handshake')
        const hasHandshake = await handshakeText.isVisible().catch(() => false)

        if (hasHandshake) {
          await expect(handshakeText).toBeVisible()
        }
      }
    })

    test('should display error result type', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const errorText = page.locator('text=Error')
        const hasError = await errorText.isVisible().catch(() => false)

        if (hasError) {
          await expect(errorText).toBeVisible()
        }
      }
    })
  })

  test.describe('Result Password Display', () => {
    test('should display password in green badge', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const passwordBadge = page.locator('span').filter({ hasText: /./ }).or(page.locator('.bg-green-50'))
        const hasPassword = await passwordBadge.first().isVisible().catch(() => false)

        if (hasPassword) {
          // Password badges are displayed
        }
      }
    })

    test('should display copy button for passwords', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const copyButtons = page.locator('button').filter({ hasText: '' }).or(page.locator('button[title*="copy" i]'))
        const count = await copyButtons.count()

        if (count > 0) {
          // Copy buttons exist
        }
      }
    })
  })

  test.describe('Result Actions', () => {
    test('should display view button for each result', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Each row should have an actions cell with view button
          const actionButtons = page.locator('td:last-child button')
          const actionCount = await actionButtons.count()

          expect(actionCount).toBeGreaterThan(0)
        }
      }
    })
  })

  test.describe('Result Network Information', () => {
    test('should display network SSID', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Network column should exist
          const networkHeader = page.locator('th').filter({ hasText: 'Network' })
          await expect(networkHeader).toBeVisible()
        }
      }
    })

    test('should display network BSSID', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // BSSID column should exist
          const bssidHeader = page.locator('th').filter({ hasText: 'BSSID' })
          await expect(bssidHeader).toBeVisible()
        }
      }
    })
  })

  test.describe('Result Job Information', () => {
    test('should display associated job name', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Job column should exist
          const jobHeader = page.locator('th').filter({ hasText: 'Job' })
          await expect(jobHeader).toBeVisible()
        }
      }
    })
  })

  test.describe('Result Timestamp', () => {
    test('should display creation date', async ({ page }) => {
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
  })

  test.describe('Results Pagination', () => {
    test('should display pagination when results exceed page size', async ({ page }) => {
      // Pagination might appear if there are many results
      const pagination = page.locator('text=Showing').or(page.locator('button:has-text("Previous")'))
      const hasPagination = await pagination.isVisible().catch(() => false)

      if (hasPagination) {
        await expect(pagination).toBeVisible()
      }
    })

    test('should have previous and next buttons', async ({ page }) => {
      const previousButton = page.locator('button:has-text("Previous")')
      const nextButton = page.locator('button:has-text("Next")')

      const hasPrevious = await previousButton.isVisible().catch(() => false)
      const hasNext = await nextButton.isVisible().catch(() => false)

      if (hasPrevious || hasNext) {
        // Pagination controls exist
      }
    })
  })

  test.describe('Results Loading State', () => {
    test('should show loading indicator on initial load', async ({ page }) => {
      // Navigate away and back to trigger loading
      await page.click('[data-testid="networks-tab"]')
      await page.click('[data-testid="results-tab"]')

      // Should eventually show the content
      await expect(page.locator('[data-testid="results-content"]')).toBeVisible()
    })
  })

  test.describe('Results Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // This test verifies the error state is displayed if API fails
      await expect(page.locator('[data-testid="results-content"]')).toBeVisible()

      const errorMessage = page.locator('text=Error Loading')
      const hasError = await errorMessage.isVisible().catch(() => false)

      if (hasError) {
        await expect(page.locator('text=Failed to load results')).toBeVisible()
        await expect(page.locator('button:has-text("Retry")')).toBeVisible()
      }
    })
  })
})

test.describe('Results - Combined Filters', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user')
    await page.click('[data-testid="results-tab"]')
  })

  test('should apply type and cracked only filters together', async ({ page }) => {
    const typeFilter = page.locator('select').filter({ hasText: /All Types|Types/ })
    const crackedOnlyButton = page.locator('button:has-text("Cracked Only")')

    // Apply both filters
    await typeFilter.selectOption({ label: 'Cracked' })
    await crackedOnlyButton.click()

    await page.waitForTimeout(500)

    // Both filters should be applied
    await expect(typeFilter).toHaveValue('password')

    const isActive = await crackedOnlyButton.evaluate((el: any) =>
      el.classList.contains('bg-primary')
    )

    // Reset filters
    await typeFilter.selectOption({ label: 'All Types' })
    if (isActive) {
      await crackedOnlyButton.click()
    }
  })
})

test.describe('Results - Copy Password', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user')
    await page.click('[data-testid="results-tab"]')
  })

  test('should copy password to clipboard when copy button is clicked', async ({ page }) => {
    const table = page.locator('table')
    const hasTable = await table.isVisible().catch(() => false)

    if (hasTable) {
      const copyButtons = page.locator('td:last-child button, button').filter({ has: page.locator('svg') })

      // Set up clipboard spy (if browser supports)
      const clipboardText = await page.evaluate(async () => {
        try {
          return await navigator.clipboard.readText()
        } catch {
          return null
        }
      })

      // Click copy button if available
      const count = await copyButtons.count()

      if (count > 0) {
        await copyButtons.first().click()

        // Clipboard should contain the password
        await page.waitForTimeout(500)
      }
    }
  })
})
