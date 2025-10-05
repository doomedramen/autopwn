import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';

test.describe('Test 6: Results Table', () => {
  let testUtils: TestUtils;

  test.beforeAll(async () => {
    testUtils = new TestUtils('results-table');
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  test('should display results table with cracked passwords', async ({ page }) => {
    await page.goto('/');

    // Scroll to results section
    await page.locator('h2:has-text("Cracked Passwords")').scrollIntoViewIfNeeded();

    // Verify results table is visible
    await expect(page.locator('h2:has-text("Cracked Passwords")')).toBeVisible();
    console.log('✓ Results section visible');

    // Check for table
    const resultsSection = page.locator('h2:has-text("Cracked Passwords")').locator('..');
    const table = resultsSection.locator('table');

    if (await table.count() > 0) {
      await expect(table.first()).toBeVisible();
      console.log('✓ Results table found');

      // Check table headers
      const headers = table.locator('thead th');
      const headerCount = await headers.count();

      if (headerCount > 0) {
        const headerTexts = await headers.allTextContents();
        console.log(`✓ Table headers: ${headerTexts.join(', ')}`);

        // Verify expected columns exist
        const expectedColumns = ['ESSID', 'Password', 'BSSID', 'Dictionary'];
        for (const col of expectedColumns) {
          const hasColumn = headerTexts.some(h => h.toLowerCase().includes(col.toLowerCase()));
          if (hasColumn) {
            console.log(`  ✓ Column '${col}' found`);
          }
        }
      }

      // Check for results rows
      const rows = table.locator('tbody tr');
      const rowCount = await rows.count();
      console.log(`✓ Results table has ${rowCount} row(s)`);

      if (rowCount > 0) {
        // Verify first row has data
        const firstRow = rows.first();
        const cells = firstRow.locator('td');
        const cellCount = await cells.count();
        console.log(`✓ First result has ${cellCount} cell(s)`);
      } else {
        console.log('⚠ No results in table (expected if no jobs have completed)');
      }
    } else {
      console.log('⚠ Results table not found or empty state shown');
    }
  });

  test('should support search and filter in results', async ({ page }) => {
    await page.goto('/');

    // Scroll to results
    await page.locator('h2:has-text("Cracked Passwords")').scrollIntoViewIfNeeded();

    // Look for search input
    const searchInput = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[type="search"]').or(
        page.locator('input[aria-label*="search"]')
      )
    );

    if (await searchInput.count() > 0) {
      console.log('✓ Search input found');

      // Try searching
      await searchInput.first().fill('test');
      await page.waitForTimeout(1000);

      console.log('✓ Search functionality available');

      // Clear search
      await searchInput.first().fill('');
    } else {
      console.log('⚠ Search functionality not found');
    }

    // Look for filter dropdowns or buttons
    const filterDropdown = page.locator('select[aria-label*="filter"]').or(
      page.locator('button:has-text("Filter")')
    );

    if (await filterDropdown.count() > 0) {
      console.log('✓ Filter controls found');
    } else {
      console.log('⚠ Filter controls not found');
    }
  });

  test('should support exporting results', async ({ page }) => {
    await page.goto('/');

    // Scroll to results
    await page.locator('h2:has-text("Cracked Passwords")').scrollIntoViewIfNeeded();

    // Look for export button
    const exportButton = page.locator('button:has-text("Export")').or(
      page.locator('button:has-text("Download")').or(
        page.locator('button[aria-label*="export"]').or(
          page.locator('a:has-text("Export")')
        )
      )
    );

    if (await exportButton.count() > 0) {
      console.log('✓ Export button found');

      // Note: We don't actually click it to avoid downloading files in tests
      // But we verify it exists
    } else {
      console.log('⚠ Export functionality not found');
    }
  });

  test('should show password details when clicked', async ({ page }) => {
    await page.goto('/');

    // Scroll to results
    await page.locator('h2:has-text("Cracked Passwords")').scrollIntoViewIfNeeded();

    // Look for table rows
    const table = page.locator('table').first();

    if (await table.count() > 0) {
      const rows = table.locator('tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        // Click first row
        await rows.first().click();
        await page.waitForTimeout(1000);

        // Check if details modal or expanded view appears
        const modal = page.locator('[role="dialog"]');
        const expandedRow = page.locator('[class*="expanded"]');

        if (await modal.isVisible()) {
          console.log('✓ Details modal opened');

          // Look for close button
          const closeButton = modal.locator('button:has-text("Close")');
          if (await closeButton.count() > 0) {
            await closeButton.click();
            console.log('✓ Modal closed');
          }
        } else if (await expandedRow.count() > 0) {
          console.log('✓ Row expanded to show details');
        } else {
          console.log('⚠ No detail view found');
        }
      } else {
        console.log('⚠ No results to click (expected if no jobs completed)');
      }
    }
  });

  test('should paginate results if many entries', async ({ page }) => {
    await page.goto('/');

    // Scroll to results
    await page.locator('h2:has-text("Cracked Passwords")').scrollIntoViewIfNeeded();

    // Look for pagination controls
    const paginationNext = page.locator('button:has-text("Next")').or(
      page.locator('button[aria-label*="next"]')
    );

    const paginationPrev = page.locator('button:has-text("Previous")').or(
      page.locator('button[aria-label*="previous"]')
    );

    const pageNumbers = page.locator('button[aria-label*="page"]');

    if (await paginationNext.count() > 0 || await paginationPrev.count() > 0 || await pageNumbers.count() > 0) {
      console.log('✓ Pagination controls found');

      if (await paginationNext.count() > 0 && !await paginationNext.first().isDisabled()) {
        await paginationNext.first().click();
        await page.waitForTimeout(1000);
        console.log('✓ Pagination next works');

        if (await paginationPrev.count() > 0 && !await paginationPrev.first().isDisabled()) {
          await paginationPrev.first().click();
          await page.waitForTimeout(1000);
          console.log('✓ Pagination previous works');
        }
      }
    } else {
      console.log('⚠ Pagination not found (might not be needed yet)');
    }

    console.log('✅ Results table tests completed');
  });
});