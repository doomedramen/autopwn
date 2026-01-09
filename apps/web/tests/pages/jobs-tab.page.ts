import { Page, Locator, expect } from '@playwright/test';

/**
 * Jobs Tab Page Object
 * Encapsulates interactions with the jobs tab
 */
export class JobsTabPage {
  readonly page: Page;

  // Tab element
  readonly tab: Locator;
  readonly content: Locator;

  // Action buttons
  readonly createJobButton: Locator;

  // Table elements
  readonly jobsTable: Locator;
  readonly tableRows: Locator;
  readonly emptyState: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;

    // Tab navigation
    this.tab = page.locator('[data-testid="jobs-tab"]');
    this.content = page.locator('[data-testid="jobs-content"]');

    // Action buttons
    this.createJobButton = page.locator('[data-testid="create-job-button"]');

    // Table
    this.jobsTable = page.locator('[data-testid="jobs-tab"] table');
    this.tableRows = page.locator('[data-testid="jobs-tab"] table tbody tr');
    this.emptyState = page.locator('[data-testid="jobs-empty-state"]');
    this.loadingIndicator = page.locator('.animate-spin');
  }

  async navigateToTab() {
    await this.tab.click();
    await this.page.waitForLoadState('networkidle');
    await expect(this.content).toBeVisible({ timeout: 10000 });
  }

  async isActive(): Promise<boolean> {
    const tabClass = await this.tab.getAttribute('class');
    return tabClass?.includes('border-primary') ?? false;
  }

  async waitForLoaded() {
    await expect(this.loadingIndicator).not.toBeVisible({ timeout: 15000 });
  }

  async getJobCount(): Promise<number> {
    await this.waitForLoaded();
    if (await this.emptyState.isVisible()) {
      return 0;
    }
    return this.tableRows.count();
  }

  async getJobByName(name: string): Promise<Locator | null> {
    const rows = this.tableRows;
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const text = await row.textContent();
      if (text?.includes(name)) {
        return row;
      }
    }
    return null;
  }

  async getJobStatus(name: string): Promise<string | null> {
    const row = await this.getJobByName(name);
    if (row) {
      const statusCell = row.locator('td').nth(1); // Status is second column
      return statusCell.textContent();
    }
    return null;
  }

  async getJobProgress(name: string): Promise<number | null> {
    const row = await this.getJobByName(name);
    if (row) {
      const progressBar = row.locator('[role="progressbar"]');
      const ariaValueNow = await progressBar.getAttribute('aria-valuenow');
      return ariaValueNow ? parseFloat(ariaValueNow) : null;
    }
    return null;
  }

  async openJobDetails(name: string) {
    const row = await this.getJobByName(name);
    if (row) {
      const jobNameLink = row.locator('button').first();
      await jobNameLink.click();
    }
  }

  async openCreateJobModal() {
    await this.createJobButton.click();
  }

  async hasNoJobs(): Promise<boolean> {
    return this.emptyState.isVisible();
  }
}
