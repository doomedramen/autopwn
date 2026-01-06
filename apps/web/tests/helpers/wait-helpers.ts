/**
 * Wait helpers for E2E testing
 */

import type { Page, Locator } from '@playwright/test'
import { waitDurations } from '../fixtures/test-data'

/**
 * Wait for a specific text to appear
 */
export async function waitForText(
  page: Page,
  selector: string,
  text: string,
  timeout: number = 10000,
) {
  await page.waitForSelector(`${selector}:has-text("${text}")`, { timeout })
}

/**
 * Wait for element to be enabled
 */
export async function waitForEnabled(
  page: Page,
  selector: string,
  timeout: number = 10000,
) {
  await page.waitForSelector(`${selector}:not(:disabled)`, { timeout })
}

/**
 * Wait for element to be disabled
 */
export async function waitForDisabled(
  page: Page,
  selector: string,
  timeout: number = 10000,
) {
  await page.waitForSelector(`${selector}:disabled`, { timeout })
}

/**
 * Wait for count of elements to match expected
 */
export async function waitForCount(
  page: Page,
  selector: string,
  expectedCount: number,
  timeout: number = 10000,
) {
  await page.waitForFunction(
    ({ selector, expected }) => {
      return document.querySelectorAll(selector).length === expected
    },
    { selector, expected: expectedCount },
    { timeout },
  )
}

/**
 * Wait for URL to contain a path
 */
export async function waitForUrl(
  page: Page,
  path: string,
  timeout: number = 10000,
) {
  await page.waitForURL(`**${path}**`, { timeout })
}

/**
 * Wait for API request to complete
 */
export async function waitForApiCall(
  page: Page,
  urlPattern: string,
  timeout: number = 30000,
) {
  await page.waitForResponse(
    (response) => response.url().includes(urlPattern) && response.status() < 500,
    { timeout },
  )
}

/**
 * Poll for a condition to be true
 */
export async function pollFor(
  condition: () => Promise<boolean> | boolean,
  timeout: number = 10000,
  interval: number = 500,
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}

/**
 * Wait for job status to change
 */
export async function waitForJobStatus(
  page: Page,
  jobId: string,
  expectedStatus: string,
  timeout: number = 120000,
) {
  await pollFor(
    async () => {
      const response = await page.evaluate(
        async ({ id }) => {
          const res = await fetch(`/api/jobs/${id}`)
          return await res.json()
        },
        { id: jobId },
      )
      return response?.data?.status === expectedStatus
    },
    timeout,
    2000,
  )
}

/**
 * Wait for table rows to load
 */
export async function waitForTableRows(
  page: Page,
  minRows: number = 1,
  timeout: number = 10000,
) {
  await page.waitForFunction(
    ({ min } ) => {
      const rows = document.querySelectorAll('table tbody tr')
      return rows.length >= min
    },
    { min: minRows },
    { timeout },
  )
}

/**
 * Wait for loading spinner to disappear
 */
export async function waitForLoadingToFinish(
  page: Page,
  selector: string = '[data-testid="loading"]',
  timeout: number = 30000,
) {
  try {
    await page.waitForSelector(selector, { state: 'hidden', timeout })
  } catch {
    // Selector might not exist at all, which is fine
  }
}

/**
 * Wait for and click an element
 */
export async function waitForAndClick(
  page: Page,
  selector: string,
  timeout: number = 10000,
) {
  await page.waitForSelector(selector, { state: 'visible', timeout })
  await page.click(selector)
}

/**
 * Wait for modal to close
 */
export async function waitForModalClose(
  page: Page,
  modalSelector: string,
  timeout: number = 5000,
) {
  await page.waitForSelector(modalSelector, { state: 'hidden', timeout })
}

/**
 * Retry a function until it succeeds
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error | undefined

  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Wait for file upload to complete
 */
export async function waitForUpload(
  page: Page,
  timeout: number = 60000,
) {
  // Wait for upload progress to complete
  await page.waitForSelector('[data-testid="upload-progress"][value="100"]', {
    timeout,
  }).catch(() => {
    // Upload might complete without progress indicator
  })

  // Wait for success message
  await page.waitForSelector('[data-testid="upload-success"]', {
    timeout: 5000,
  }).catch(() => {
    // Success message might be a toast instead
  })
}

/**
 * Wait for and confirm a dialog
 */
export async function waitForDialogAndAccept(
  page: Page,
  timeout: number = 5000,
) {
  page.once('dialog', (dialog) => dialog.accept())
  await page.waitForTimeout(100)
}

/**
 * Wait for and dismiss a dialog
 */
export async function waitForDialogAndDismiss(
  page: Page,
  timeout: number = 5000,
) {
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.waitForTimeout(100)
}

/**
 * Wait for element to have specific attribute value
 */
export async function waitForAttribute(
  page: Page,
  selector: string,
  attribute: string,
  value: string,
  timeout: number = 10000,
) {
  await page.waitForSelector(
    `${selector}[${attribute}="${value}"]`,
    { timeout },
  )
}

/**
 * Wait for element to contain specific text
 */
export async function waitForElementToContainText(
  page: Page,
  selector: string,
  text: string,
  timeout: number = 10000,
) {
  await page.waitForSelector(selector, { state: 'visible', timeout })
  await (page as any).waitForFunction(
    ([sel, expectedText]: [string, string]) => {
      const el = document.querySelector(sel)
      return el?.textContent?.includes(expectedText)
    },
    [selector, text],
    { timeout },
  )
}

/**
 * Wait for network idle (no pending requests)
 */
export async function waitForNetworkIdle(
  page: Page,
  timeout: number = 30000,
) {
  await page.waitForLoadState('networkidle', { timeout })
}

/**
 * Custom wait with condition function
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 10000,
  message: string = 'Condition not met',
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`)
}

/**
 * Pause for a specified duration
 */
export async function pause(duration: number = waitDurations.medium) {
  await new Promise((resolve) => setTimeout(resolve, duration))
}
