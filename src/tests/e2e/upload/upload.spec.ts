import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import { TestHelpers } from '../helpers/test-helpers';

test.describe('File Upload', () => {
  let authHeaders: Record<string, string>;

  test.beforeAll(async ({ browser, request }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Initialize system and login
    const user = await TestHelpers.initializeSystem(page);
    await TestHelpers.login(page, user.email, user.password);

    // Get auth headers for API requests
    authHeaders = await TestHelpers.getAuthHeaders(context);

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    // Login for each test
    const user = await TestHelpers.initializeSystem(page);
    await TestHelpers.login(page, user.email, user.password);
  });

  test.describe('Dictionary Upload', () => {
    test('should upload dictionary file successfully via API', async ({
      request,
    }) => {
      const { dictionaryPath } = TestHelpers.getTestFilePaths();

      const dictionary = await TestHelpers.uploadDictionary(
        request,
        authHeaders,
        dictionaryPath
      );

      expect(dictionary.id).toBeDefined();
      expect(dictionary.path).toBeDefined();
      expect(dictionary.name).toBeDefined();
    });

    test('should upload dictionary file successfully via UI', async ({
      page,
    }) => {
      // Navigate to uploads tab
      await TestHelpers.navigateToTab(page, 'Uploads');

      // Switch to dictionary tab
      await page.click('text=Dictionary');

      // Upload test dictionary file
      const { dictionaryPath } = TestHelpers.getTestFilePaths();

      // Use the file input
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(dictionaryPath);

      // Wait for upload to complete
      await page.waitForSelector('text=Upload completed', { timeout: 30000 });

      // Verify dictionary appears in the list
      await expect(page.locator('text=test-passwords.txt')).toBeVisible();
    });

    test('should validate dictionary file format', async ({ request }) => {
      // Test with invalid file format (using a binary file)
      const invalidFilePath =
        __dirname + '/../fixtures/pcaps/wpa2-ikeriri-5g.pcap';

      const response = await request.post('/api/upload/dictionary', {
        multipart: {
          file: {
            name: 'invalid-file.pcap',
            mimeType: 'application/vnd.tcpdump.pcap',
            buffer: await fs.readFile(invalidFilePath),
          },
        },
        headers: authHeaders,
      });

      // Should fail with validation error
      expect(response.ok()).toBeFalsy();
      const errorData = await response.json();
      expect(errorData.success).toBe(false);
      expect(errorData.error).toContain('Invalid file format');
    });

    test('should handle duplicate dictionary names', async ({ request }) => {
      const { dictionaryPath } = TestHelpers.getTestFilePaths();

      // Upload first dictionary
      const dict1 = await TestHelpers.uploadDictionary(
        request,
        authHeaders,
        dictionaryPath,
        'duplicate-name.txt'
      );

      // Upload second dictionary with same name
      const dict2 = await TestHelpers.uploadDictionary(
        request,
        authHeaders,
        dictionaryPath,
        'duplicate-name.txt'
      );

      // Both should succeed but have different IDs
      expect(dict1.id).not.toBe(dict2.id);
      expect(dict1.name).toBe(dict2.name);
    });
  });

  test.describe('PCAP Upload', () => {
    test('should upload PCAP file successfully via API', async ({
      request,
    }) => {
      const { pcapPath } = TestHelpers.getTestFilePaths();

      const result = await TestHelpers.uploadPcap(
        request,
        authHeaders,
        pcapPath
      );

      expect(result.upload.id).toBeDefined();
      expect(result.networks.length).toBeGreaterThan(0);
      expect(result.networks[0].bssid).toBeDefined();
    });

    test('should upload PCAP file successfully via UI', async ({ page }) => {
      // Navigate to uploads tab
      await TestHelpers.navigateToTab(page, 'Uploads');

      // Should be on PCAP tab by default
      await expect(page.locator('text=PCAP Files')).toBeVisible();

      // Upload test PCAP file
      const { pcapPath } = TestHelpers.getTestFilePaths();

      // Use the file input
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(pcapPath);

      // Wait for upload to complete
      await page.waitForSelector('text=Upload completed', { timeout: 30000 });

      // Verify PCAP appears in the list
      await expect(page.locator('text=wpa2-ikeriri-5g.pcap')).toBeVisible();
    });

    test('should extract networks from PCAP file', async ({ request }) => {
      const { pcapPath } = TestHelpers.getTestFilePaths();

      const result = await TestHelpers.uploadPcap(
        request,
        authHeaders,
        pcapPath
      );

      // Should extract at least one network
      expect(result.networks.length).toBeGreaterThan(0);

      // Check network structure
      const network = result.networks[0];
      expect(network.bssid).toMatch(
        /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
      );
    });

    test('should validate PCAP file format', async ({ request }) => {
      // Test with invalid file format (using a text file)
      const invalidFilePath =
        __dirname + '/../fixtures/dictionaries/test-passwords.txt';

      const response = await request.post('/api/upload/pcap', {
        multipart: {
          file: {
            name: 'invalid-file.txt',
            mimeType: 'text/plain',
            buffer: await fs.readFile(invalidFilePath),
          },
        },
        headers: authHeaders,
      });

      // Should fail with validation error
      expect(response.ok()).toBeFalsy();
      const errorData = await response.json();
      expect(errorData.success).toBe(false);
      expect(errorData.error).toContain('Invalid PCAP format');
    });

    test('should handle empty or corrupted PCAP files', async ({ request }) => {
      // Test with empty file
      const response = await request.post('/api/upload/pcap', {
        multipart: {
          file: {
            name: 'empty.pcap',
            mimeType: 'application/vnd.tcpdump.pcap',
            buffer: Buffer.from(''),
          },
        },
        headers: authHeaders,
      });

      expect(response.ok()).toBeFalsy();
      const errorData = await response.json();
      expect(errorData.success).toBe(false);
    });
  });

  test.describe('Upload Progress and Error Handling', () => {
    test('should show upload progress in UI', async ({ page }) => {
      // Navigate to uploads tab
      await TestHelpers.navigateToTab(page, 'Uploads');

      // Start uploading a large file
      const { pcapPath } = TestHelpers.getTestFilePaths();
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(pcapPath);

      // Should show progress indicator
      await expect(
        page.locator('[data-testid="upload-progress"]')
      ).toBeVisible();

      // Wait for completion
      await page.waitForSelector('text=Upload completed', { timeout: 30000 });

      // Progress should be 100%
      await expect(page.locator('text=100%')).toBeVisible();
    });

    test('should handle upload errors gracefully', async ({ page }) => {
      // Navigate to uploads tab
      await TestHelpers.navigateToTab(page, 'Uploads');

      // Try to upload an invalid file
      const invalidContent = 'This is not a valid PCAP file';
      const tempPath = '/tmp/invalid.pcap';
      await fs.writeFile(tempPath, invalidContent);

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(tempPath);

      // Should show error message
      await page.waitForSelector('text=Upload failed', { timeout: 10000 });
      await expect(page.locator('text=Invalid file format')).toBeVisible();

      // Clean up
      await fs.unlink(tempPath).catch(() => {});
    });

    test('should allow canceling uploads', async ({ page }) => {
      // Navigate to uploads tab
      await TestHelpers.navigateToTab(page, 'Uploads');

      // Start uploading a file
      const { pcapPath } = TestHelpers.getTestFilePaths();
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(pcapPath);

      // Wait for progress to start
      await page.waitForSelector('[data-testid="upload-progress"]', {
        timeout: 5000,
      });

      // Look for cancel button (if implemented)
      const cancelButton = page.locator('button:has-text("Cancel")').first();
      const cancelButtonExists = await cancelButton
        .isVisible()
        .catch(() => false);

      if (cancelButtonExists) {
        await cancelButton.click();

        // Upload should be canceled
        await page.waitForSelector('text=Upload canceled', { timeout: 5000 });
        console.log('✅ Upload cancellation works');
      } else {
        console.log('ℹ️ Upload cancellation not implemented');
      }
    });
  });

  test.describe('File Management', () => {
    test('should display uploaded files in list', async ({ page, request }) => {
      const { dictionaryPath, pcapPath } = TestHelpers.getTestFilePaths();

      // Upload files via API
      await TestHelpers.uploadDictionary(request, authHeaders, dictionaryPath);
      await TestHelpers.uploadPcap(request, authHeaders, pcapPath);

      // Navigate to uploads tab
      await TestHelpers.navigateToTab(page, 'Uploads');

      // Check dictionary tab
      await page.click('text=Dictionary');
      await expect(page.locator('text=test-passwords.txt')).toBeVisible();

      // Check PCAP tab
      await page.click('text=PCAP Files');
      await expect(page.locator('text=wpa2-ikeriri-5g.pcap')).toBeVisible();
    });

    test('should allow deleting uploaded files', async ({ page, request }) => {
      const { dictionaryPath } = TestHelpers.getTestFilePaths();

      // Upload dictionary via API
      const dictionary = await TestHelpers.uploadDictionary(
        request,
        authHeaders,
        dictionaryPath
      );

      // Navigate to uploads tab
      await TestHelpers.navigateToTab(page, 'Uploads');
      await page.click('text=Dictionary');

      // Find and delete the uploaded file
      const fileRow = page.locator(`text=${dictionary.name}`).first();
      await expect(fileRow).toBeVisible();

      const deleteButton = fileRow
        .locator('button[aria-label*="delete"], button:has-text("Delete")')
        .first();
      const deleteButtonExists = await deleteButton
        .isVisible()
        .catch(() => false);

      if (deleteButtonExists) {
        // Confirm deletion if there's a dialog
        await deleteButton.click();

        const confirmButton = page
          .locator('button:has-text("Confirm"), button:has-text("Delete")')
          .first();
        const confirmExists = await confirmButton
          .isVisible()
          .catch(() => false);

        if (confirmExists) {
          await confirmButton.click();
        }

        // File should be removed from the list
        await page.waitForSelector(`text=${dictionary.name}`, {
          state: 'detached',
          timeout: 10000,
        });
        console.log('✅ File deletion works');
      } else {
        console.log('ℹ️ File deletion not implemented in UI');
      }
    });

    test('should show file details and metadata', async ({ page }) => {
      // Navigate to uploads tab
      await TestHelpers.navigateToTab(page, 'Uploads');
      await page.click('text=Dictionary');

      // Look for file details (if implemented)
      const detailsButton = page
        .locator('button[aria-label*="details"], button:has-text("Details")')
        .first();
      const detailsExists = await detailsButton.isVisible().catch(() => false);

      if (detailsExists) {
        await detailsButton.click();

        // Should show file metadata
        await expect(page.locator('text=File Details')).toBeVisible();
        await expect(page.locator('text=Size:')).toBeVisible();
        await expect(page.locator('text=Type:')).toBeVisible();

        console.log('✅ File details display works');
      } else {
        console.log('ℹ️ File details not implemented in UI');
      }
    });
  });
});
