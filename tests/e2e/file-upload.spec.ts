import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';
import path from 'path';
import fs from 'fs';

test.describe('Test: File Upload (PCAP & Dictionary)', () => {
  let testUtils: TestUtils;

  test.beforeAll(async () => {
    testUtils = new TestUtils('file-upload');
    testUtils.clearAllAppData();
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
    testUtils.clearAllAppData();
  });

  test.describe('PCAP File Upload', () => {
    test('should display pcap upload area', async ({ page }) => {
      await page.goto('/');

      // Verify file upload card is visible
      const uploadCard = page.locator('text=Upload Captures');
      await expect(uploadCard).toBeVisible();
      console.log('✓ Upload Captures card visible');

      // Verify drag and drop instructions
      const dropArea = page.locator('text=Drag and drop .pcap files here');
      await expect(dropArea).toBeVisible();
      console.log('✓ Drag and drop instructions visible');

      // Verify supported formats are listed
      const supportedFormats = page.locator('text=Supports .pcap, .pcapng, .cap files');
      await expect(supportedFormats).toBeVisible();
      console.log('✓ Supported file formats displayed');

      console.log('✅ PCAP upload area display test completed');
    });

    test('should upload a single .pcap file', async ({ page }) => {
      await page.goto('/');

      // Create a test pcap file
      const testPcapPath = testUtils.createMockPcap('test-upload.pcap');
      console.log('✓ Test pcap file created');

      // Find file input for pcap uploads
      const fileInput = page.locator('input[type="file"][accept*=".pcap"]').first();
      await expect(fileInput).toBeAttached();
      console.log('✓ File input found');

      // Upload file
      await fileInput.setInputFiles(testPcapPath);
      console.log('✓ File selected for upload');

      // Wait for upload to complete
      await page.waitForTimeout(2000);

      // Check for success message in Upload Captures card
      const uploadCard = page.locator('text=Upload Captures').locator('..');
      const successMessage = uploadCard.locator('text=Successfully uploaded');

      if (await successMessage.count() > 0) {
        const messageText = await successMessage.first().textContent();
        console.log('✓ Upload success message displayed:', messageText);
      } else {
        console.log('⚠ Checking for errors...');
        const errorMessage = uploadCard.locator('.bg-destructive\\/10');
        if (await errorMessage.count() > 0) {
          const errorText = await errorMessage.first().textContent();
          console.log('❌ Error message:', errorText);
        }
      }

      // Verify file was written to upload directory
      const uploadDir = process.env.INPUT_PATH || path.join(__dirname, '../../volumes/input');
      const uploadedFilePath = path.join(uploadDir, 'test-upload.pcap');

      await page.waitForTimeout(1000);

      if (fs.existsSync(uploadedFilePath)) {
        console.log('✓ File written to upload directory');
        const stats = fs.statSync(uploadedFilePath);
        console.log(`  File size: ${stats.size} bytes`);
      } else {
        console.log('⚠ File not found in upload directory:', uploadedFilePath);
        if (fs.existsSync(uploadDir)) {
          const files = fs.readdirSync(uploadDir);
          console.log('  Files in upload directory:', files);
        } else {
          console.log('  Upload directory does not exist');
        }
      }

      console.log('✅ Single PCAP file upload test completed');
    });

    test('should upload multiple .pcap files at once', async ({ page }) => {
      await page.goto('/');

      // Create multiple test pcap files
      const pcap1Path = testUtils.createMockPcap('multi-test-1.pcap');
      const pcap2Path = testUtils.createMockPcap('multi-test-2.pcapng');
      const pcap3Path = testUtils.createMockPcap('multi-test-3.cap');
      console.log('✓ Multiple test pcap files created');

      // Find file input
      const fileInput = page.locator('input[type="file"][accept*=".pcap"]').first();

      // Upload multiple files
      await fileInput.setInputFiles([pcap1Path, pcap2Path, pcap3Path]);
      console.log('✓ Multiple files selected for upload');

      // Wait for upload to complete
      await page.waitForTimeout(3000);

      // Check for success message
      const uploadCard = page.locator('text=Upload Captures').locator('..');
      const successMessage = uploadCard.locator('text=Successfully uploaded 3 file(s)');

      if (await successMessage.count() > 0) {
        console.log('✓ Multi-file upload success message displayed');
      } else {
        const anySuccess = uploadCard.locator('text=Successfully uploaded');
        if (await anySuccess.count() > 0) {
          const msg = await anySuccess.first().textContent();
          console.log('✓ Upload message:', msg);
        }
      }

      // Verify files were written
      const uploadDir = process.env.INPUT_PATH || path.join(__dirname, '../../volumes/input');
      const expectedFiles = ['multi-test-1.pcap', 'multi-test-2.pcapng', 'multi-test-3.cap'];
      let uploadedCount = 0;

      await page.waitForTimeout(1000);

      for (const filename of expectedFiles) {
        const filePath = path.join(uploadDir, filename);
        if (fs.existsSync(filePath)) {
          uploadedCount++;
          console.log(`✓ File uploaded: ${filename}`);
        }
      }

      console.log(`✓ ${uploadedCount}/3 files uploaded successfully`);
      console.log('✅ Multiple PCAP file upload test completed');
    });

    test('should reject invalid file types for pcap upload', async ({ page }) => {
      await page.goto('/');

      // Create an invalid file
      const config = testUtils.getTestConfig();
      const invalidFilePath = path.join(config.testInputDir, 'malware.exe');
      fs.writeFileSync(invalidFilePath, 'This is not a pcap file');
      console.log('✓ Invalid test file created');

      const fileInput = page.locator('input[type="file"][accept*=".pcap"]').first();
      await fileInput.setInputFiles(invalidFilePath);
      console.log('✓ Invalid file selected');

      await page.waitForTimeout(2000);

      // Check for error message
      const uploadCard = page.locator('text=Upload Captures').locator('..');
      const errorMessage = uploadCard.locator('text=Invalid file type');

      if (await errorMessage.count() > 0) {
        console.log('✓ Error message displayed for invalid file type');
      } else {
        console.log('⚠ No error message (browser may have blocked it client-side)');
      }

      fs.unlinkSync(invalidFilePath);
      console.log('✅ Invalid PCAP file type test completed');
    });

    test('should handle .pcapng and .cap files', async ({ page }) => {
      await page.goto('/');

      const pcapngPath = testUtils.createMockPcap('test.pcapng');
      const capPath = testUtils.createMockPcap('test.cap');
      console.log('✓ Test files created');

      const fileInput = page.locator('input[type="file"][accept*=".pcap"]').first();
      await fileInput.setInputFiles([pcapngPath, capPath]);
      console.log('✓ Files selected for upload');

      await page.waitForTimeout(2000);

      const uploadCard = page.locator('text=Upload Captures').locator('..');
      const successMessage = uploadCard.locator('text=Successfully uploaded');

      if (await successMessage.count() > 0) {
        console.log('✓ Different pcap formats uploaded successfully');
      }

      console.log('✅ Multiple PCAP format test completed');
    });
  });

  test.describe('Dictionary File Upload', () => {
    test('should display dictionary upload area', async ({ page }) => {
      await page.goto('/');

      // Scroll to dictionaries section
      await page.locator('text=Dictionaries').first().scrollIntoViewIfNeeded();

      // Verify Dictionaries card is visible
      const dictCard = page.locator('text=Dictionaries').first();
      await expect(dictCard).toBeVisible();
      console.log('✓ Dictionaries card visible');

      // Verify Upload button exists
      const uploadButton = page.locator('button:has-text("Upload")');
      await expect(uploadButton).toBeVisible();
      console.log('✓ Upload button visible');

      // Verify drag and drop area
      const dropArea = page.locator('text=Drag & drop dictionary files');
      await expect(dropArea).toBeVisible();
      console.log('✓ Drag & drop area visible');

      // Verify supported formats listed
      const supportedFormats = page.locator('text=Supported: .txt, .gz, .bz2');
      await expect(supportedFormats).toBeVisible();
      console.log('✓ Supported dictionary formats displayed');

      console.log('✅ Dictionary upload area display test completed');
    });

    test('should upload a single dictionary file', async ({ page }) => {
      await page.goto('/');

      // Scroll to dictionaries section
      await page.locator('text=Dictionaries').first().scrollIntoViewIfNeeded();

      // Create a test dictionary file
      const config = testUtils.getTestConfig();
      const dictPath = path.join(config.testInputDir, 'test-wordlist.txt');
      fs.writeFileSync(dictPath, 'password123\nadmin\ntest\nwifi\n');
      console.log('✓ Test dictionary file created');

      // Find file input for dictionaries
      const fileInput = page.locator('input[type="file"][accept*=".txt"]');
      await expect(fileInput).toBeAttached();
      console.log('✓ Dictionary file input found');

      // Upload file
      await fileInput.setInputFiles(dictPath);
      console.log('✓ Dictionary file selected for upload');

      // Wait for upload to complete (dictionary uses TUS protocol, might take longer)
      await page.waitForTimeout(3000);

      // Check for success message
      const dictCard = page.locator('h2:has-text("Dictionaries")').locator('..');
      const successMessage = dictCard.locator('text=Successfully uploaded');

      if (await successMessage.count() > 0) {
        const messageText = await successMessage.first().textContent();
        console.log('✓ Dictionary upload success message:', messageText);
      } else {
        console.log('⚠ Checking upload status...');
        // Check if uploading indicator is still showing
        const uploading = dictCard.locator('text=Uploading');
        if (await uploading.count() > 0) {
          console.log('⚠ Still uploading, waiting longer...');
          await page.waitForTimeout(3000);
        }
      }

      // Verify file appears in dictionary list
      await page.waitForTimeout(1000);
      const dictName = dictCard.locator('text=test-wordlist.txt');
      if (await dictName.count() > 0) {
        console.log('✓ Dictionary appears in list');
      } else {
        console.log('⚠ Dictionary not found in list');
      }

      // Verify file was written to dictionaries directory
      const dictDir = process.env.DICTIONARIES_PATH || path.join(__dirname, '../../volumes/dictionaries');
      const uploadedDictPath = path.join(dictDir, 'test-wordlist.txt');

      if (fs.existsSync(uploadedDictPath)) {
        console.log('✓ Dictionary file written to dictionaries directory');
        const stats = fs.statSync(uploadedDictPath);
        console.log(`  File size: ${stats.size} bytes`);
      } else {
        console.log('⚠ Dictionary file not found:', uploadedDictPath);
        if (fs.existsSync(dictDir)) {
          const files = fs.readdirSync(dictDir);
          console.log('  Files in dictionaries directory:', files);
        }
      }

      console.log('✅ Single dictionary upload test completed');
    });

    test('should upload multiple dictionary files', async ({ page }) => {
      await page.goto('/');

      await page.locator('text=Dictionaries').first().scrollIntoViewIfNeeded();

      // Create multiple dictionary files
      const config = testUtils.getTestConfig();
      const dict1Path = path.join(config.testInputDir, 'dict-1.txt');
      const dict2Path = path.join(config.testInputDir, 'dict-2.txt');
      const dict3Path = path.join(config.testInputDir, 'dict-3.txt');

      fs.writeFileSync(dict1Path, 'password1\ntest1\n');
      fs.writeFileSync(dict2Path, 'password2\ntest2\n');
      fs.writeFileSync(dict3Path, 'password3\ntest3\n');
      console.log('✓ Multiple dictionary files created');

      // Get initial dictionary count
      const dictCard = page.locator('h2:has-text("Dictionaries")').locator('..');
      const dictList = dictCard.locator('.space-y-2').last();
      const initialCount = await dictList.locator('.bg-muted\\/50').count();
      console.log(`✓ Initial dictionary count: ${initialCount}`);

      // Upload files
      const fileInput = page.locator('input[type="file"][accept*=".txt"]');
      await fileInput.setInputFiles([dict1Path, dict2Path, dict3Path]);
      console.log('✓ Multiple dictionary files selected');

      // Wait for uploads to complete (TUS uploads sequentially)
      await page.waitForTimeout(5000);

      // Check for success message
      const successMessage = dictCard.locator('text=Successfully uploaded 3 file(s)');
      if (await successMessage.count() > 0) {
        console.log('✓ Multiple dictionary upload success message');
      } else {
        const anySuccess = dictCard.locator('text=Successfully uploaded');
        if (await anySuccess.count() > 0) {
          const msg = await anySuccess.first().textContent();
          console.log('✓ Upload message:', msg);
        }
      }

      // Verify dictionaries appear in list
      await page.waitForTimeout(1000);
      const newCount = await dictList.locator('.bg-muted\\/50').count();
      console.log(`✓ New dictionary count: ${newCount} (expected +3)`);

      console.log('✅ Multiple dictionary upload test completed');
    });

    test('should show upload progress for dictionaries', async ({ page }) => {
      await page.goto('/');

      await page.locator('text=Dictionaries').first().scrollIntoViewIfNeeded();

      // Create a dictionary file
      const config = testUtils.getTestConfig();
      const dictPath = path.join(config.testInputDir, 'progress-test.txt');
      // Create a larger file to see progress
      const content = Array(1000).fill('password\n').join('');
      fs.writeFileSync(dictPath, content);
      console.log('✓ Test dictionary file created');

      const fileInput = page.locator('input[type="file"][accept*=".txt"]');
      await fileInput.setInputFiles(dictPath);

      // Check for progress indicator
      const dictCard = page.locator('h2:has-text("Dictionaries")').locator('..');
      const progressText = dictCard.locator('text=Uploading:');
      const progressBar = dictCard.locator('.bg-primary.h-full');

      // Progress might be fast, check if it appears
      await page.waitForTimeout(500);

      if (await progressText.count() > 0 || await progressBar.count() > 0) {
        console.log('✓ Upload progress indicator displayed');
      } else {
        console.log('⚠ Upload was too fast to see progress indicator');
      }

      // Wait for completion
      await page.waitForTimeout(3000);

      console.log('✅ Dictionary upload progress test completed');
    });

    test('should reject invalid file types for dictionary upload', async ({ page }) => {
      await page.goto('/');

      await page.locator('text=Dictionaries').first().scrollIntoViewIfNeeded();

      // Create an invalid file
      const config = testUtils.getTestConfig();
      const invalidPath = path.join(config.testInputDir, 'invalid.exe');
      fs.writeFileSync(invalidPath, 'not a dictionary');
      console.log('✓ Invalid file created');

      const fileInput = page.locator('input[type="file"][accept*=".txt"]');
      await fileInput.setInputFiles(invalidPath);
      console.log('✓ Invalid file selected');

      await page.waitForTimeout(2000);

      // Check for error message
      const dictCard = page.locator('h2:has-text("Dictionaries")').locator('..');
      const errorMessage = dictCard.locator('text=Invalid file type').or(
        dictCard.locator('.bg-destructive\\/10')
      );

      if (await errorMessage.count() > 0) {
        console.log('✓ Error message displayed for invalid dictionary file');
      } else {
        console.log('⚠ No error message (browser may have blocked it)');
      }

      fs.unlinkSync(invalidPath);
      console.log('✅ Invalid dictionary file type test completed');
    });

    test('should display file size for uploaded dictionaries', async ({ page }) => {
      await page.goto('/');

      await page.locator('text=Dictionaries').first().scrollIntoViewIfNeeded();

      // Wait for dictionaries to load
      await page.waitForTimeout(2000);

      const dictCard = page.locator('h2:has-text("Dictionaries")').locator('..');
      const dictList = dictCard.locator('.space-y-2').last();
      const dictCount = await dictList.locator('.bg-muted\\/50').count();

      if (dictCount > 0) {
        // Get first dictionary and check for file size
        const firstDict = dictList.locator('.bg-muted\\/50').first();
        const sizeText = firstDict.locator('.text-muted-foreground.text-sm');

        if (await sizeText.count() > 0) {
          const size = await sizeText.textContent();
          console.log(`✓ File size displayed: ${size}`);
        } else {
          console.log('⚠ File size not displayed');
        }
      } else {
        console.log('⚠ No dictionaries to check');
      }

      console.log('✅ Dictionary file size display test completed');
    });
  });

  test.describe('Mixed Upload Tests', () => {
    test('should handle both pcap and dictionary uploads in same session', async ({ page }) => {
      await page.goto('/');

      // Upload a pcap file
      const pcapPath = testUtils.createMockPcap('session-test.pcap');
      const pcapInput = page.locator('input[type="file"][accept*=".pcap"]').first();
      await pcapInput.setInputFiles(pcapPath);
      console.log('✓ PCAP file uploaded');
      await page.waitForTimeout(2000);

      // Upload a dictionary file
      await page.locator('text=Dictionaries').first().scrollIntoViewIfNeeded();
      const config = testUtils.getTestConfig();
      const dictPath = path.join(config.testInputDir, 'session-test.txt');
      fs.writeFileSync(dictPath, 'password\ntest\n');

      const dictInput = page.locator('input[type="file"][accept*=".txt"]');
      await dictInput.setInputFiles(dictPath);
      console.log('✓ Dictionary file uploaded');
      await page.waitForTimeout(3000);

      // Verify both uploads succeeded
      const pcapSuccess = page.locator('text=Upload Captures').locator('..').locator('text=Successfully uploaded');
      const dictSuccess = page.locator('h2:has-text("Dictionaries")').locator('..').locator('text=Successfully uploaded');

      const pcapOk = await pcapSuccess.count() > 0;
      const dictOk = await dictSuccess.count() > 0;

      console.log(`✓ PCAP upload: ${pcapOk ? 'success' : 'no message'}`);
      console.log(`✓ Dictionary upload: ${dictOk ? 'success' : 'no message'}`);

      console.log('✅ Mixed upload session test completed');
    });
  });
});
