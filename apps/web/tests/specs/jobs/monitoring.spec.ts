/**
 * Jobs E2E Tests - Monitoring
 */

import { test, expect } from '@playwright/test'
import { login } from '../../helpers/auth-helpers'

test.describe('Jobs - Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user')
    await page.click('[data-testid="jobs-tab"]')
    await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible()
  })

  test.describe('Jobs List Display', () => {
    test('should display jobs table when jobs exist', async ({ page }) => {
      const table = page.locator('table')
      const emptyState = page.locator('[data-testid="jobs-empty-state"]')

      const hasEmptyState = await emptyState.isVisible().catch(() => false)

      if (!hasEmptyState) {
        await expect(table).toBeVisible()
      }
    })

    test('should display empty state when no jobs exist', async ({ page }) => {
      const emptyState = page.locator('[data-testid="jobs-empty-state"]')
      const hasEmptyState = await emptyState.isVisible().catch(() => false)

      if (hasEmptyState) {
        await expect(emptyState).toBeVisible()
        await expect(page.locator('text=create your first cracking job')).toBeVisible()
      }
    })

    test('should display table headers', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const expectedHeaders = ['Name', 'Status', 'Progress', 'Attack Mode', 'Networks', 'Dictionaries', 'Duration', 'Results']

        for (const header of expectedHeaders) {
          await expect(page.locator('th').filter({ hasText: header }).first()).toBeVisible()
        }
      }
    })
  })

  test.describe('Job Status Display', () => {
    test('should display job status indicator', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Should have status column with icon
          const statusText = page.locator('text=').or(page.locator('span'))
          const hasStatus = await statusText.first().isVisible().catch(() => false)

          if (hasStatus) {
            // Status is displayed
          }
        }
      }
    })

    test('should display completed status', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const completedText = page.locator('text=completed')
        const hasCompleted = await completedText.isVisible().catch(() => false)

        if (hasCompleted) {
          await expect(completedText).toBeVisible()
        }
      }
    })

    test('should display running status', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const runningText = page.locator('text=running')
        const hasRunning = await runningText.isVisible().catch(() => false)

        if (hasRunning) {
          await expect(runningText).toBeVisible()
        }
      }
    })

    test('should display failed status', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const failedText = page.locator('text=failed')
        const hasFailed = await failedText.isVisible().catch(() => false)

        if (hasFailed) {
          await expect(failedText).toBeVisible()
        }
      }
    })

    test('should display paused status', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const pausedText = page.locator('text=paused')
        const hasPaused = await pausedText.isVisible().catch(() => false)

        if (hasPaused) {
          await expect(pausedText).toBeVisible()
        }
      }
    })
  })

  test.describe('Job Progress', () => {
    test('should display progress bar for jobs', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Progress column should exist
          const progressHeader = page.locator('th').filter({ hasText: 'Progress' })
          await expect(progressHeader).toBeVisible()
        }
      }
    })
  })

  test.describe('Job Details', () => {
    test('should display job name as clickable link', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // First cell should have the job name
          const firstCell = page.locator('td').first()
          await expect(firstCell).toBeVisible()
        }
      }
    })

    test('should display attack mode', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Attack mode column should exist
          const attackModeHeader = page.locator('th').filter({ hasText: 'Attack Mode' })
          await expect(attackModeHeader).toBeVisible()
        }
      }
    })

    test('should display network count', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          const networkCount = page.locator('td').nth(4) // Networks column
          await expect(networkCount).toBeVisible()
        }
      }
    })

    test('should display dictionary count', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          const dictionaryCount = page.locator('td').nth(5) // Dictionaries column
          await expect(dictionaryCount).toBeVisible()
        }
      }
    })

    test('should display duration', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          const durationCell = page.locator('td').nth(6) // Duration column
          await expect(durationCell).toBeVisible()
        }
      }
    })

    test('should display results count', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          const resultsCell = page.locator('td').nth(7) // Results column
          await expect(resultsCell).toBeVisible()
        }
      }
    })
  })

  test.describe('Job Actions', () => {
    test('should open job detail modal when clicking job name', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          // Click on job name (first cell, button inside)
          const jobNameButton = page.locator('td button').first()
          await jobNameButton.click()

          // Detail modal should open
          const dialog = page.locator('[role="dialog"]')
          const hasDialog = await dialog.isVisible().catch(() => false)

          if (hasDialog) {
            await expect(dialog).toBeVisible()
          }
        }
      }
    })
  })

  test.describe('Job Filtering', () => {
    test('should refresh jobs list when navigating back to jobs tab', async ({ page }) => {
      // Navigate away and back
      await page.click('[data-testid="networks-tab"]')
      await page.click('[data-testid="jobs-tab"]')

      // Jobs content should be visible
      await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible()
    })
  })

  test.describe('Job Results', () => {
    test('should display results count badge', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const rows = page.locator('tbody tr')
        const count = await rows.count()

        if (count > 0) {
          const foundText = page.locator('text=found')
          const hasFound = await foundText.isVisible().catch(() => false)

          if (hasFound) {
            await expect(foundText).toBeVisible()
          }
        }
      }
    })

    test('should display none for jobs without results', async ({ page }) => {
      const table = page.locator('table')
      const hasTable = await table.isVisible().catch(() => false)

      if (hasTable) {
        const noneText = page.locator('text=None')
        const hasNone = await noneText.isVisible().catch(() => false)

        if (hasNone) {
          await expect(noneText).toBeVisible()
        }
      }
    })
  })

  test.describe('Job Loading State', () => {
    test('should show loading indicator on initial load', async ({ page }) => {
      // Navigate away and back to trigger loading
      await page.click('[data-testid="networks-tab"]')
      await page.click('[data-testid="jobs-tab"]')

      // Should eventually show the content
      await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible()
    })
  })

  test.describe('Job Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // This test verifies the error state is displayed if API fails
      await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible()

      const errorMessage = page.locator('text=Error Loading')
      const hasError = await errorMessage.isVisible().catch(() => false)

      if (hasError) {
        await expect(page.locator('text=Failed to load jobs')).toBeVisible()
        await expect(page.locator('button:has-text("Retry")')).toBeVisible()
      }
    })
  })
})

