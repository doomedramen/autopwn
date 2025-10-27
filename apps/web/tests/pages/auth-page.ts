import { Page } from '@playwright/test';
import { BasePage } from './base-page';

export class AuthPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoSignIn() {
    await this.page.goto('/sign-in');
    await this.waitForPageLoad();
  }

  async gotoSignUp() {
    await this.page.goto('/sign-up');
    await this.waitForPageLoad();
  }

  async signIn(email: string, password: string) {
    await this.page.locator('input[name="email"]').fill(email);
    await this.page.locator('input[name="password"]').fill(password);
    await this.page.locator('button[type="submit"]').click();
  }

  async signUp(email: string, password: string, name?: string) {
    await this.page.locator('input[name="email"]').fill(email);
    if (name) {
      await this.page.locator('input[name="name"]').fill(name);
    }
    await this.page.locator('input[name="password"]').fill(password);
    await this.page.locator('button[type="submit"]').click();
  }

  async isSignedIn(): Promise<boolean> {
    // Check for presence of user menu, logout button, or other authenticated indicators
    const signOutButton = this.page.locator('text=Log out');
    return await signOutButton.isVisible();
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }
}