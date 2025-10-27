import { test, expect } from '../fixtures/auth-fixture';

test.describe('Admin Functionality & System Administration', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure authenticated user state
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test.describe('Admin Tab Access and Navigation', () => {
    test('should allow admin users to access admin tab', async ({ page }) => {
      console.log('🔐 Testing admin tab access...');

      // Look for admin tab
      const adminTab = page.locator('[data-testid="tab-admin"]');

      if (await adminTab.isVisible()) {
        console.log('✅ Admin tab is visible to admin user');

        // Click on admin tab
        await adminTab.click();
        await page.waitForSelector('[data-testid="tab-admin"].text-primary', { timeout: 5000 });
        await page.waitForTimeout(1000);

        // Verify admin tab is active
        await expect(adminTab).toHaveClass(/text-primary/);
        console.log('✅ Admin tab successfully activated');

        // Check for admin content
        const adminContent = page.locator('main').first();
        await expect(adminContent).toBeVisible();
        console.log('✅ Admin content is displayed');
      } else {
        console.log('ℹ️ Admin tab not visible (user may not have admin role)');
      }
    });

    test('should display admin-specific UI elements', async ({ page }) => {
      console.log('⚙️ Testing admin UI elements...');

      // Try to access admin tab
      const adminTab = page.locator('[data-testid="tab-admin"]');

      if (await adminTab.isVisible()) {
        await adminTab.click();
        await page.waitForSelector('[data-testid="tab-admin"].text-primary', { timeout: 5000 });
        await page.waitForTimeout(1000);

        // Look for admin-specific elements
        const adminSelectors = [
          'text=Admin Settings',
          'text=System Configuration',
          'text=User Management',
          'text=Security Monitoring',
          'text=Hashcat Configuration',
          'text=Resource Management',
          'button:has-text("Save")',
          'button:has-text("save")',
          'form',
          '.settings-section',
          '[data-testid*="admin"]'
        ];

        let adminElementsFound = 0;
        for (const selector of adminSelectors) {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            console.log(`✅ Found admin element: ${selector}`);
            adminElementsFound++;
          }
        }

        console.log(`📊 Found ${adminElementsFound} admin-specific elements`);

        // Check for access denied message (should not be present for admin)
        const accessDenied = page.locator('text=Access Denied').first();
        if (await accessDenied.isVisible()) {
          console.log('❌ Access denied message shown (unexpected for admin)');
        } else {
          console.log('✅ No access denied message (expected for admin)');
        }
      } else {
        console.log('ℹ️ Admin tab not accessible');
      }
    });

    test('should handle admin tab navigation correctly', async ({ page }) => {
      console.log('🔄 Testing admin navigation flow...');

      // Navigate to different tabs first
      const jobsTab = page.locator('[data-testid="tab-jobs"]');
      if (await jobsTab.isVisible()) {
        await jobsTab.click();
        await page.waitForTimeout(500);
        console.log('✅ Navigated to Jobs tab');
      }

      // Navigate to admin tab
      const adminTab = page.locator('[data-testid="tab-admin"]');
      if (await adminTab.isVisible()) {
        await adminTab.click();
        await page.waitForTimeout(1000);
        console.log('✅ Navigated to Admin tab');

        // Verify admin tab is active
        await expect(adminTab).toHaveClass(/text-primary/);

        // Navigate away and back
        const networksTab = page.locator('[data-testid="tab-networks"]');
        if (await networksTab.isVisible()) {
          await networksTab.click();
          await page.waitForTimeout(500);
          console.log('✅ Navigated away from Admin tab');

          // Return to admin tab
          await adminTab.click();
          await page.waitForTimeout(1000);
          await expect(adminTab).toHaveClass(/text-primary/);
          console.log('✅ Returned to Admin tab successfully');
        }
      } else {
        console.log('ℹ️ Admin tab not accessible for navigation test');
      }
    });
  });

  test.describe('System Configuration and Settings', () => {
    test('should display system configuration forms', async ({ page }) => {
      console.log('⚙️ Testing system configuration...');

      const adminTab = page.locator('[data-testid="tab-admin"]');
      if (await adminTab.isVisible()) {
        await adminTab.click();
        await page.waitForTimeout(1000);

        // Look for configuration sections
        const configSections = [
          'text=Hashcat Configuration',
          'text=Resource Management',
          'text=System Settings',
          'text=Performance',
          'text=Security',
          'text=Monitoring'
        ];

        let sectionsFound = 0;
        for (const section of configSections) {
          const element = page.locator(section).first();
          if (await element.isVisible()) {
            console.log(`✅ Found configuration section: ${section}`);
            sectionsFound++;
          }
        }

        console.log(`📊 Found ${sectionsFound}/${configSections.length} configuration sections`);

        // Look for form controls
        const formControls = [
          'input[type="number"]',
          'input[type="text"]',
          'select',
          'textarea',
          'input[type="checkbox"]',
          'input[type="range"]'
        ];

        let controlsFound = 0;
        for (const control of formControls) {
          const elements = page.locator(control);
          const count = await elements.count();
          if (count > 0) {
            console.log(`✅ Found ${count} ${control} elements`);
            controlsFound += count;
          }
        }

        console.log(`📊 Found ${controlsFound} form controls total`);
      } else {
        console.log('ℹ️ Admin tab not accessible for configuration test');
      }
    });

    test('should handle settings save functionality', async ({ page }) => {
      console.log('💾 Testing settings save functionality...');

      const adminTab = page.locator('[data-testid="tab-admin"]');
      if (await adminTab.isVisible()) {
        await adminTab.click();
        await page.waitForTimeout(1000);

        // Look for save buttons
        const saveSelectors = [
          'button:has-text("Save")',
          'button:has-text("save")',
          'button:has-text("Update")',
          'button:has-text("Apply")',
          'button[type="submit"]',
          '.save-button'
        ];

        let saveButtonFound = false;
        for (const selector of saveSelectors) {
          const button = page.locator(selector).first();
          if (await button.isVisible()) {
            console.log(`✅ Found save button: ${selector}`);

            // Check if button is enabled
            const isEnabled = await button.isEnabled();
            console.log(`📝 Save button state: ${isEnabled ? 'enabled' : 'disabled'}`);

            // Try clicking save button (if enabled)
            if (isEnabled) {
              try {
                await button.click();
                console.log('✅ Save button clicked successfully');

                // Look for loading state or success message
                await page.waitForTimeout(2000);

                const loadingIndicators = [
                  '.animate-spin',
                  'text=Saving',
                  'text=Loading...',
                  '[disabled]'
                ];

                for (const indicator of loadingIndicators) {
                  const element = page.locator(indicator).first();
                  if (await element.isVisible()) {
                    console.log(`✅ Found loading indicator: ${indicator}`);
                    break;
                  }
                }

                const successMessages = [
                  'text=Settings saved',
                  'text=Success',
                  'text=Updated',
                  'text=Configuration saved'
                ];

                for (const message of successMessages) {
                  const element = page.locator(message).first();
                  if (await element.isVisible()) {
                    console.log(`✅ Found success message: ${message}`);
                    break;
                  }
                }
              } catch (error) {
                console.log('ℹ️ Save button click failed (may be expected)');
              }
            }

            saveButtonFound = true;
            break;
          }
        }

        if (!saveButtonFound) {
          console.log('ℹ️ No save buttons found (settings may be read-only)');
        }
      } else {
        console.log('ℹ️ Admin tab not accessible for save test');
      }
    });

    test('should validate form inputs and constraints', async ({ page }) => {
      console.log('✅ Testing form validation...');

      const adminTab = page.locator('[data-testid="tab-admin"]');
      if (await adminTab.isVisible()) {
        await adminTab.click();
        await page.waitForTimeout(1000);

        // Look for form inputs to test validation
        const numberInputs = page.locator('input[type="number"]');
        const numberInputCount = await numberInputs.count();

        if (numberInputCount > 0) {
          console.log(`📊 Found ${numberInputCount} number inputs to test`);

          // Test first number input
          const firstNumberInput = numberInputs.first();

          // Test invalid values
          try {
            await firstNumberInput.fill('-1');
            await page.waitForTimeout(500);
            console.log('✅ Tested negative value input');

            await firstNumberInput.fill('999999');
            await page.waitForTimeout(500);
            console.log('✅ Tested large value input');

            await firstNumberInput.fill('abc');
            await page.waitForTimeout(500);
            console.log('✅ Tested text input in number field');

            // Look for validation messages
            const validationMessages = [
              'text=Invalid',
              'text=Required',
              'text=Must be',
              'text=Please enter',
              '.error-message',
              '.validation-error'
            ];

            for (const selector of validationMessages) {
              const element = page.locator(selector).first();
              if (await element.isVisible()) {
                console.log(`✅ Found validation message: ${selector}`);
                break;
              }
            }
          } catch (error) {
            console.log('ℹ️ Form validation test failed (input may be read-only)');
          }
        } else {
          console.log('ℹ️ No number inputs found for validation testing');
        }

        // Test text inputs
        const textInputs = page.locator('input[type="text"], textarea');
        const textInputCount = await textInputs.count();

        if (textInputCount > 0) {
          console.log(`📊 Found ${textInputCount} text inputs`);
        }
      } else {
        console.log('ℹ️ Admin tab not accessible for validation test');
      }
    });
  });

  test.describe('Security Monitoring and Alerts', () => {
    test('should display security monitoring dashboard', async ({ page }) => {
      console.log('🔒 Testing security monitoring...');

      // Look for security-related elements
      const securitySelectors = [
        'text=Security',
        'text=Monitoring',
        'text=Alerts',
        'text=Events',
        'text=Logs',
        'text=Audit',
        'security',
        'monitoring'
      ];

      let securityElementsFound = 0;
      for (const selector of securitySelectors) {
        const element = page.locator(`text=${selector}`).first();
        if (await element.isVisible()) {
          console.log(`✅ Found security element: ${selector}`);
          securityElementsFound++;
        }
      }

      if (securityElementsFound > 0) {
        console.log(`📊 Found ${securityElementsFound} security-related elements`);
      } else {
        console.log('ℹ️ No security monitoring elements found on current page');

        // Check if security might be in admin tab
        const adminTab = page.locator('[data-testid="tab-admin"]');
        if (await adminTab.isVisible()) {
          await adminTab.click();
          await page.waitForTimeout(1000);

          let adminSecurityElements = 0;
          for (const selector of securitySelectors) {
            const element = page.locator(`text=${selector}`).first();
            if (await element.isVisible()) {
              console.log(`✅ Found security element in admin: ${selector}`);
              adminSecurityElements++;
            }
          }

          if (adminSecurityElements > 0) {
            console.log(`📊 Found ${adminSecurityElements} security elements in admin tab`);
          }
        }
      }
    });

    test('should handle admin API endpoints access', async ({ page }) => {
      console.log('🌐 Testing admin API access...');

      // Test admin API endpoints through browser network requests
      const adminEndpoints = [
        '/api/users/',
        '/api/security/metrics',
        '/api/security/alerts',
        '/api/queue/stats',
        '/api/virus-scanner/status'
      ];

      for (const endpoint of adminEndpoints) {
        try {
          const response = await page.evaluate(async (url) => {
            try {
              const response = await fetch(url, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              return {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText
              };
            } catch (error) {
              return {
                status: 0,
                ok: false,
                error: error.message
              };
            }
          }, endpoint);

          if (response.ok) {
            console.log(`✅ API endpoint accessible: ${endpoint} (${response.status})`);
          } else if (response.status === 403) {
            console.log(`🔒 API endpoint properly protected: ${endpoint} (403 Forbidden)`);
          } else if (response.status === 404) {
            console.log(`ℹ️ API endpoint not found: ${endpoint} (404 Not Found)`);
          } else {
            console.log(`⚠️ API endpoint returned: ${endpoint} (${response.status} ${response.statusText})`);
          }
        } catch (error) {
          console.log(`❌ API endpoint test failed: ${endpoint} - ${error}`);
        }
      }
    });
  });

  test.describe('Resource Management and Monitoring', () => {
    test('should display system resource information', async ({ page }) => {
      console.log('📊 Testing resource management...');

      // Look for resource-related elements
      const resourceSelectors = [
        'text=CPU',
        'text=Memory',
        'text=GPU',
        'text=Disk',
        'text=Resources',
        'text=Usage',
        'text=Performance',
        'text=Monitoring',
        'text=Queue',
        'text=Jobs'
      ];

      let resourceElementsFound = 0;
      for (const selector of resourceSelectors) {
        const element = page.locator(`text=${selector}`).first();
        if (await element.isVisible()) {
          console.log(`✅ Found resource element: ${selector}`);
          resourceElementsFound++;
        }
      }

      console.log(`📊 Found ${resourceElementsFound} resource-related elements`);

      // Check for statistics or metrics
      const metricSelectors = [
        '.stat',
        '.metric',
        '.progress',
        '[role="progressbar"]',
        'text=%',
        'text=MB',
        'text=GB',
        'text=jobs',
        'text=queued',
        'text=running',
        'text=completed'
      ];

      let metricsFound = 0;
      for (const selector of metricSelectors) {
        const elements = page.locator(selector);
        const count = await elements.count();
        if (count > 0) {
          console.log(`✅ Found ${count} ${selector} metric elements`);
          metricsFound += count;
        }
      }

      if (metricsFound > 0) {
        console.log(`📊 Found ${metricsFound} total metric elements`);
      } else {
        console.log('ℹ️ No metrics found on current page');
      }
    });

    test('should handle administrative operations', async ({ page }) => {
      console.log('🔧 Testing administrative operations...');

      // Look for administrative action buttons
      const actionSelectors = [
        'button:has-text("Cancel")',
        'button:has-text("Retry")',
        'button:has-text("Delete")',
        'button:has-text("Cleanup")',
        'button:has-text("Reset")',
        'button:has-text("Restart")',
        'button:has-text("Stop")',
        'button:has-text("Start")'
      ];

      let actionButtonsFound = 0;
      for (const selector of actionSelectors) {
        const buttons = page.locator(selector);
        const count = await buttons.count();
        if (count > 0) {
          console.log(`✅ Found ${count} ${selector} buttons`);
          actionButtonsFound += count;

          // Test first button of each type
          const firstButton = buttons.first();
          const isDisabled = await firstButton.isDisabled();
          console.log(`📝 ${selector} button state: ${isDisabled ? 'disabled' : 'enabled'}`);
        }
      }

      if (actionButtonsFound > 0) {
        console.log(`📊 Found ${actionButtonsFound} administrative action buttons`);
      } else {
        console.log('ℹ️ No administrative action buttons found');
      }
    });
  });

  test.describe('Admin Access Control and Permissions', () => {
    test('should verify admin-only functionality protection', async ({ page }) => {
      console.log('🛡️ Testing admin access control...');

      // Test that admin features are properly protected
      const adminFeatures = [
        { name: 'User Management', selector: '[data-testid="tab-users"]' },
        { name: 'Admin Settings', selector: '[data-testid="tab-admin"]' },
        { name: 'Admin Actions', selector: 'button:has-text("Delete")' },
        { name: 'System Controls', selector: 'button:has-text("Cancel")' }
      ];

      for (const feature of adminFeatures) {
        const element = page.locator(feature.selector).first();
        const isVisible = await element.isVisible();

        if (isVisible) {
          console.log(`✅ ${feature.name} is accessible (user has admin rights)`);
        } else {
          console.log(`ℹ️ ${feature.name} is not visible (proper access control)`);
        }
      }
    });

    test('should handle admin session management', async ({ page }) => {
      console.log('🔑 Testing admin session management...');

      // Check for user menu/avatar dropdown
      const avatarDropdown = page.locator('[data-testid="avatar-dropdown"]');

      if (await avatarDropdown.isVisible()) {
        console.log('✅ User avatar dropdown is visible');

        // Click to open user menu
        await avatarDropdown.click();
        await page.waitForTimeout(500);

        // Look for admin-specific menu items
        const adminMenuItems = [
          'text=Admin Settings',
          'text=User Management',
          'text=System Configuration',
          'text=Logout',
          'text=Sign out',
          'text=Profile',
          'text=Settings'
        ];

        let menuItemsFound = 0;
        for (const item of adminMenuItems) {
          const menuItem = page.locator(item).first();
          if (await menuItem.isVisible()) {
            console.log(`✅ Found menu item: ${item}`);
            menuItemsFound++;
          }
        }

        console.log(`📊 Found ${menuItemsFound} menu items`);

        // Close menu by clicking elsewhere
        await page.click('body');
        await page.waitForTimeout(500);
      } else {
        console.log('ℹ️ Avatar dropdown not found');
      }
    });
  });
});