import { Page, Locator } from '@playwright/test';

/**
 * Common test utilities
 */
export class TestUtils {
  /**
   * Wait for network idle with a timeout
   */
  static async waitForNetworkIdle(page: Page, timeout: number = 10000): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Wait for a specific API request to complete
   */
  static async waitForApiRequest(
    page: Page,
    urlPattern: string | RegExp,
    timeout: number = 10000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`API request to ${urlPattern} did not complete within ${timeout}ms`));
      }, timeout);

      page.on('request', request => {
        if (request.url().match(urlPattern)) {
          request
            .response()
            .then(() => {
              clearTimeout(timeoutId);
              resolve();
            })
            .catch(() => {
              // Ignore response errors
            });
        }
      });
    });
  }

  /**
   * Retry an action with a specified number of attempts
   */
  static async retry<T>(
    action: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await action();
      } catch (error) {
        lastError = error as Error;
        if (attempt === maxAttempts) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Wait for element to be visible with multiple possible selectors
   */
  static async waitForAnyElement(
    page: Page,
    selectors: string[],
    timeout: number = 10000
  ): Promise<Locator | null> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`None of the elements were visible within ${timeout}ms: ${selectors.join(', ')}`));
      }, timeout);

      const checkElements = async () => {
        for (const selector of selectors) {
          try {
            const element = page.locator(selector);
            if (await element.isVisible({ timeout: 100 })) {
              clearTimeout(timeoutId);
              resolve(element);
              return;
            }
          } catch (e) {
            // Continue to next selector
            continue;
          }
        }
        
        setTimeout(checkElements, 500);
      };

      checkElements();
    });
  }

  /**
   * Generate random test data
   */
  static generateRandomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate random email
   */
  static generateRandomEmail(): string {
    return `user${this.generateRandomString(5)}@example.com`;
  }

  /**
   * Take screenshot with timestamp
   */
  static async takeScreenshotWithTimestamp(
    page: Page,
    name: string,
    options?: { path?: string; fullPage?: boolean }
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${name}_${timestamp}.png`;
    const path = options?.path ? `${options.path}/${fileName}` : fileName;

    await page.screenshot({
      path,
      fullPage: options?.fullPage ?? false,
    });

    return path;
  }

  /**
   * Wait for modal to appear and return its locator
   */
  static async waitForModal(page: Page, timeout: number = 5000): Promise<Locator> {
    // Common modal selectors
    const modalSelectors = [
      '[role="dialog"]',
      '.modal',
      '[data-testid="modal"]',
      '.overlay'
    ];

    for (const selector of modalSelectors) {
      try {
        const modal = page.locator(selector).first();
        await modal.waitFor({ state: 'visible', timeout: timeout / modalSelectors.length });
        return modal;
      } catch (e) {
        continue; // Try next selector
      }
    }

    throw new Error('No modal found within timeout period');
  }

  /**
   * Wait for toast notification
   */
  static async waitForNotification(page: Page, timeout: number = 5000): Promise<Locator> {
    // Common notification/toast selectors
    const notificationSelectors = [
      '[data-testid="notification"]',
      '.toast',
      '.notification',
      '[role="alert"]'
    ];

    for (const selector of notificationSelectors) {
      try {
        const notification = page.locator(selector).first();
        await notification.waitFor({ state: 'visible', timeout: timeout / notificationSelectors.length });
        return notification;
      } catch (e) {
        continue; // Try next selector
      }
    }

    throw new Error('No notification found within timeout period');
  }
}