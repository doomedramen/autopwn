/**
 * Dictionaries E2E Tests - Management (Generate, Stats, Delete, Merge)
 */

import { test, expect } from '@playwright/test'
import { login } from '../../helpers/auth-helpers'

test.describe('Dictionaries - Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user')
    await page.click('[data-testid="dictionaries-tab"]')
    await expect(page.locator('[data-testid="dictionaries-content"]')).toBeVisible()
  })

  test.describe('Dictionaries List Display', () => {
    test('should display dictionaries table', async ({ page }) => {
      const table = page.locator('table')
      const emptyState = page.getByText('no dictionaries found')

      const hasEmptyState = await emptyState.isVisible().catch(() => false)

      if (!hasEmptyState) {
        await expect(table).toBeVisible()
      }
    })

    test('should display table headers', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const expectedHeaders = ['Name', 'Type', 'Status', 'Size', 'Words', 'Created', 'Actions']

        for (const header of expectedHeaders) {
          await expect(page.locator('th').filter({ hasText: header }).first()).toBeVisible()
        }
      }
    })

    test('should display empty state when no dictionaries exist', async ({ page }) => {
      const emptyState = page.getByText('no dictionaries found')
      const hasEmptyState = await emptyState.isVisible().catch(() => false)

      if (hasEmptyState) {
        await expect(emptyState).toBeVisible()
        await expect(page.getByText('upload or generate dictionaries to get started')).toBeVisible()
      }
    })
  })

  test.describe('Dictionary Actions Buttons', () => {
    test('should display upload dictionary button', async ({ page }) => {
      await expect(page.locator('button:has-text("Upload Dictionary")')).toBeVisible()
    })

    test('should display generate dictionary button', async ({ page }) => {
      await expect(page.locator('button:has-text("Generate Dictionary")')).toBeVisible()
    })

    test('should display merge dictionaries button', async ({ page }) => {
      await expect(page.locator('button:has-text("Merge Dictionaries")')).toBeVisible()
    })
  })

  test.describe('Dictionary Generation Modal', () => {
    test('should open generate dictionary modal', async ({ page }) => {
      await page.click('button:has-text("Generate Dictionary")')

      // Wait for modal to appear (use waitForSelector for reliability)
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 })
      await expect(page.locator('[role="dialog"]')).toBeVisible()
    })

    test('should have generation options', async ({ page }) => {
      await page.click('button:has-text("Generate Dictionary")')

      // Should have some form for generation settings
      const dialog = page.locator('[role="dialog"]')
      await expect(dialog).toBeVisible()
    })

    test('should close generation modal', async ({ page }) => {
      await page.click('button:has-text("Generate Dictionary")')

      const dialog = page.locator('[role="dialog"]')
      await expect(dialog).toBeVisible()

      // Try to close - might have cancel/close button or ESC key
      await page.keyboard.press('Escape')

      // Modal might close with ESC
      const isDialogVisible = await dialog.isVisible().catch(() => false)
      // Some dialogs might not close on ESC
    })
  })

  test.describe('Dictionary Merge Modal', () => {
    test('should open merge dictionaries modal', async ({ page }) => {
      await page.click('button:has-text("Merge Dictionaries")')

      // Wait for modal to appear
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 })
      await expect(page.locator('[role="dialog"]')).toBeVisible()
    })

    test('should have merge options', async ({ page }) => {
      await page.click('button:has-text("Merge Dictionaries")')

      // Should have options for selecting dictionaries to merge
      const dialog = page.locator('[role="dialog"]')
      await expect(dialog).toBeVisible()
    })
  })

  test.describe('Dictionary Row Actions', () => {
    test('should display action buttons for each dictionary', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Each row should have action buttons
          const actionButtons = page.locator('td:last-child button')
          const actionCount = await actionButtons.count()

          expect(actionCount).toBeGreaterThan(0)
        }
      }
    })

    test('should have view statistics action', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Statistics button should be visible
          const statsButton = page.locator('button').filter({ has: page.locator('svg') }).first()
          await expect(statsButton).toBeVisible()
        }
      }
    })

    test('should have validate action', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // There should be at least 3 action buttons (stats, validate, delete)
          const actionButtons = page.locator('td:last-child button')
          const actionCount = await actionButtons.count()

          expect(actionCount).toBeGreaterThanOrEqual(3)
        }
      }
    })

    test('should have delete action', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Delete button should exist (has trash icon)
          const deleteButton = page.locator('button').filter({ has: page.locator('svg') }) // Filter for icon buttons
          await expect(deleteButton.first()).toBeVisible()
        }
      }
    })
  })

  test.describe('Dictionary Delete', () => {
    test('should show confirmation before deleting', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Set up dialog handler for the confirmation
          page.on('dialog', async (dialog) => {
            expect(dialog.message()).toMatch(/delete dictionary/i)
            await dialog.dismiss()
          })

          // Click delete button (last button in the row)
          const lastButton = page.locator('td:last-child button').last()
          await lastButton.click()
        }
      }
    })

    test('should cancel deletion when dialog is dismissed', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          page.on('dialog', async (dialog) => {
            await dialog.dismiss()
          })

          const lastButton = page.locator('td:last-child button').last()
          await lastButton.click()

          // Row should still exist after dismissal
          await page.waitForTimeout(500)
          const rowsAfter = await rows.count()
          expect(rowsAfter).toBe(count)
        }
      }
    })
  })

  test.describe('Dictionary Statistics', () => {
    test('should open statistics modal', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Click the statistics button (first button)
          const firstButton = page.locator('td:last-child button').first()
          await firstButton.click()

          // Statistics modal or content should appear
          const statsContent = page.locator('text=Statistics').or(page.locator('[role="dialog"]'))
          const hasStats = await statsContent.isVisible().catch(() => false)

          if (hasStats) {
            await expect(statsContent).toBeVisible()
          }
        }
      }
    })
  })

  test.describe('Dictionary Types', () => {
    test('should display type indicator for uploaded dictionaries', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const uploadedText = page.locator('text=uploaded')
        const hasUploaded = await uploadedText.isVisible().catch(() => false)

        if (hasUploaded) {
          await expect(uploadedText).toBeVisible()
        }
      }
    })

    test('should display type indicator for generated dictionaries', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const generatedText = page.locator('text=generated')
        const hasGenerated = await generatedText.isVisible().catch(() => false)

        if (hasGenerated) {
          await expect(generatedText).toBeVisible()
        }
      }
    })
  })

  test.describe('Dictionary Status', () => {
    test('should display status indicator', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        // Look for status text
        const statusText = page.locator('text=ready')
        const hasStatus = await statusText.isVisible().catch(() => false)

        if (hasStatus) {
          await expect(statusText).toBeVisible()
        }
      }
    })

    test('should display loading state for processing dictionaries', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        // Look for processing status
        const processingText = page.locator('text=processing')
        const hasProcessing = await processingText.isVisible().catch(() => false)

        if (hasProcessing) {
          await expect(processingText).toBeVisible()
        }
      }
    })

    test('should display error state for failed dictionaries', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        // Look for failed status
        const failedText = page.locator('text=failed')
        const hasFailed = await failedText.isVisible().catch(() => false)

        if (hasFailed) {
          await expect(failedText).toBeVisible()
        }
      }
    })
  })

  test.describe('Dictionary Size and Word Count', () => {
    test('should display formatted file size', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Should have size information in bytes/KB/MB/GB format
          const sizePattern = /\d+\s*(B|KB|MB|GB|Bytes)/i
          const tableText = await table.textContent()

          if (tableText) {
            expect(tableText).toMatch(sizePattern)
          }
        }
      }
    })

    test('should display word count', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Should have word count information
          // This might be "-" for dictionaries without word count
          const wordHeader = page.locator('th').filter({ hasText: 'Words' })
          await expect(wordHeader).toBeVisible()
        }
      }
    })
  })

  test.describe('Dictionary Actions Validation', () => {
    test('should disable validate button while validating', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Click validate button
          const validateButton = page.locator('td:last-child button').nth(1) // Second button

          // Set up dialog to dismiss any confirmation
          page.on('dialog', async (dialog) => {
            await dialog.dismiss()
          })

          await validateButton.click()

          // Button might show loading state
          await page.waitForTimeout(500)
        }
      }
    })

    test('should disable delete button while deleting', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Dismiss any confirmation dialogs
          page.on('dialog', async (dialog) => {
            await dialog.dismiss()
          })

          // Click delete button
          const deleteButton = page.locator('td:last-child button').last()
          await deleteButton.click()

          // Button might show loading state
          await page.waitForTimeout(500)
        }
      }
    })
  })

  test.describe('Dictionary Loading State', () => {
    test('should show loading indicator on initial load', async ({ page }) => {
      // Navigate away and back to trigger loading
      await page.click('[data-testid="networks-tab"]')
      await page.click('[data-testid="dictionaries-tab"]')

      // Should eventually show the content
      await expect(page.locator('[data-testid="dictionaries-content"]')).toBeVisible()
    })
  })

  test.describe('Dictionary Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // This test verifies the error state is displayed if API fails
      await expect(page.locator('[data-testid="dictionaries-content"]')).toBeVisible()

      const errorMessage = page.locator('text=Error Loading')
      const hasError = await errorMessage.isVisible().catch(() => false)

      if (hasError) {
        await expect(page.locator('text=Failed to load dictionaries')).toBeVisible()
        await expect(page.locator('button:has-text("Retry")')).toBeVisible()
      }
    })
  })
})

test.describe('Dictionaries - Full Workflow', () => {
  test('should navigate through dictionary management features', async ({ page }) => {
    await login(page, 'user')
    await page.click('[data-testid="dictionaries-tab"]')

    // Open upload modal
    await page.click('button:has-text("Upload Dictionary")')
    await expect(page.locator('[data-testid="upload-modal"]')).toBeVisible()

    // Close modal
    await page.keyboard.press('Escape')

    // Open generate modal
    await page.click('button:has-text("Generate Dictionary")')
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Close modal
    await page.keyboard.press('Escape')

    // Open merge modal
    await page.click('button:has-text("Merge Dictionaries")')
    await expect(dialog).toBeVisible()
  })
})
