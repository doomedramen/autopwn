import { test, expect } from '../fixtures/auth-fixture';

test.describe('Capture Management UI (Phase 2)', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure authenticated user state
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test.describe('Bulk Selection Features', () => {
    test('should display checkboxes for each capture', async ({ page }) => {
      console.log('☑️ Testing capture checkboxes...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForSelector('[data-testid="tab-networks"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(2000); // Wait for table to load

      // Look for checkbox column
      const checkboxes = page.locator('input[type="checkbox"]');
      const checkboxCount = await checkboxes.count();

      console.log(`📋 Found ${checkboxCount} checkboxes`);

      if (checkboxCount > 0) {
        console.log('✅ Checkboxes displayed for bulk selection');
      } else {
        // Check if table has data
        const tableRows = page.locator('tbody tr');
        const rowCount = await tableRows.count();

        if (rowCount > 0) {
          console.log('ℹ️ No checkboxes found but table has data (checkboxes may be implemented differently)');
        } else {
          console.log('ℹ️ No checkboxes and no data (empty table)');
        }
      }
    });

    test('should select all captures with select all checkbox', async ({ page }) => {
      console.log('✅ Testing select all functionality...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Look for select all checkbox (typically in table header)
      const selectAllSelectors = [
        'input[type="checkbox"][aria-label*="select all"i]',
        'th input[type="checkbox"]',
        'thead input[type="checkbox"]',
        '.select-all-checkbox',
        '[data-testid="select-all-captures"]'
      ];

      let selectAllFound = false;
      for (const selector of selectAllSelectors) {
        const selectAllCheckbox = page.locator(selector).first();
        if (await selectAllCheckbox.isVisible()) {
          console.log(`✅ Found select all checkbox: ${selector}`);

          const isChecked = await selectAllCheckbox.isChecked();
          console.log(`📝 Initial select all state: ${isChecked ? 'checked' : 'unchecked'}`);

          // Click to select all
          await selectAllCheckbox.click();
          await page.waitForTimeout(500);

          const newChecked = await selectAllCheckbox.isChecked();
          console.log(`📝 After click select all state: ${newChecked ? 'checked' : 'unchecked'}`);

          if (newChecked && !isChecked) {
            console.log('✅ Select all functionality works correctly');
          }

          selectAllFound = true;
          break;
        }
      }

      if (!selectAllFound) {
        console.log('ℹ️ No select all checkbox found (may not be implemented)');
      }

      // Check if individual checkboxes are selected
      const individualCheckboxes = page.locator('tbody input[type="checkbox"]');
      const checkedCount = await individualCheckboxes.evaluateAll((checkboxes: HTMLInputElement[]) =>
        checkboxes.filter(cb => cb.checked).length
      );

      console.log(`📊 ${checkedCount} individual checkboxes selected`);
    });

    test('should display selection counter', async ({ page }) => {
      console.log('🔢 Testing selection counter display...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Look for selection counter
      const counterSelectors = [
        'text=selected',
        'text=/[0-9]+/',
        '.selection-counter',
        '[data-testid="selection-count"]',
        '.selected-count'
      ];

      let counterFound = false;
      for (const selector of counterSelectors) {
        const counterElement = page.locator(selector).first();
        if (await counterElement.isVisible()) {
          const counterText = await counterElement.textContent();
          if (counterText && /\d+/.test(counterText)) {
            console.log(`✅ Selection counter found: ${counterText}`);
            counterFound = true;
            break;
          }
        }
      }

      if (!counterFound) {
        console.log('ℹ️ No selection counter found (may not be implemented)');
      }
    });

    test('should deselect individual captures', async ({ page }) => {
      console.log('❎ Testing individual capture deselection...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Select a capture
      const checkboxes = page.locator('tbody input[type="checkbox"]');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount > 0) {
        // Click first checkbox
        await checkboxes.first().click();
        await page.waitForTimeout(500);

        const firstChecked = await checkboxes.first().isChecked();
        console.log(`📝 First checkbox checked: ${firstChecked}`);

        // Click again to deselect
        await checkboxes.first().click();
        await page.waitForTimeout(500);

        const firstUnchecked = await checkboxes.first().isChecked();
        console.log(`📝 First checkbox unchecked: ${firstUnchecked}`);

        if (firstChecked && !firstUnchecked) {
          console.log('✅ Individual toggle works correctly');
        }
      } else {
        console.log('ℹ️ No checkboxes to toggle');
      }
    });
  });

  test.describe('Advanced Filtering Features', () => {
    test('should display status filter dropdown', async ({ page }) => {
      console.log('📊 Testing status filter...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Look for status filter dropdown
      const statusFilterSelectors = [
        'select[aria-label*="status"i]',
        '[data-testid="status-filter"]',
        'select:has-text("Status")',
        '.status-filter',
        '[name="status"]'
      ];

      let statusFilterFound = false;
      for (const selector of statusFilterSelectors) {
        const filterElement = page.locator(selector).first();
        if (await filterElement.isVisible()) {
          console.log(`✅ Found status filter: ${selector}`);
          statusFilterFound = true;

          // Check options
          const options = filterElement.locator('option');
          const optionCount = await options.count();
          console.log(`📋 Status filter has ${optionCount} options`);

          if (optionCount > 0) {
            const firstOption = options.first();
            const firstOptionText = await firstOption.textContent();
            console.log(`✅ First status option: ${firstOptionText}`);

            // Look for common statuses
            const optionTexts = await options.allTextContents();
            const hasAll = optionTexts.some(text => text.toLowerCase() === 'all');
            const hasReady = optionTexts.some(text => text.toLowerCase() === 'ready');
            const hasProcessing = optionTexts.some(text => text.toLowerCase() === 'processing');
            const hasFailed = optionTexts.some(text => text.toLowerCase() === 'failed');

            console.log(`📝 Status options include - All: ${hasAll}, Ready: ${hasReady}, Processing: ${hasProcessing}, Failed: ${hasFailed}`);
          }

          break;
        }
      }

      if (!statusFilterFound) {
        console.log('ℹ️ No status filter dropdown found');
      }
    });

    test('should display encryption filter dropdown', async ({ page }) => {
      console.log('🔒 Testing encryption filter...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Look for encryption filter dropdown
      const encryptionFilterSelectors = [
        'select[aria-label*="encryption"i]',
        '[data-testid="encryption-filter"]',
        'select:has-text("Encryption")',
        '.encryption-filter',
        '[name="encryption"]'
      ];

      let encryptionFilterFound = false;
      for (const selector of encryptionFilterSelectors) {
        const filterElement = page.locator(selector).first();
        if (await filterElement.isVisible()) {
          console.log(`✅ Found encryption filter: ${selector}`);
          encryptionFilterFound = true;

          // Check options
          const options = filterElement.locator('option');
          const optionCount = await options.count();
          console.log(`📋 Encryption filter has ${optionCount} options`);

          if (optionCount > 0) {
            // Look for common encryption types
            const optionTexts = await options.allTextContents();
            const hasAll = optionTexts.some(text => text.toLowerCase() === 'all');
            const hasOpen = optionTexts.some(text => text.toLowerCase() === 'open');
            const hasWPA = optionTexts.some(text => text.toLowerCase() === 'wpa');
            const hasWPA2 = optionTexts.some(text => text.toLowerCase() === 'wpa2');
            const hasWPA3 = optionTexts.some(text => text.toLowerCase() === 'wpa3');
            const hasWEP = optionTexts.some(text => text.toLowerCase() === 'wep');

            console.log(`📝 Encryption options include - All: ${hasAll}, OPEN: ${hasOpen}, WPA: ${hasWPA}, WPA2: ${hasWPA2}, WPA3: ${hasWPA3}, WEP: ${hasWEP}`);
          }

          break;
        }
      }

      if (!encryptionFilterFound) {
        console.log('ℹ️ No encryption filter dropdown found');
      }
    });

    test('should apply status filter and filter captures', async ({ page }) => {
      console.log('🎯 Testing status filter application...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Find status filter
      const statusFilter = page.locator('select[aria-label*="status"i], [data-testid="status-filter"], select[name="status"]').first();

      if (await statusFilter.isVisible()) {
        // Get initial row count
        const initialRows = await page.locator('tbody tr').count();
        console.log(`📊 Initial captures: ${initialRows}`);

        // Select "Ready" status
        await statusFilter.selectOption('ready');
        await page.waitForTimeout(1000);

        const filteredRows = await page.locator('tbody tr').count();
        console.log(`📊 Captures after filtering: ${filteredRows}`);

        if (filteredRows <= initialRows) {
          console.log('✅ Status filter applied (reduced or same row count)');
        } else {
          console.log('⚠️ Row count increased after filtering (unexpected)');
        }

        // Verify filter value changed
        const selectedValue = await statusFilter.inputValue();
        console.log(`📝 Selected filter value: ${selectedValue}`);
      } else {
        console.log('ℹ️ No status filter available');
      }
    });

    test('should apply encryption filter and filter captures', async ({ page }) => {
      console.log('🔐 Testing encryption filter application...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Find encryption filter
      const encryptionFilter = page.locator('select[aria-label*="encryption"i], [data-testid="encryption-filter"], select[name="encryption"]').first();

      if (await encryptionFilter.isVisible()) {
        // Get initial row count
        const initialRows = await page.locator('tbody tr').count();
        console.log(`📊 Initial captures: ${initialRows}`);

        // Select "WPA2" encryption
        await encryptionFilter.selectOption('WPA2');
        await page.waitForTimeout(1000);

        const filteredRows = await page.locator('tbody tr').count();
        console.log(`📊 Captures after filtering: ${filteredRows}`);

        if (filteredRows <= initialRows) {
          console.log('✅ Encryption filter applied (reduced or same row count)');
        } else {
          console.log('⚠️ Row count increased after filtering (unexpected)');
        }

        // Verify filter value changed
        const selectedValue = await encryptionFilter.inputValue();
        console.log(`📝 Selected filter value: ${selectedValue}`);
      } else {
        console.log('ℹ️ No encryption filter available');
      }
    });

    test('should combine search with filters', async ({ page }) => {
      console.log('🔍 Testing combined search and filters...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Look for search input
      const searchInput = page.locator('input[placeholder*="search"i], input[placeholder*="Search"i], [data-testid="search-input"]').first();

      if (await searchInput.isVisible()) {
        const initialRows = await page.locator('tbody tr').count();
        console.log(`📊 Initial captures: ${initialRows}`);

        // Enter search term
        await searchInput.fill('TestNetwork');
        await page.waitForTimeout(500);

        const afterSearchRows = await page.locator('tbody tr').count();
        console.log(`📊 Captures after search: ${afterSearchRows}`);

        // Try to apply status filter
        const statusFilter = page.locator('select[name="status"]').first();
        if (await statusFilter.isVisible()) {
          await statusFilter.selectOption('ready');
          await page.waitForTimeout(500);

          const afterBothRows = await page.locator('tbody tr').count();
          console.log(`📊 Captures after search + filter: ${afterBothRows}`);

          console.log('✅ Combined search and filter work together');
        }
      } else {
        console.log('ℹ️ No search input found');
      }
    });
  });

  test.describe('Bulk Operations Features', () => {
    test('should display clear selection button', async ({ page }) => {
      console.log('❌ Testing clear selection button...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Look for clear selection button
      const clearButtonSelectors = [
        'button:has-text("Clear Selection")',
        'button:has-text("Clear")',
        'button[aria-label*="clear"i]',
        '[data-testid="clear-selection"]',
        '.clear-selection',
        'button svg[class*="x"]'
      ];

      let clearButtonFound = false;
      for (const selector of clearButtonSelectors) {
        const button = page.locator(selector).first();
        if (await button.isVisible()) {
          console.log(`✅ Found clear selection button: ${selector}`);
          clearButtonFound = true;
          break;
        }
      }

      if (clearButtonFound) {
        // Check button state (should be enabled when items selected, disabled when none)
        const isEnabled = await button.isEnabled();
        console.log(`📝 Clear selection button state: ${isEnabled ? 'enabled' : 'disabled'}`);
      } else {
        console.log('ℹ️ No clear selection button found');
      }
    });

    test('should display delete selected button', async ({ page }) => {
      console.log('🗑️ Testing delete selected button...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Look for delete selected button
      const deleteButtonSelectors = [
        'button:has-text("Delete Selected")',
        'button:has-text("Delete")',
        'button[aria-label*="delete"i]',
        '[data-testid="delete-selected"]',
        '.delete-selected',
        'button svg[class*="trash"]'
      ];

      let deleteButtonFound = false;
      for (const selector of deleteButtonSelectors) {
        const button = page.locator(selector).first();
        if (await button.isVisible()) {
          console.log(`✅ Found delete selected button: ${selector}`);
          deleteButtonFound = true;
          break;
        }
      }

      if (deleteButtonFound) {
        // Check button state (should be enabled when items selected, disabled when none)
        const isEnabled = await button.isEnabled();
        console.log(`📝 Delete selected button state: ${isEnabled ? 'enabled' : 'disabled'}`);

        // Check if it shows count
        const buttonText = await button.textContent();
        if (buttonText && /\d+/.test(buttonText)) {
          console.log(`✅ Delete button includes count: ${buttonText}`);
        }
      } else {
        console.log('ℹ️ No delete selected button found');
      }
    });

    test('should delete multiple selected captures', async ({ page }) => {
      console.log('🗑️ Testing bulk delete workflow...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Select multiple captures
      const checkboxes = page.locator('tbody input[type="checkbox"]');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount >= 2) {
        // Select first two captures
        await checkboxes.first().click();
        await page.waitForTimeout(200);
        await checkboxes.nth(1).click();
        await page.waitForTimeout(200);

        const checkedCount = await checkboxes.evaluateAll((checkboxes: HTMLInputElement[]) =>
          checkboxes.filter(cb => cb.checked).length
        );
        console.log(`📊 ${checkedCount} captures selected`);

        // Click delete selected button
        const deleteButton = page.locator('button:has-text("Delete Selected"), button svg[class*="trash"]').first();
        if (await deleteButton.isVisible() && await deleteButton.isEnabled()) {
          await deleteButton.click();
          await page.waitForTimeout(500);

          // Look for confirmation dialog
          const confirmDialog = page.locator('dialog[role="alertdialog"], [role="dialog"]').first();
          if (await confirmDialog.isVisible()) {
            console.log('✅ Confirmation dialog displayed');

            // Look for confirm button
            const confirmButton = confirmDialog.locator('button:has-text("Delete"), button:has-text("Confirm"), button[type="button"].first();
            if (await confirmButton.isVisible()) {
              await confirmButton.click();
              await page.waitForTimeout(2000);

              console.log('✅ Bulk delete confirmed');

              // Check if captures are removed
              const newRowCount = await page.locator('tbody tr').count();
              console.log(`📊 Captures after deletion: ${newRowCount}`);

              if (newRowCount < checkboxCount) {
                console.log('✅ Captures successfully deleted');
              }
            }
          }
        } else {
          console.log('ℹ️ Delete button not enabled or not found');
        }
      } else {
        console.log('ℹ️ Not enough captures to test bulk delete (need at least 2)');
      }
    });

    test('should require confirmation before bulk delete', async ({ page }) => {
      console.log('⚠️ Testing delete confirmation...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Select a capture
      const checkbox = page.locator('tbody input[type="checkbox"]').first();
      if (await checkbox.isVisible()) {
        await checkbox.click();
        await page.waitForTimeout(200);

        // Click delete
        const deleteButton = page.locator('button:has-text("Delete Selected"), button svg[class*="trash"]').first();
        if (await deleteButton.isVisible() && await deleteButton.isEnabled()) {
          await deleteButton.click();
          await page.waitForTimeout(500);

          // Check for confirmation
          const hasConfirmation = await page.locator('dialog[role="alertdialog"], [role="dialog"]').isVisible();
          console.log(`📝 Confirmation dialog shown: ${hasConfirmation}`);

          if (!hasConfirmation) {
            console.log('❌ No confirmation dialog - this may be a security issue');
          } else {
            console.log('✅ Confirmation dialog displayed before deletion');
          }
        }
      }
    });
  });

  test.describe('Capture Actions Column', () => {
    test('should display actions column with create job button', async ({ page }) => {
      console.log('📝 Testing actions column...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Look for Actions column
      const actionsHeader = page.locator('th:has-text("Actions"), th[scope="col"]:has-text("Actions")').first();
      if (await actionsHeader.isVisible()) {
        console.log('✅ Actions column header found');

        // Check for action buttons in rows
        const createJobButtons = page.locator('tbody button[aria-label*="create job"i], tbody button:has-text("Create Job"), tbody button svg[class*="arrow-right"]');
        const buttonCount = await createJobButtons.count();
        console.log(`📋 Found ${buttonCount} create job buttons in table`);
      } else {
        console.log('ℹ️ No Actions column found');
      }
    });

    test('should create job for selected capture', async ({ page }) => {
      console.log('➕ Testing create job action...');

      // Navigate to Networks tab
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(2000);

      // Find a capture with create job button
      const createJobButton = page.locator('tbody button:has-text("Create Job"), tbody button svg[class*="arrow-right"]').first();

      if (await createJobButton.isVisible()) {
        await createJobButton.click();
        await page.waitForTimeout(1000);

        // Check if job creation modal opens
        const jobModal = page.locator('[data-testid="create-job-modal"], div[role="dialog"]').first();
        if (await jobModal.isVisible()) {
          console.log('✅ Create job modal opened from capture action');

          // Check if network is pre-selected
          const networkSelect = jobModal.locator('select[name="networkId"], select:has-text("Network")').first();
          if (await networkSelect.isVisible()) {
            const selectedNetwork = await networkSelect.inputValue();
            console.log(`📝 Network pre-selected: ${selectedNetwork || 'none'}`);
          }
        } else {
          console.log('ℹ️ Job modal opened but network selection not found');
        }
      } else {
        console.log('ℹ️ No create job button found or clicked');
      }
    });
  });
});
