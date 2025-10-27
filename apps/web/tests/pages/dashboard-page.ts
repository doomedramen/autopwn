import { Page } from '@playwright/test';
import { BasePage } from './base-page';

export class DashboardPage extends BasePage {
  private readonly userMenu = '[data-testid="user-menu"], [data-testid="avatar-dropdown"]';
  private readonly logoutButton = 'text=Log out';
  private readonly navigationLinks = '.navigation, nav, [data-testid="main-nav"], .flex.space-x-8[aria-label="Tabs"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Check if user is on dashboard
   */
  async isOnDashboard(): Promise<boolean> {
    // Check for dashboard-specific elements based on actual frontend
    const dashboardIndicators = [
      'h1:has-text("AutoPWN")', // App name in header
      'text=Network Security Platform', // App tagline
      '[data-testid="avatar-dropdown"]', // User avatar dropdown
      'nav[aria-label="Tabs"]', // Tab navigation
      '.stats-cards' // StatsCards component
    ];

    for (const indicator of dashboardIndicators) {
      try {
        if (await this.page.locator(indicator).isVisible({ timeout: 2000 })) {
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
   * Navigate to a specific section using tab navigation
   */
  async navigateTo(section: string): Promise<void> {
    // Look for the specific tab button using data-testid
    const tabButton = this.page.locator(`[data-testid="tab-${section}"]`, { timeout: 5000 });

    // Click the tab button
    await tabButton.click();

    // Wait for the tab to become active
    await this.page.waitForSelector(`[data-testid="tab-${section}"][data-tab="${section}"].text-primary`, { timeout: 5000 });

    // Wait a bit for the tab content to render
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if a specific tab is active
   */
  async isTabActive(section: string): Promise<boolean> {
    const tabButton = this.page.locator(`[data-testid="tab-${section}"]`);
    const isActive = await tabButton.evaluate(el =>
      el.classList.contains('border-primary') && el.classList.contains('text-primary')
    );
    return isActive;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await this.page.locator(this.userMenu).click();

    // Wait for dropdown to be visible
    await this.page.locator('[data-testid="avatar-dropdown"] [role="menu"]').isVisible({ timeout: 5000 });

    await this.page.locator(this.logoutButton).click();

    // Wait for redirect to login page
    await this.page.waitForURL('/sign-in', { timeout: 15000 });
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