/**
 * Navigation helpers for E2E testing
 */

import type { Page } from '@playwright/test'

/**
 * Tab identifiers in the dashboard
 */
export const tabs = {
  networks: 'networks',
  dictionaries: 'dictionaries',
  jobs: 'jobs',
  results: 'results',
  users: 'users',
  admin: 'admin',
} as const

export type TabId = keyof typeof tabs

/**
 * Navigate to a specific tab in the dashboard
 */
export async function goToTab(page: Page, tabId: TabId) {
  const tabSelector = `[data-testid="${tabId}-tab"]`
  await page.click(tabSelector)

  // Wait for the tab content to be visible
  await page.waitForSelector(`[data-testid="${tabId}-content"]`, { timeout: 5000 })
}

/**
 * Get the currently active tab
 */
export async function getActiveTab(page: Page): Promise<TabId | null> {
  const activeTab = await page.locator('[data-testid$="-tab"][aria-selected="true"]').first()
  const testId = await activeTab.getAttribute('data-testid')
  if (!testId) return null
  return testId.replace('-tab', '') as TabId
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(page: Page) {
  await page.waitForLoadState('domcontentloaded')
}

/**
 * Navigate to the dashboard
 */
export async function goToDashboard(page: Page) {
  await page.goto('/')
  await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 })
}

/**
 * Navigate to sign in page
 */
export async function goToSignIn(page: Page) {
  await page.goto('/sign-in')
  await page.waitForSelector('input[name="email"]', { timeout: 5000 })
}

/**
 * Navigate to sign up page
 */
export async function goToSignUp(page: Page) {
  await page.goto('/sign-up')
  await page.waitForSelector('input[name="email"]', { timeout: 5000 })
}

/**
 * Navigate to a specific modal
 */
export async function openModal(page: Page, modalId: string) {
  await page.click(`[data-testid="open-${modalId}"]`)
  await page.waitForSelector(`[data-testid="${modalId}-modal"]`, { timeout: 5000 })
}

/**
 * Close a modal
 */
export async function closeModal(page: Page, modalId: string) {
  await page.click(`[data-testid="${modalId}-modal"] button[aria-label="Close"]`)
  await page.waitForSelector(`[data-testid="${modalId}-modal"]`, { state: 'hidden', timeout: 5000 })
}

/**
 * Wait for a toast/notification message
 */
export async function waitForToast(
  page: Page,
  message: string,
  timeout: number = 5000,
) {
  await page.waitForSelector(`[data-testid="toast"]:has-text("${message}")`, { timeout })
}

/**
 * Wait for a loading state to complete
 */
export async function waitForLoading(page: Page, timeout: number = 30000) {
  await page.waitForSelector('[data-testid="loading"]', { state: 'hidden', timeout })
}

/**
 * Check if element is visible
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  const element = page.locator(selector).first()
  return await element.isVisible().catch(() => false)
}

/**
 * Wait for element to be visible
 */
export async function waitForVisible(
  page: Page,
  selector: string,
  timeout: number = 5000,
) {
  await page.waitForSelector(selector, { state: 'visible', timeout })
}

/**
 * Wait for element to be hidden
 */
export async function waitForHidden(
  page: Page,
  selector: string,
  timeout: number = 5000,
) {
  await page.waitForSelector(selector, { state: 'hidden', timeout })
}

/**
 * Fill a form field by label
 */
export async function fillByLabel(page: Page, label: string, value: string) {
  await page.fill(`label:has-text("${label}") + input, [aria-label="${label}"]`, value)
}

/**
 * Select an option from a dropdown
 */
export async function selectOption(page: Page, selector: string, value: string) {
  await page.selectOption(selector, value)
}

/**
 * Click a button by its text content
 */
export async function clickButton(page: Page, text: string) {
  await page.click(`button:has-text("${text}")`)
}

/**
 * Get text content of an element
 */
export async function getText(page: Page, selector: string): Promise<string> {
  const element = page.locator(selector).first()
  return await element.textContent() || ''
}

/**
 * Get attribute value
 */
export async function getAttribute(
  page: Page,
  selector: string,
  attribute: string,
): Promise<string | null> {
  const element = page.locator(selector).first()
  return await element.getAttribute(attribute)
}

/**
 * Count elements matching selector
 */
export async function countElements(page: Page, selector: string): Promise<number> {
  return await page.locator(selector).count()
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(page: Page, selector: string) {
  await page.locator(selector).first().scrollIntoViewIfNeeded()
}

/**
 * Take a screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  await page.screenshot({ path: `test-screenshots/${name}-${timestamp}.png` })
}
