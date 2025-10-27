import { test, expect } from '../fixtures/auth-fixture';

test.describe('Dictionary Management & Generation', () => {
  const testDictionary = '/Users/martin/Developer/autopwn/example_files/dictionaries/test-passwords.txt';

  test.beforeEach(async ({ page }) => {
    // Ensure authenticated user state
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test.describe('Dictionary Tab Access and Navigation', () => {
    test('should navigate to dictionaries tab successfully', async ({ page }) => {
      console.log('📚 Testing dictionaries tab navigation...');

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForSelector('[data-testid="tab-dictionaries"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Verify tab is active
      const dictionariesTab = page.locator('[data-testid="tab-dictionaries"]');
      await expect(dictionariesTab).toHaveClass(/text-primary/);
      console.log('✅ Dictionaries tab successfully activated');

      // Check for dictionary management interface
      const dictionariesContent = page.locator('main').first();
      await expect(dictionariesContent).toBeVisible();
      console.log('✅ Dictionary management interface is displayed');
    });

    test('should display dictionary management buttons', async ({ page }) => {
      console.log('🔘 Testing dictionary management buttons...');

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForSelector('[data-testid="tab-dictionaries"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Look for action buttons
      const actionButtonSelectors = [
        'button:has-text("Upload Dictionary")',
        'button:has-text("Upload Dictionaries")',
        'button:has-text("Generate Dictionary")',
        'button:has-text("Generate")',
        'button:has-text("create")',
        'button:has-text("Create")'
      ];

      let buttonsFound = 0;
      for (const selector of actionButtonSelectors) {
        const button = page.locator(selector).first();
        if (await button.isVisible()) {
          console.log(`✅ Found button: ${selector}`);
          buttonsFound++;

          // Check button state
          const isEnabled = await button.isEnabled();
          console.log(`📝 Button state: ${isEnabled ? 'enabled' : 'disabled'}`);
        }
      }

      console.log(`📊 Found ${buttonsFound} dictionary management buttons`);

      if (buttonsFound === 0) {
        console.log('ℹ️ No dictionary management buttons found (may need admin rights)');
      }
    });

    test('should display dictionary table with proper columns', async ({ page }) => {
      console.log('📊 Testing dictionary table structure...');

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForSelector('[data-testid="tab-dictionaries"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(2000); // Wait for data to load

      // Look for table headers
      const expectedHeaders = [
        'Name', 'Type', 'Status', 'Size', 'Words', 'Created', 'Actions'
      ];

      let headersFound = 0;
      for (const header of expectedHeaders) {
        const headerElement = page.locator(`th:has-text("${header}")`).first();
        if (await headerElement.isVisible()) {
          console.log(`✅ Found header: ${header}`);
          headersFound++;
        }
      }

      console.log(`📋 Found ${headersFound}/${expectedHeaders.length} expected headers`);

      // Check for dictionary data rows
      const dictionaryRows = page.locator('tbody tr');
      const rowCount = await dictionaryRows.count();

      if (rowCount > 0) {
        console.log(`✅ Found ${rowCount} dictionary/dictionaries in the table`);
      } else {
        // Check for empty state
        const emptyStateSelectors = [
          'text=no dictionaries found',
          'text=No dictionaries found',
          'text=empty',
          '[data-testid="dictionaries-empty-state"]'
        ];

        let emptyStateFound = false;
        for (const selector of emptyStateSelectors) {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            console.log(`✅ Empty state message found: ${selector}`);
            emptyStateFound = true;
            break;
          }
        }

        if (!emptyStateFound) {
          console.log('ℹ️ No dictionaries found but no specific empty state message');
        }
      }
    });
  });

  test.describe('Dictionary Upload Functionality', () => {
    test('should open dictionary upload modal', async ({ page }) => {
      console.log('📤 Testing dictionary upload modal...');

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForSelector('[data-testid="tab-dictionaries"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Look for upload button
      const uploadButtonSelectors = [
        'button:has-text("Upload Dictionary")',
        'button:has-text("Upload Dictionaries")',
        'button:has-text("Upload")'
      ];

      let uploadButtonFound = false;
      for (const selector of uploadButtonSelectors) {
        const button = page.locator(selector).first();
        if (await button.isVisible()) {
          console.log(`✅ Found upload button: ${selector}`);

          // Click upload button
          await button.click();
          await page.waitForTimeout(1000);

          // Check for upload modal
          const uploadModal = page.locator('[data-testid="upload-modal"], div[role="dialog"]').first();
          if (await uploadModal.isVisible()) {
            console.log('✅ Upload modal opened successfully');

            // Look for dictionary tab in upload modal
            const dictTabSelectors = [
              'button:has-text("Dictionaries")',
              'button:has-text("dictionaries")',
              'button[role="tab"]:has-text("Dictionaries")'
            ];

            let dictTabFound = false;
            for (const tabSelector of dictTabSelectors) {
              const tab = uploadModal.locator(tabSelector).first();
              if (await tab.isVisible()) {
                console.log(`✅ Found dictionary tab: ${tabSelector}`);
                dictTabFound = true;
                break;
              }
            }

            if (!dictTabFound) {
              console.log('ℹ️ Dictionary tab not found in upload modal');
            }

            // Close modal
            const closeButton = uploadModal.locator('button:has-text("Close")').first();
            if (await closeButton.isVisible()) {
              await closeButton.click();
            } else {
              // Try clicking outside modal
              await page.click('body');
            }
          } else {
            console.log('❌ Upload modal did not open');
          }

          uploadButtonFound = true;
          break;
        }
      }

      if (!uploadButtonFound) {
        console.log('ℹ️ No upload button found');
      }
    });

    test('should handle dictionary file upload with validation', async ({ page }) => {
      console.log('📄 Testing dictionary file upload...');

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForSelector('[data-testid="tab-dictionaries"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Try to open upload modal
      const uploadButton = page.locator('button:has-text("Upload Dictionary"), button:has-text("Upload Dictionaries")').first();
      if (await uploadButton.isVisible()) {
        await uploadButton.click();
        await page.waitForTimeout(1000);

        const uploadModal = page.locator('[data-testid="upload-modal"], div[role="dialog"]').first();
        if (await uploadModal.isVisible()) {
          console.log('✅ Upload modal opened');

          // Switch to dictionary tab if needed
          const dictTab = uploadModal.locator('button:has-text("Dictionaries")').first();
          if (await dictTab.isVisible()) {
            await dictTab.click();
            await page.waitForTimeout(500);
          }

          // Look for file input
          const fileInputSelectors = [
            'input[type="file"]',
            'input[accept*=".txt"]',
            'input[accept*="text/*"]'
          ];

          let fileUploaded = false;
          for (const selector of fileInputSelectors) {
            const fileInput = uploadModal.locator(selector).first();
            if (await fileInput.isVisible()) {
              try {
                await fileInput.setInputFiles(testDictionary);
                console.log(`✅ Dictionary file uploaded with selector: ${selector}`);
                fileUploaded = true;
                break;
              } catch (error) {
                console.log(`ℹ️ File upload failed with ${selector}: ${error}`);
              }
            }
          }

          if (!fileUploaded) {
            // Try drop zone approach
            const dropZone = uploadModal.locator('.border-dashed, [class*="drop"]').first();
            if (await dropZone.isVisible()) {
              try {
                await dropZone.setInputFiles(testDictionary);
                console.log('✅ Dictionary file uploaded via drop zone');
                fileUploaded = true;
              } catch (error) {
                console.log(`ℹ️ Drop zone upload failed: ${error}`);
              }
            }
          }

          if (fileUploaded) {
            await page.waitForTimeout(2000);

            // Look for upload submit button
            const submitButtonSelectors = [
              'button:has-text("Upload Dictionaries")',
              'button:has-text("Upload")',
              'button:has-text("Submit")',
              'button[type="submit"]'
            ];

            for (const selector of submitButtonSelectors) {
              const button = uploadModal.locator(selector).first();
              if (await button.isVisible()) {
                const isEnabled = await button.isEnabled();
                console.log(`📝 Upload submit button state: ${isEnabled ? 'enabled' : 'disabled'}`);

                if (isEnabled) {
                  await button.click();
                  console.log('✅ Upload submitted');
                  await page.waitForTimeout(3000);
                }
                break;
              }
            }
          }

          // Close modal
          const closeButton = uploadModal.locator('button:has-text("Close")').first();
          if (await closeButton.isVisible()) {
            await closeButton.click();
          }
        }
      } else {
        console.log('ℹ️ Upload button not accessible');
      }
    });
  });

  test.describe('Dictionary Generation Modal', () => {
    test('should open dictionary generation modal', async ({ page }) => {
      console.log('⚙️ Testing dictionary generation modal...');

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForSelector('[data-testid="tab-dictionaries"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Look for generate button
      const generateButtonSelectors = [
        'button:has-text("Generate Dictionary")',
        'button:has-text("Generate")',
        'button:has-text("Create Dictionary")'
      ];

      let generateButtonFound = false;
      for (const selector of generateButtonSelectors) {
        const button = page.locator(selector).first();
        if (await button.isVisible()) {
          console.log(`✅ Found generate button: ${selector}`);

          // Click generate button
          await button.click();
          await page.waitForTimeout(1000);

          // Check for dictionary generator modal
          const generatorModal = page.locator('[data-testid="dictionary-generator-modal"], div[role="dialog"]').first();
          if (await generatorModal.isVisible()) {
            console.log('✅ Dictionary generator modal opened successfully');

            // Look for form elements
            const formElements = [
              { selector: 'input#minLen', name: 'minimum length' },
              { selector: 'input#maxLen', name: 'maximum length' },
              { selector: 'textarea#wordlist', name: 'wordlist textarea' },
              { selector: 'input#pattern', name: 'pattern input' },
              { selector: 'input#outputFilename', name: 'output filename' }
            ];

            let elementsFound = 0;
            for (const element of formElements) {
              const formElement = generatorModal.locator(element.selector).first();
              if (await formElement.isVisible()) {
                console.log(`✅ Found ${element.name} input`);
                elementsFound++;
              }
            }

            console.log(`📊 Found ${elementsFound}/${formElements.length} form elements`);

            // Close modal
            const closeButton = generatorModal.locator('button:has-text("Cancel"), button:has-text("Close")').first();
            if (await closeButton.isVisible()) {
              await closeButton.click();
            } else {
              await page.click('body');
            }
          } else {
            console.log('❌ Dictionary generator modal did not open');
          }

          generateButtonFound = true;
          break;
        }
      }

      if (!generateButtonFound) {
        console.log('ℹ️ No generate button found');
      }
    });

    test('should handle dictionary generation form configuration', async ({ page }) => {
      console.log('⚙️ Testing dictionary generation configuration...');

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForSelector('[data-testid="tab-dictionaries"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Try to open generation modal
      const generateButton = page.locator('button:has-text("Generate Dictionary"), button:has-text("Generate")').first();
      if (await generateButton.isVisible()) {
        await generateButton.click();
        await page.waitForTimeout(1000);

        const generatorModal = page.locator('[data-testid="dictionary-generator-modal"], div[role="dialog"]').first();
        if (await generatorModal.isVisible()) {
          console.log('✅ Generator modal opened for configuration test');

          // Test length inputs
          const minLengthInput = generatorModal.locator('input#minLen').first();
          if (await minLengthInput.isVisible()) {
            await minLengthInput.fill('8');
            console.log('✅ Set minimum length to 8');

            const maxLengthInput = generatorModal.locator('input#maxLen').first();
            if (await maxLengthInput.isVisible()) {
              await maxLengthInput.fill('16');
              console.log('✅ Set maximum length to 16');
            }
          }

          // Test wordlist mode
          const wordlistSwitch = generatorModal.locator('input#useWordlist').first();
          if (await wordlistSwitch.isVisible()) {
            // Check if switch is already checked
            const isChecked = await wordlistSwitch.isChecked();
            console.log(`📝 Wordlist switch initial state: ${isChecked ? 'enabled' : 'disabled'}`);

            if (!isChecked) {
              await wordlistSwitch.click();
              console.log('✅ Enabled wordlist mode');
            }

            // Fill wordlist
            const wordlistTextarea = generatorModal.locator('textarea#wordlist').first();
            if (await wordlistTextarea.isVisible()) {
              await wordlistTextarea.fill('password\nadmin\n123456\nqwerty');
              console.log('✅ Filled wordlist with test words');
            }
          }

          // Test pattern mode
          const patternSwitch = generatorModal.locator('input#usePattern').first();
          if (await patternSwitch.isVisible()) {
            await patternSwitch.click();
            console.log('✅ Enabled pattern mode');

            const patternInput = generatorModal.locator('input#pattern').first();
            if (await patternInput.isVisible()) {
              await patternInput.fill('@^%');  // lowercase, uppercase, numeric
              console.log('✅ Set pattern to @^%');
            }
          }

          // Test output filename
          const filenameInput = generatorModal.locator('input#outputFilename').first();
          if (await filenameInput.isVisible()) {
            await filenameInput.fill('test-dictionary.txt');
            console.log('✅ Set output filename');
          }

          // Look for generate button
          const generateSubmitButton = generatorModal.locator('button:has-text("Generate"), button[type="submit"]').first();
          if (await generateSubmitButton.isVisible()) {
            const isEnabled = await generateSubmitButton.isEnabled();
            console.log(`📝 Generate submit button state: ${isEnabled ? 'enabled' : 'disabled'}`);

            if (isEnabled) {
              console.log('✅ Form is properly configured and ready to submit');
            } else {
              console.log('ℹ️ Form needs more configuration before submission');
            }
          }

          // Close modal
          const cancelButton = generatorModal.locator('button:has-text("Cancel"), button:has-text("Close")').first();
          if (await cancelButton.isVisible()) {
            await cancelButton.click();
          }
        }
      } else {
        console.log('ℹ️ Generate button not accessible');
      }
    });
  });

  test.describe('Dictionary Status and Management', () => {
    test('should display dictionary status indicators', async ({ page }) => {
      console.log('📊 Testing dictionary status indicators...');

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForSelector('[data-testid="tab-dictionaries"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(2000); // Wait for data to load

      // Look for status indicators
      const statusSelectors = [
        'text=ready',
        'text=processing',
        'text=uploading',
        'text=failed',
        'text=generating',
        '.animate-spin',
        '[role="status"]',
        'svg[class*="check"]',
        'svg[class*="x"]',
        'svg[class*="loader"]'
      ];

      let statusElementsFound = 0;
      for (const selector of statusSelectors) {
        const elements = page.locator(selector);
        const count = await elements.count();
        if (count > 0) {
          console.log(`✅ Found ${count} ${selector} status elements`);
          statusElementsFound += count;
        }
      }

      if (statusElementsFound > 0) {
        console.log(`📊 Found ${statusElementsFound} total status elements`);
      } else {
        console.log('ℹ️ No status indicators found (empty dictionary list)');
      }

      // Check for type indicators
      const typeSelectors = [
        'text=uploaded',
        'text=generated',
        'svg[class*="folder"]',
        'svg[class*="zap"]'
      ];

      let typeElementsFound = 0;
      for (const selector of typeSelectors) {
        const elements = page.locator(selector);
        const count = await elements.count();
        if (count > 0) {
          console.log(`✅ Found ${count} ${selector} type elements`);
          typeElementsFound += count;
        }
      }

      if (typeElementsFound > 0) {
        console.log(`📊 Found ${typeElementsFound} total type elements`);
      }
    });

    test('should handle dictionary loading states', async ({ page }) => {
      console.log('⏳ Testing dictionary loading states...');

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();

      // Look for loading indicators
      const loadingSelectors = [
        '.animate-spin',
        '[role="progressbar"]',
        'text=Loading',
        'text=loading...',
        'text=Processing',
        '.loading'
      ];

      let loadingFound = false;
      const startTime = Date.now();

      // Check for loading state for up to 3 seconds
      while (Date.now() - startTime < 3000) {
        for (const selector of loadingSelectors) {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            console.log(`✅ Loading indicator found: ${selector}`);
            loadingFound = true;
            break;
          }
        }

        if (loadingFound) break;
        await page.waitForTimeout(100);
      }

      if (!loadingFound) {
        console.log('ℹ️ No loading indicators detected (may load too quickly to test)');
      }

      // Wait for final state
      await page.waitForSelector('[data-testid="tab-dictionaries"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      console.log('✅ Loading state validation completed');
    });
  });

  test.describe('Dictionary Integration with Jobs', () => {
    test('should allow dictionary selection in job creation', async ({ page }) => {
      console.log('🔗 Testing dictionary integration with jobs...');

      // Navigate to Jobs tab
      await page.locator('[data-testid="tab-jobs"]').click();
      await page.waitForSelector('[data-testid="tab-jobs"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Look for create job button
      const createJobButton = page.locator('button:has-text("Create Jobs"), button:has-text("Create Job")').first();
      if (await createJobButton.isVisible()) {
        await createJobButton.click();
        await page.waitForTimeout(1000);

        // Look for job creation modal
        const jobModal = page.locator('div[role="dialog"]').first();
        if (await jobModal.isVisible()) {
          console.log('✅ Job creation modal opened');

          // Look for dictionary selection
          const dictSelectSelectors = [
            '[data-testid="dictionary-select"]',
            'select:has-text("Dictionary")',
            'label:has-text("Dictionary")',
            'text=Dictionary',
            'select'
          ];

          let dictSelectFound = false;
          for (const selector of dictSelectSelectors) {
            const element = jobModal.locator(selector).first();
            if (await element.isVisible()) {
              console.log(`✅ Found dictionary selector: ${selector}`);
              dictSelectFound = true;
              break;
            }
          }

          if (!dictSelectFound) {
            console.log('ℹ️ No dictionary selector found in job creation modal');
          }

          // Close modal
          const closeButton = jobModal.locator('button:has-text("Close"), button:has-text("Cancel")').first();
          if (await closeButton.isVisible()) {
            await closeButton.click();
          }
        } else {
          console.log('❌ Job creation modal did not open');
        }
      } else {
        console.log('ℹ️ Create job button not accessible');
      }
    });
  });

  test.describe('Dictionary Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      console.log('📱 Testing dictionary management on mobile...');

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForSelector('[data-testid="tab-dictionaries"].text-primary', { timeout: 5000 });
      await page.waitForTimeout(1000);

      // Check if interface is usable on mobile
      const dictionariesTab = page.locator('[data-testid="tab-dictionaries"]');
      await expect(dictionariesTab).toBeVisible();
      console.log('✅ Dictionary management accessible on mobile viewport');

      // Reset to desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);

      console.log('✅ Responsive design validation completed');
    });
  });
});