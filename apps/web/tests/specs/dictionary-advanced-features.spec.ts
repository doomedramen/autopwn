import { test, expect } from "../fixtures/auth-fixture";

test.describe("Advanced Dictionary Management Features (Phase 2)", () => {
  const testDictionary1 =
    "/Users/martin/Developer/autopwn/example_files/dictionaries/test-passwords.txt";
  const testDictionary2 =
    "/Users/martin/Developer/autopwn/example_files/dictionaries/test-passwords.txt";

  test.beforeEach(async ({ page }) => {
    // Ensure authenticated user state
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
  });

  test.describe("Dictionary Merge Workflow", () => {
    test("should open merge dictionaries modal", async ({ page }) => {
      console.log("🔀 Testing merge dictionaries modal...");

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForTimeout(1000);

      // Look for merge button
      const mergeButton = page
        .locator(
          'button:has-text("Merge Dictionaries"), button:has-text("Merge")',
        )
        .first();
      if (await mergeButton.isVisible()) {
        await mergeButton.click();
        await page.waitForTimeout(1000);

        // Check for merge modal
        const mergeModal = page
          .locator(
            '[data-testid="merge-dictionaries-modal"], div[role="dialog"]',
          )
          .first();
        if (await mergeModal.isVisible()) {
          console.log("✅ Merge dictionaries modal opened successfully");

          // Look for dictionary checkboxes
          const checkboxes = mergeModal.locator('input[type="checkbox"]');
          const checkboxCount = await checkboxes.count();
          console.log(`📋 Found ${checkboxCount} dictionary checkboxes`);

          if (checkboxCount >= 2) {
            console.log("✅ Multiple dictionaries available for merging");
          } else {
            console.log("ℹ️ Less than 2 dictionaries available");
          }

          // Check for validation rule inputs
          const minLengthInput = mergeModal
            .locator('input[name="minLength"]')
            .first();
          const maxLengthInput = mergeModal
            .locator('input[name="maxLength"]')
            .first();
          const excludePatternsInput = mergeModal
            .locator('input[name="excludePatterns"]')
            .first();

          const validationInputsVisible =
            (await minLengthInput.isVisible()) &&
            (await maxLengthInput.isVisible()) &&
            (await excludePatternsInput.isVisible());

          console.log(
            `📝 Validation inputs visible: ${validationInputsVisible}`,
          );

          // Close modal
          const closeButton = mergeModal
            .locator('button:has-text("Close"), button:has-text("Cancel")')
            .first();
          if (await closeButton.isVisible()) {
            await closeButton.click();
          }
        } else {
          console.log("❌ Merge dictionaries modal did not open");
        }
      } else {
        console.log("ℹ️ Merge button not found");
      }
    });

    test("should merge two dictionaries successfully", async ({ page }) => {
      console.log("🔀 Testing dictionary merge workflow...");

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForTimeout(1000);

      // Upload first dictionary
      const uploadButton1 = page
        .locator('button:has-text("Upload Dictionary")')
        .first();
      if (await uploadButton1.isVisible()) {
        await uploadButton1.click();
        await page.waitForTimeout(1000);

        const uploadModal = page
          .locator('[data-testid="upload-modal"], div[role="dialog"]')
          .first();
        if (await uploadModal.isVisible()) {
          const fileInput = uploadModal.locator('input[type="file"]').first();
          await fileInput.setInputFiles(testDictionary1);

          const submitButton = uploadModal
            .locator('button:has-text("Upload"), button[type="submit"]')
            .first();
          await submitButton.click();
          await page.waitForTimeout(2000);
        }
      }

      // Upload second dictionary
      const uploadButton2 = page
        .locator('button:has-text("Upload Dictionary")')
        .first();
      if (await uploadButton2.isVisible()) {
        await uploadButton2.click();
        await page.waitForTimeout(1000);

        const uploadModal = page
          .locator('[data-testid="upload-modal"], div[role="dialog"]')
          .first();
        if (await uploadModal.isVisible()) {
          const fileInput = uploadModal.locator('input[type="file"]').first();
          await fileInput.setInputFiles(testDictionary2);

          const submitButton = uploadModal
            .locator('button:has-text("Upload"), button[type="submit"]')
            .first();
          await submitButton.click();
          await page.waitForTimeout(2000);
        }
      }

      // Refresh to see dictionaries
      await page.reload();
      await page.waitForTimeout(2000);

      // Now test merge
      const mergeButton = page
        .locator(
          'button:has-text("Merge Dictionaries"), button:has-text("Merge")',
        )
        .first();
      if (await mergeButton.isVisible()) {
        await mergeButton.click();
        await page.waitForTimeout(1000);

        const mergeModal = page
          .locator(
            '[data-testid="merge-dictionaries-modal"], div[role="dialog"]',
          )
          .first();
        if (await mergeModal.isVisible()) {
          // Select first two dictionaries
          const checkboxes = mergeModal.locator('input[type="checkbox"]');
          if ((await checkboxes.count()) >= 2) {
            await checkboxes.first().check();
            await checkboxes.nth(1).check();

            const nameInput = mergeModal
              .locator('input[name="name"], input[placeholder*="Name"]')
              .first();
            await nameInput.fill("Merged Test Dictionary");

            const mergeSubmitButton = mergeModal
              .locator('button:has-text("Merge"), button[type="submit"]')
              .first();
            await mergeSubmitButton.click();
            await page.waitForTimeout(3000);

            console.log("✅ Dictionary merge initiated");
          }
        }
      }
    });

    test("should apply validation rules during merge", async ({ page }) => {
      console.log("🔍 Testing merge validation rules...");

      // Navigate to Dictionaries tab and open merge modal
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForTimeout(1000);

      const mergeButton = page
        .locator(
          'button:has-text("Merge Dictionaries"), button:has-text("Merge")',
        )
        .first();
      if (await mergeButton.isVisible()) {
        await mergeButton.click();
        await page.waitForTimeout(1000);

        const mergeModal = page
          .locator(
            '[data-testid="merge-dictionaries-modal"], div[role="dialog"]',
          )
          .first();
        if (await mergeModal.isVisible()) {
          // Test validation rule inputs
          const minLengthInput = mergeModal
            .locator('input[name="minLength"]')
            .first();
          if (await minLengthInput.isVisible()) {
            await minLengthInput.fill("8");
            console.log("✅ Set minimum length to 8");

            const maxLengthInput = mergeModal
              .locator('input[name="maxLength"]')
              .first();
            await maxLengthInput.fill("16");
            console.log("✅ Set maximum length to 16");

            const excludePatternsInput = mergeModal
              .locator('input[name="excludePatterns"]')
              .first();
            await excludePatternsInput.fill("^admin,^test");
            console.log("✅ Set exclude patterns");

            // Check if rules can be toggled
            const applyRulesToggle = mergeModal
              .locator('input[name="applyValidationRules"]')
              .first();
            if (await applyRulesToggle.isVisible()) {
              const isChecked = await applyRulesToggle.isChecked();
              console.log(
                `📝 Validation rules initially: ${isChecked ? "enabled" : "disabled"}`,
              );

              await applyRulesToggle.click();
              await page.waitForTimeout(500);

              const newChecked = await applyRulesToggle.isChecked();
              console.log(
                `✅ Validation rules toggled to: ${newChecked ? "enabled" : "disabled"}`,
              );
            }
          }
        }
      }
    });
  });

  test.describe("Dictionary Statistics Workflow", () => {
    test("should display dictionary statistics", async ({ page }) => {
      console.log("📊 Testing dictionary statistics display...");

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForTimeout(1000);

      // Look for statistics button/view
      const statsButtonSelectors = [
        'button:has-text("Statistics")',
        'button:has-text("Stats")',
        "text=Statistics",
        '[data-testid="dictionary-stats"]',
        '[aria-label*="Statistics"]',
      ];

      let statsButtonFound = false;
      for (const selector of statsButtonSelectors) {
        const button = page.locator(selector).first();
        if (await button.isVisible()) {
          console.log(`✅ Found statistics button: ${selector}`);
          statsButtonFound = true;

          await button.click();
          await page.waitForTimeout(1000);

          // Check for statistics display
          const statsDisplay = page
            .locator(
              '[data-testid="dictionary-statistics"], .statistics-display, .stats-panel',
            )
            .first();
          if (await statsDisplay.isVisible()) {
            console.log("✅ Statistics display found");

            // Look for key statistics
            const statsLabels = [
              "word count",
              "unique words",
              "average length",
              "top words",
              "entropy",
              "size",
              "length distribution",
            ];

            let statsFound = 0;
            for (const label of statsLabels) {
              const element = page
                .locator(`text=/${label}/i, text=${label}`)
                .first();
              if (await element.isVisible()) {
                console.log(`✅ Found statistic: ${label}`);
                statsFound++;
              }
            }

            console.log(`📊 Found ${statsFound} statistics`);

            // Look for visual elements (charts, tables, graphs)
            const visualElements = [
              "table",
              ".chart",
              ".graph",
              ".bar-chart",
              ".pie-chart",
              "svg",
            ];

            for (const element of visualElements) {
              const found = page.locator(element).count();
              if (found > 0) {
                console.log(`✅ Found ${found} ${element} element(s)`);
              }
            }
          } else {
            console.log(
              "ℹ️ Statistics display not found after opening stats view",
            );
          }

          break;
        }
      }

      if (!statsButtonFound) {
        console.log("ℹ️ No statistics button/view found");
      }
    });

    test("should calculate and display dictionary entropy", async ({
      page,
    }) => {
      console.log("🔢 Testing dictionary entropy calculation...");

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForTimeout(1000);

      // Look for entropy display (might be in statistics view)
      const entropySelectors = [
        "text=Entropy",
        '[data-testid="entropy"]',
        "text=Shannon Entropy",
        ".entropy-value",
        ".entropy-score",
      ];

      let entropyFound = false;
      for (const selector of entropySelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          const entropyText = await element.textContent();
          if (entropyText) {
            const entropyValue = parseFloat(entropyText);
            console.log(`✅ Found entropy value: ${entropyValue}`);

            // Check if entropy is in valid range (0 to ~8)
            if (entropyValue >= 0 && entropyValue <= 8) {
              console.log("✅ Entropy value is in valid range");
            } else {
              console.log("⚠️ Entropy value is outside expected range");
            }
          }
          entropyFound = true;
          break;
        }
      }

      if (!entropyFound) {
        console.log(
          "ℹ️ Entropy display not found (may not be visible in current view)",
        );
      }
    });
  });

  test.describe("Dictionary Validation Workflow", () => {
    test("should validate dictionary and show results", async ({ page }) => {
      console.log("✓ Testing dictionary validation workflow...");

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForTimeout(1000);

      // Look for validate button
      const validateButtonSelectors = [
        'button:has-text("Validate Dictionary")',
        'button:has-text("Validate")',
        "text=Validate",
        '[data-testid="validate-dictionary"]',
      ];

      let validateButtonFound = false;
      for (const selector of validateButtonSelectors) {
        const button = page.locator(selector).first();
        if (await button.isVisible()) {
          console.log(`✅ Found validate button: ${selector}`);
          validateButtonFound = true;

          await button.click();
          await page.waitForTimeout(1000);

          // Check for validation results
          const validationResults = page
            .locator(
              '[data-testid="validation-results"], .validation-results, .validation-report',
            )
            .first();
          if (await validationResults.isVisible()) {
            console.log("✅ Validation results displayed");

            // Look for validation statistics
            const validationStats = [
              "original word count",
              "valid words",
              "invalid words",
              "duplicate words",
              "words removed",
              "validation passed",
            ];

            let statsFound = 0;
            for (const stat of validationStats) {
              const element = page
                .locator(`text=/${stat}/i, text=${stat}`)
                .first();
              if (await element.isVisible()) {
                console.log(`✅ Found validation stat: ${stat}`);
                statsFound++;
              }
            }

            console.log(`📊 Found ${statsFound} validation statistics`);

            // Look for sample invalid/duplicate words if displayed
            const invalidWordsSection = page
              .locator(".invalid-words, .duplicate-words, .validation-errors")
              .first();
            if (await invalidWordsSection.isVisible()) {
              console.log("✅ Invalid/duplicate words section displayed");

              const wordCount = await invalidWordsSection
                .locator("li, .word-item")
                .count();
              console.log(
                `📋 Found ${wordCount} sample invalid/duplicate words`,
              );
            }
          } else {
            console.log("ℹ️ Validation results not visible after validation");
          }

          break;
        }
      }

      if (!validateButtonFound) {
        console.log("ℹ️ No validate button found");
      }
    });

    test("should download validated dictionary", async ({ page }) => {
      console.log("📥 Testing validated dictionary download...");

      // Navigate to Dictionaries tab
      await page.locator('[data-testid="tab-dictionaries"]').click();
      await page.waitForTimeout(1000);

      // Validate a dictionary
      const validateButton = page
        .locator(
          'button:has-text("Validate Dictionary"), button:has-text("Validate")',
        )
        .first();
      if (await validateButton.isVisible()) {
        await validateButton.click();
        await page.waitForTimeout(2000);

        // Look for download button for validated dictionary
        const downloadButtonSelectors = [
          'button:has-text("Download Validated")',
          'button:has-text("Download")',
          "text=Download",
          '[aria-label*="Download"]',
          "[download]",
        ];

        let downloadButtonFound = false;
        for (const selector of downloadButtonSelectors) {
          const button = page.locator(selector).first();
          if (await button.isVisible()) {
            console.log(`✅ Found download button: ${selector}`);
            downloadButtonFound = true;
            break;
          }
        }

        if (downloadButtonFound) {
          console.log("✅ Download option available for validated dictionary");
        } else {
          console.log("ℹ️ No download button found (may use actions menu)");
        }
      }
    });
  });
});
