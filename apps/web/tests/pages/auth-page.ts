import { Page } from '@playwright/test';
import { BasePage } from './base-page';

export class AuthPage extends BasePage {
  private readonly emailInput = 'input[name="email"]';
  private readonly passwordInput = 'input[name="password"]';
  private readonly submitButton = 'button[type="submit"]';
  private readonly signInLink = 'a[href="/auth/sign-in"]';
  private readonly signUpLink = 'a[href="/auth/sign-up"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to sign in page
   */
  async goToSignIn(): Promise<void> {
    await this.navigate('/auth/sign-in');
  }

  /**
   * Navigate to sign up page
   */
  async goToSignUp(): Promise<void> {
    await this.navigate('/auth/sign-up');
  }

  /**
   * Sign in with credentials
   */
  async signIn(email: string, password: string): Promise<void> {
    await this.page.fill(this.emailInput, email);
    await this.page.fill(this.passwordInput, password);
    await this.page.click(this.submitButton);
  }

  /**
   * Get error message if any
   */
  async getErrorMessage(): Promise<string | null> {
    // Different selectors may be used depending on your UI framework
    const errorSelectors = [
      '[data-testid="error-message"]',
      '.error-message',
      '[role="alert"]',
      'text=Invalid',
      'text=Error'
    ];
    
    for (const selector of errorSelectors) {
      try {
        const element = await this.page.locator(selector).first();
        if (await element.isVisible()) {
          return await element.textContent();
        }
      } catch (e) {
        // Continue to next selector if current one doesn't exist
        continue;
      }
    }
    
    return null;
  }

  /**
   * Check if sign in form is visible
   */
  async isSignInFormVisible(): Promise<boolean> {
    return await this.page.locator(this.emailInput).isVisible() && 
           await this.page.locator(this.passwordInput).isVisible();
  }

  /**
   * Check if on sign in page
   */
  async isOnSignInPage(): Promise<boolean> {
    return this.page.url().includes('/auth/sign-in');
  }

  /**
   * Check if on sign up page
   */
  async isOnSignUpPage(): Promise<boolean> {
    return this.page.url().includes('/auth/sign-up');
  }
}