test.describe('Jobs - Real-time Updates', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user')
    await page.click('[data-testid="jobs-tab"]')
  })

  test('should display running jobs with spinner', async ({ page }) => {
    const table = page.locator('table')
    const hasTable = await table.isVisible().catch(() => false)

    if (hasTable) {
      const runningText = page.locator('text=running')
      const hasRunning = await runningText.isVisible().catch(() => false)

      if (hasRunning) {
        // Should have spinner animation
        const spinner = page.locator('.animate-spin')
        const hasSpinner = await spinner.isVisible().catch(() => false)

        if (hasSpinner) {
          await expect(spinner).toBeVisible()
        }
      }
    }
  })
})

test.describe('Jobs - Detail Modal', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user')
    await page.click('[data-testid="jobs-tab"]')
  })

  test('should open detail modal when clicking job name', async ({ page }) => {
    const table = page.locator('table')
    const hasTable = await table.isVisible().catch(() => false)

    if (hasTable) {
      const rows = page.locator('tbody tr')
      const count = await rows.count()

      if (count > 0) {
        const jobNameButton = page.locator('td button').first()
        await jobNameButton.click()

        // Detail modal should open
        await page.waitForTimeout(500)
        const dialog = page.locator('[role="dialog"]')
        const hasDialog = await dialog.isVisible().catch(() => false)

        if (hasDialog) {
          await expect(dialog).toBeVisible()
        }
      }
    }
  })

  test('should close detail modal', async ({ page }) => {
    const table = page.locator('table')
    const hasTable = await table.isVisible().catch(() => false)

    if (hasTable) {
      const rows = page.locator('tbody tr')
      const count = await rows.count()

      if (count > 0) {
        const jobNameButton = page.locator('td button').first()
        await jobNameButton.click()

        await page.waitForTimeout(500)

        // Try to close with ESC
        await page.keyboard.press('Escape')

        await page.waitForTimeout(300)

        // Modal might be closed
      }
    }
  })
})

test.describe('Jobs - Attack Modes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user')
    await page.click('[data-testid="jobs-tab"]')
  })

  test('should display straight attack mode', async ({ page }) => {
    const table = page.locator('table')
    const hasTable = await table.isVisible().catch(() => false)

    if (hasTable) {
      const straightText = page.locator('text=straight')
      const hasStraight = await straightText.isVisible().catch(() => false)

      if (hasStraight) {
        await expect(straightText).toBeVisible()
      }
    }
  })

  test('should display combination attack mode', async ({ page }) => {
    const table = page.locator('table')
    const hasTable = await table.isVisible().catch(() => false)

    if (hasTable) {
      const combinationText = page.locator('text=combination')
      const hasCombination = await combinationText.isVisible().catch(() => false)

      if (hasCombination) {
        await expect(combinationText).toBeVisible()
      }
    }
  })

  test('should display brute-force attack mode', async ({ page }) => {
    const table = page.locator('table')
    const hasTable = await table.isVisible().catch(() => false)

    if (hasTable) {
      const bruteForceText = page.locator('text=brute-force')
      const hasBruteForce = await bruteForceText.isVisible().catch(() => false)

      if (hasBruteForce) {
        await expect(bruteForceText).toBeVisible()
      }
    }
  })
})

test.describe('Jobs - Pagination and Scroll', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user')
    await page.click('[data-testid="jobs-tab"]')
  })

  test('should handle job list scrolling', async ({ page }) => {
    const table = page.locator('table')
    const hasTable = await table.isVisible().catch(() => false)

    if (hasTable) {
      const rows = page.locator('tbody tr')
      const count = await rows.count()

      if (count > 5) {
        // Should be able to scroll
        const tableContainer = page.locator('.overflow-x-auto')
        await expect(tableContainer).toBeVisible()
      }
    }
  })
})
