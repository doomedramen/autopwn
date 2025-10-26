import { Page } from '@playwright/test';
import { BasePage } from './base-page';

export class DashboardPage extends BasePage {
  private readonly userMenu = '[data-testid="user-menu"], [aria-label="User menu"]';
  private readonly logoutButton = 'text=Sign Out, text=Logout';
  private readonly navigationLinks = '.navigation, nav, [data-testid="main-nav"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Check if user is on dashboard
   */
  async isOnDashboard(): Promise<boolean> {
    // Check for dashboard-specific elements
    const dashboardIndicators = [
      'text=Dashboard',
      'text=AutoPWN', // Based on your app name
      '[data-testid="dashboard"]',
      '.dashboard',
      'h1:text("Dashboard")'
    ];
    
    for (const indicator of dashboardIndicators) {
      try {
        if (await this.page.locator(indicator).isVisible({ timeout: 3000 })) {
          return true;
        }
      } catch (e) {
        // Continue to next indicator
        continue;
      }
    }
    
    return false;
  }

  /**
   * Navigate to a specific section
   */
  async navigateTo(section: string): Promise<void> {
    // Assuming there are navigation links in the sidebar or header
    const navLink = this.page.locator(`a[href="/${section}"], text="${section}"`);
    await navLink.click();
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await this.page.locator(this.userMenu).click();
    await this.page.locator(this.logoutButton).click();
    
    // Wait for redirect to login page
    await this.page.waitForURL('/sign-in', { timeout: 10000 });
  }

  /**
   * Get user menu visibility
   */
  async isUserMenuVisible(): Promise<boolean> {
    return await this.page.locator(this.userMenu).isVisible();
  }

  /**
   * Check if navigation is available
   */
  async isNavigationAvailable(): Promise<boolean> {
    return await this.page.locator(this.navigationLinks).isVisible();
  }
}