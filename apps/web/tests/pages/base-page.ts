import { Page, Locator } from '@playwright/test';

/**
 * Base Page class containing common methods for all pages
 */
export class BasePage {
  constructor(protected page: Page) {}

  /**
   * Navigate to a given URL
   */
  async navigate(url: string): Promise<void> {
    await this.page.goto(url);
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Wait for page to load completely
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Find an element by text
   */
  getByText(text: string): Locator {
    return this.page.locator(`text=${text}`);
  }

  /**
   * Find an element by test id
   */
  getByTestId(testId: string): Locator {
    return this.page.locator(`[data-testid="${testId}"]`);
  }

  /**
   * Find an element by CSS selector
   */
  getBySelector(selector: string): Locator {
    return this.page.locator(selector);
  }

  /**
   * Wait for URL to match a pattern
   */
  async waitForUrl(pattern: string | RegExp): Promise<void> {
    await this.page.waitForURL(pattern);
  }

  /**
   * Reload current page
   */
  async reload(): Promise<void> {
    await this.page.reload();
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    const element = this.page.locator(selector);
    return await element.count() > 0;
  }

  /**
   * Wait for element to be visible
   */
  async waitForElementVisible(selector: string, timeout: number = 10000): Promise<Locator> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    return element;
  }

  /**
   * Wait for element to be hidden
   */
  async waitForElementHidden(selector: string, timeout: number = 10000): Promise<void> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'hidden', timeout });
  }
}