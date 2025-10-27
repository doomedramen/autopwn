/**
 * Test environment configuration
 */
export class TestEnvironment {
  static readonly BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  static readonly ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@autopwn.local';
  static readonly ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';
  static readonly DEFAULT_TIMEOUT = 30000;
  static readonly RETRY_ATTEMPTS = 2;

  /**
   * Check if running in CI environment
   */
  static isCI(): boolean {
    return !!process.env.CI;
  }

  /**
   * Get appropriate timeout based on environment
   */
  static getTimeout(): number {
    return this.isCI() ? this.DEFAULT_TIMEOUT * 2 : this.DEFAULT_TIMEOUT;
  }

  /**
   * Get appropriate retry attempts based on environment
   */
  static getRetryAttempts(): number {
    return this.isCI() ? this.RETRY_ATTEMPTS + 1 : this.RETRY_ATTEMPTS;
  }
}