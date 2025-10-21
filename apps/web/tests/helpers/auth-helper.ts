import { Page, APIRequestContext, expect } from '@playwright/test';

export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Performs login with given credentials
   */
  async login(email: string, password: string): Promise<void> {
    await this.page.goto('/auth/sign-in');
    
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    
    await this.page.click('button[type="submit"]');
    
    // Wait for successful login
    await this.page.waitForURL('/', { timeout: 15000 });
    await expect(this.page.locator('h1, text=AutoPWN')).toBeVisible({ timeout: 5000 });
  }

  /**
   * Performs logout
   */
  async logout(): Promise<void> {
    // Assuming there's a logout button/profile dropdown in the header
    await this.page.locator('[data-testid="user-menu"], [aria-label="User menu"]').click();
    await this.page.locator('text=Sign Out, Logout').click();
    
    // Wait for redirect to login page
    await this.page.waitForURL('/auth/sign-in', { timeout: 5000 });
  }

  /**
   * Checks if user is currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      // Check for presence of authentication indicators
      const isLoggedIn = await this.page.locator('[data-testid="user-menu"], [aria-label="User menu"]').isVisible({ timeout: 2000 });
      return isLoggedIn;
    } catch {
      return false;
    }
  }

  /**
   * Gets session information from browser
   */
  async getSessionInfo(): Promise<{
    cookies: any[];
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
  }> {
    const cookies = await this.page.context().cookies();
    const localStorage = await this.page.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          storage[key] = localStorage.getItem(key) || '';
        }
      }
      return storage;
    });

    const sessionStorage = await this.page.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          storage[key] = sessionStorage.getItem(key) || '';
        }
      }
      return storage;
    });

    return { cookies, localStorage, sessionStorage };
  }
}