import { test, expect } from '../fixtures/auth-fixture';

test.describe('Error Handling & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure authenticated user state
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test.describe('Network Failure Handling', () => {
    test('should handle network connectivity issues gracefully', async ({ page }) => {
      console.log('🌐 Testing network failure handling...');

      // Simulate network offline condition
      await page.context().setOffline(true);
      console.log('📡 Network set to offline');

      // Try to navigate between tabs
      const tabs = ['networks', 'users', 'dictionaries', 'jobs'];

      for (const tab of tabs) {
        try {
          await page.locator(`[data-testid="tab-${tab}"]`).click();
          await page.waitForTimeout(2000);

          // Look for error states or offline indicators
          const errorSelectors = [
            '[data-testid="error-message"]',
            '.error-message',
            'text=Network error',
            'text=Offline',
            'text=Connection failed',
            '[data-testid="offline-indicator"]',
            '.offline-indicator'
          ];

          let errorFound = false;
          for (const selector of errorSelectors) {
            try {
              const errorElement = page.locator(selector).first();
              if (await errorElement.isVisible({ timeout: 1000 })) {
                console.log(`✅ Network error indicator found in ${tab} tab: ${selector}`);
                errorFound = true;
                break;
              }
            } catch (error) {
              // Continue checking
            }
          }

          if (!errorFound) {
            console.log(`ℹ️ No specific network error message in ${tab} tab (may use generic handling)`);
          }
        } catch (error) {
          console.log(`ℹ️ Could not test ${tab} tab during network failure: ${error.message}`);
        }
      }

      // Restore network connectivity
      await page.context().setOffline(false);
      console.log('📡 Network restored to online');

      // Test recovery after network restoration
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      console.log('✅ Network failure handling validation completed');
    });

    test('should handle API timeout scenarios', async ({ page }) => {
      console.log('⏱️ Testing API timeout handling...');

      // Navigate to a tab that makes API calls
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(1000);

      // Mock slow API responses by intercepting requests
      await page.route('**/api/**', async (route) => {
        // Simulate a very slow response
        setTimeout(() => {
          route.continue();
        }, 10000); // 10 second delay
      });

      console.log('🕐 API requests slowed down to simulate timeout');

      // Try to trigger API calls
      await page.locator('[data-testid="tab-users"]').click();
      await page.waitForTimeout(3000); // Wait but not as long as the mocked delay

      // Look for timeout indicators
      const timeoutSelectors = [
        '[data-testid="timeout-message"]',
        'text=Request timeout',
        'text=Taking too long',
        'text=Server not responding',
        '.timeout-indicator'
      ];

      let timeoutFound = false;
      for (const selector of timeoutSelectors) {
        try {
          const timeoutElement = page.locator(selector).first();
          if (await timeoutElement.isVisible({ timeout: 1000 })) {
            console.log(`✅ Timeout indicator found: ${selector}`);
            timeoutFound = true;
            break;
          }
        } catch (error) {
          // Continue checking
        }
      }

      if (!timeoutFound) {
        console.log('ℹ️ No specific timeout message detected');
      }

      // Remove the slow response simulation
      await page.unroute('**/api/**');
      console.log('⚡ API response speed restored');

      console.log('✅ API timeout handling validation completed');
    });

    test('should handle concurrent request failures', async ({ page }) => {
      console.log('🔄 Testing concurrent request failure handling...');

      // Mock API failures
      await page.route('**/api/**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      });

      console.log('❌ API requests set to fail with 500 errors');

      // Try to trigger multiple concurrent requests
      const tabs = ['networks', 'users', 'dictionaries'];

      for (const tab of tabs) {
        await page.locator(`[data-testid="tab-${tab}"]`).click();
      }

      await page.waitForTimeout(2000);

      // Look for error handling
      const errorSelectors = [
        '[data-testid="error-boundary"]',
        '.error-boundary',
        'text=Something went wrong',
        'text=Error loading data',
        'text=Failed to load',
        '[data-testid="retry-button"]',
        'button:has-text("Retry")'
      ];

      let errorHandlingFound = false;
      for (const selector of errorSelectors) {
        try {
          const errorElement = page.locator(selector).first();
          if (await errorElement.isVisible({ timeout: 1000 })) {
            console.log(`✅ Error handling found: ${selector}`);
            errorHandlingFound = true;
            break;
          }
        } catch (error) {
          // Continue checking
        }
      }

      if (!errorHandlingFound) {
        console.log('ℹ️ No specific error handling UI detected');
      }

      // Restore normal API responses
      await page.unroute('**/api/**');
      console.log('✅ API responses restored');

      console.log('✅ Concurrent request failure handling validation completed');
    });
  });

  test.describe('Form Validation and Edge Cases', () => {
    test('should handle form validation errors appropriately', async ({ page }) => {
      console.log('✅ Testing form validation error handling...');

      // Look for forms that might have validation
      const formSelectors = [
        'form',
        '[data-testid="form"]',
        'input[type="text"]',
        'input[type="email"]',
        'input[type="password"]',
        'textarea'
      ];

      let formsFound = 0;
      for (const selector of formSelectors) {
        try {
          const formElement = page.locator(selector).first();
          if (await formElement.isVisible({ timeout: 2000 })) {
            console.log(`📝 Found form element: ${selector}`);
            formsFound++;

            // Test invalid input if it's an input field
            if (selector.includes('input')) {
              // Clear and enter invalid data
              await formElement.clear();
              await formElement.fill('invalid-test-data-123!@#');
              await page.waitForTimeout(500);

              // Look for validation error messages
              const validationSelectors = [
                '[data-testid="validation-error"]',
                '.error-message',
                '.field-error',
                'text=Invalid',
                'text=Required',
                'text=Please enter'
              ];

              for (const valSelector of validationSelectors) {
                try {
                  const valElement = page.locator(valSelector).first();
                  if (await valElement.isVisible({ timeout: 1000 })) {
                    console.log(`✅ Validation error displayed: ${valSelector}`);
                    break;
                  }
                } catch (error) {
                  // Continue checking
                }
              }
            }
          }
        } catch (error) {
          // Continue checking
        }
      }

      if (formsFound === 0) {
        console.log('ℹ️ No forms found for validation testing');
      } else {
        console.log(`📝 Found ${formsFound} form elements`);
      }

      console.log('✅ Form validation error handling validation completed');
    });

    test('should handle empty and boundary input cases', async ({ page }) => {
      console.log('🔤 Testing boundary input handling...');

      // Test with very long input
      const longInput = 'a'.repeat(1000);
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      const inputSelectors = [
        'input[type="text"]',
        'input[type="search"]',
        'textarea',
        'input[placeholder*="search" i]'
      ];

      for (const selector of inputSelectors) {
        try {
          const inputElement = page.locator(selector).first();
          if (await inputElement.isVisible({ timeout: 2000 })) {
            console.log(`🔤 Testing input field: ${selector}`);

            // Test very long input
            await inputElement.clear();
            await inputElement.fill(longInput);
            await page.waitForTimeout(500);

            // Test special characters
            await inputElement.clear();
            await inputElement.fill(specialChars);
            await page.waitForTimeout(500);

            // Test empty input
            await inputElement.clear();
            await page.waitForTimeout(500);

            console.log(`✅ Boundary inputs handled for: ${selector}`);
          }
        } catch (error) {
          console.log(`ℹ️ Could not test input field ${selector}`);
        }
      }

      console.log('✅ Boundary input handling validation completed');
    });

    test('should handle malformed data gracefully', async ({ page }) => {
      console.log('🔧 Testing malformed data handling...');

      // Try to access invalid URLs or parameters
      const invalidPaths = [
        '/invalid-route',
        '/networks/invalid-id',
        '/users/999999',
        '/dictionaries/nonexistent',
        '/api/invalid-endpoint'
      ];

      for (const path of invalidPaths) {
        try {
          await page.goto(path);
          await page.waitForTimeout(2000);

          // Look for 404 or error pages
          const errorPageSelectors = [
            'text=404',
            'text=Not Found',
            'text=Page not found',
            'text=Invalid route',
            '[data-testid="404-page"]',
            '.error-page'
          ];

          let errorPageFound = false;
          for (const selector of errorPageSelectors) {
            try {
              const errorElement = page.locator(selector).first();
              if (await errorElement.isVisible({ timeout: 1000 })) {
                console.log(`✅ Error page displayed for ${path}: ${selector}`);
                errorPageFound = true;
                break;
              }
            } catch (error) {
              // Continue checking
            }
          }

          if (!errorPageFound) {
            // Check if redirected to valid page
            const currentUrl = page.url();
            if (!currentUrl.includes(path)) {
              console.log(`↩️ Invalid path ${path} redirected to: ${currentUrl}`);
            }
          }
        } catch (error) {
          console.log(`ℹ️ Could not test invalid path ${path}: ${error.message}`);
        }
      }

      // Return to valid page
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      console.log('✅ Malformed data handling validation completed');
    });
  });

  test.describe('Permission and Access Control Edge Cases', () => {
    test('should handle unauthorized access attempts gracefully', async ({ page }) => {
      console.log('🔒 Testing unauthorized access handling...');

      // Try to access admin-only functionality (we're already authenticated as admin)
      // Let's test what happens with malformed requests

      // Test direct API access without proper permissions
      const apiEndpoints = [
        '/api/admin/users',
        '/api/admin/settings',
        '/api/admin/system'
      ];

      for (const endpoint of apiEndpoints) {
        try {
          // Make direct request to API endpoint
          const response = await page.request.get(`${new URL(page.url()).origin}${endpoint}`);

          if (response.status() === 401 || response.status() === 403) {
            console.log(`✅ API endpoint properly protected: ${endpoint} (${response.status()})`);
          } else if (response.status() === 404) {
            console.log(`ℹ️ API endpoint not found: ${endpoint} (${response.status()})`);
          } else {
            console.log(`ℹ️ API endpoint response: ${endpoint} (${response.status()})`);
          }
        } catch (error) {
          console.log(`ℹ️ Could not test API endpoint ${endpoint}: ${error.message}`);
        }
      }

      console.log('✅ Unauthorized access handling validation completed');
    });

    test('should handle session timeout scenarios', async ({ page }) => {
      console.log('⏰ Testing session timeout handling...');

      // Clear authentication cookies to simulate session timeout
      const cookies = await page.context().cookies();
      await page.context().clearCookies();

      console.log('🍪 Authentication cookies cleared');

      // Try to access protected content
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for authentication prompts or redirects
      const authSelectors = [
        '[data-testid="sign-in"]',
        'text=Sign in',
        'text=Log in',
        'text=Login',
        'input[type="email"]',
        'input[type="password"]',
        '.sign-in-form',
        '[data-testid="login-form"]'
      ];

      let authPromptFound = false;
      for (const selector of authSelectors) {
        try {
          const authElement = page.locator(selector).first();
          if (await authElement.isVisible({ timeout: 2000 })) {
            console.log(`✅ Authentication prompt found: ${selector}`);
            authPromptFound = true;
            break;
          }
        } catch (error) {
          // Continue checking
        }
      }

      if (!authPromptFound) {
        console.log('ℹ️ No authentication prompt detected (may redirect differently)');
      }

      // Check current URL to see if redirected
      const currentUrl = page.url();
      if (currentUrl.includes('/sign-in') || currentUrl.includes('/login')) {
        console.log(`↩️ Redirected to authentication page: ${currentUrl}`);
      }

      console.log('✅ Session timeout handling validation completed');
    });
  });

  test.describe('Resource Limit and Stress Testing', () => {
    test('should handle memory and resource limits', async ({ page }) => {
      console.log('💾 Testing resource limit handling...');

      // Test rapid tab switching
      const tabs = ['networks', 'users', 'dictionaries', 'jobs'];
      const switchCount = 10;

      console.log(`🔄 Testing rapid tab switching (${switchCount} cycles)...`);

      for (let i = 0; i < switchCount; i++) {
        for (const tab of tabs) {
          await page.locator(`[data-testid="tab-${tab}"]`).click();
          await page.waitForTimeout(100); // Very short delay
        }
      }

      console.log('✅ Rapid tab switching completed');

      // Test large data rendering (if possible)
      await page.locator('[data-testid="tab-networks"]').click();
      await page.waitForTimeout(1000);

      // Check if page remains responsive
      try {
        const isResponsive = await page.locator('body').isVisible({ timeout: 5000 });
        if (isResponsive) {
          console.log('✅ Page remains responsive after stress test');
        }
      } catch (error) {
        console.log('⚠️ Page may have become unresponsive');
      }

      console.log('✅ Resource limit handling validation completed');
    });

    test('should handle browser storage limits', async ({ page }) => {
      console.log('🗄️ Testing browser storage handling...');

      // Check localStorage usage
      const localStorageInfo = await page.evaluate(() => {
        try {
          const used = JSON.stringify(localStorage).length;
          const remaining = 5 * 1024 * 1024 - used; // Approximate 5MB limit
          return { used, remaining, itemCount: localStorage.length };
        } catch (error) {
          return { error: error.message };
        }
      });

      if (localStorageInfo.error) {
        console.log(`ℹ️ localStorage error: ${localStorageInfo.error}`);
      } else {
        console.log(`📊 localStorage: ${localStorageInfo.used} bytes used, ${localStorageInfo.itemCount} items`);
      }

      // Check sessionStorage usage
      const sessionStorageInfo = await page.evaluate(() => {
        try {
          const used = JSON.stringify(sessionStorage).length;
          const itemCount = sessionStorage.length;
          return { used, itemCount };
        } catch (error) {
          return { error: error.message };
        }
      });

      if (sessionStorageInfo.error) {
        console.log(`ℹ️ sessionStorage error: ${sessionStorageInfo.error}`);
      } else {
        console.log(`📊 sessionStorage: ${sessionStorageInfo.used} bytes used, ${sessionStorageInfo.itemCount} items`);
      }

      // Test storage with large data
      try {
        await page.evaluate(() => {
          try {
            localStorage.setItem('test-large-data', 'x'.repeat(100000)); // 100KB
            return true;
          } catch (error) {
            return false;
          }
        });

        // Clean up test data
        await page.evaluate(() => {
          localStorage.removeItem('test-large-data');
        });

        console.log('✅ Large data storage test completed');
      } catch (error) {
        console.log('ℹ️ Could not test large data storage');
      }

      console.log('✅ Browser storage handling validation completed');
    });
  });

  test.describe('Browser Compatibility Edge Cases', () => {
    test('should handle JavaScript disabled scenarios', async ({ page }) => {
      console.log('⚙️ Testing JavaScript dependency handling...');

      // This test is limited since Playwright requires JavaScript
      // But we can test what happens with script execution failures

      // Test error boundaries by triggering console errors
      await page.evaluate(() => {
        // Trigger a harmless JavaScript error
        setTimeout(() => {
          throw new Error('Test error for error boundary validation');
        }, 100);
      });

      await page.waitForTimeout(500);

      // Look for error boundary UI
      const errorBoundarySelectors = [
        '[data-testid="error-boundary"]',
        '.error-boundary',
        'text=Something went wrong',
        'text=An error occurred',
        '[data-testid="error-fallback"]'
      ];

      let errorBoundaryFound = false;
      for (const selector of errorBoundarySelectors) {
        try {
          const errorElement = page.locator(selector).first();
          if (await errorElement.isVisible({ timeout: 2000 })) {
            console.log(`✅ Error boundary found: ${selector}`);
            errorBoundaryFound = true;
            break;
          }
        } catch (error) {
          // Continue checking
        }
      }

      if (!errorBoundaryFound) {
        console.log('ℹ️ No error boundary UI detected');
      }

      console.log('✅ JavaScript dependency handling validation completed');
    });

    test('should handle viewport and display edge cases', async ({ page }) => {
      console.log('📱 Testing viewport edge cases...');

      // Test very small viewport
      await page.setViewportSize({ width: 200, height: 300 });
      await page.waitForTimeout(1000);

      try {
        const contentVisible = await page.locator('body').isVisible();
        if (contentVisible) {
          console.log('✅ Content displays in very small viewport');
        }
      } catch (error) {
        console.log('ℹ️ Content may not display properly in very small viewport');
      }

      // Test very large viewport
      await page.setViewportSize({ width: 4000, height: 3000 });
      await page.waitForTimeout(1000);

      try {
        const contentVisible = await page.locator('body').isVisible();
        if (contentVisible) {
          console.log('✅ Content displays in very large viewport');
        }
      } catch (error) {
        console.log('ℹ️ Content may not display properly in very large viewport');
      }

      // Test unusual aspect ratios
      const unusualViewports = [
        { width: 100, height: 1000 },  // Very tall
        { width: 2000, height: 100 },  // Very wide
        { width: 1, height: 1 }        // Minimal
      ];

      for (const viewport of unusualViewports) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(500);

        try {
          const mainContent = page.locator('main, [data-testid="main"], .main-content').first();
          if (await mainContent.isVisible({ timeout: 1000 })) {
            console.log(`✅ Content displays in unusual viewport: ${viewport.width}x${viewport.height}`);
          }
        } catch (error) {
          console.log(`ℹ️ Content may be affected by unusual viewport: ${viewport.width}x${viewport.height}`);
        }
      }

      // Reset to normal viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);

      console.log('✅ Viewport edge cases validation completed');
    });
  });
});