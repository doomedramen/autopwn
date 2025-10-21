import { test, expect } from '../fixtures/auth-fixture';
import { TestUtils } from '../helpers/test-utils';

test.describe('File Upload Functionality', () => {
  test('should allow authenticated user to upload files', async ({ page }) => {
    // Navigate to the upload page
    await page.goto('/upload'); // Replace with your actual upload page path

    // Wait for page to load
    await TestUtils.waitForNetworkIdle(page);
    
    // Verify page is accessible
    await expect(page.locator('text=Upload')).toBeVisible();

    // Check if upload area is visible
    const uploadArea = page.locator('.upload, [data-testid="upload-area"], input[type="file"]');
    await expect(uploadArea).toBeVisible();

    // Upload a test file from fixtures
    const testFile = '../fixtures/test-passwords.txt'; // Adjust path as needed
    
    // Try different approaches for file upload depending on UI
    try {
      // If it's a simple file input
      await page.locator('input[type="file"]').setInputFiles(testFile);
    } catch (e) {
      // If it's a drag and drop area
      try {
        await page.locator('[data-testid="upload-area"]').setInputFiles(testFile);
      } catch (e2) {
        // Alternative: Click to open file dialog and then select file
        await page.locator('text=Choose File, Upload').click();
        await page.locator('input[type="file"]').setInputFiles(testFile);
      }
    }

    // Wait for upload to complete
    await TestUtils.waitForApiRequest(page, /upload|api/, 15000);

    // Verify upload success (adjust selectors based on your UI)
    await expect(page.locator('text=Upload successful, Success, Completed')).toBeVisible({ timeout: 10000 });
  });

  test('should show error for invalid file types', async ({ page }) => {
    // Navigate to the upload page
    await page.goto('/upload'); // Replace with your actual upload page path

    // Try to upload an invalid file type
    // For this test, we'll try to upload a JavaScript file if your app doesn't allow it
    const invalidFile = {
      name: 'test-script.js',
      mimeType: 'application/javascript',
      buffer: Buffer.from('console.log("test");')
    };

    // Try uploading invalid file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: invalidFile.name,
      mimeType: invalidFile.mimeType,
      buffer: invalidFile.buffer
    });

    // Verify error message is shown
    await expect(page.locator('text=Invalid file type, Error, Not allowed')).toBeVisible({ timeout: 5000 });
  });

  test('should handle large file uploads gracefully', async ({ page }) => {
    // Note: For large file tests, you might want to create a larger test file in your fixtures
    // This is just a template for how to handle large uploads
    
    // Navigate to the upload page
    await page.goto('/upload');
    
    // Simulate large file upload (in a real scenario, you'd have a large test file)
    // The implementation would depend on your UI and how it handles large files
    await expect(page.locator('text=Upload')).toBeVisible();
    
    // Add progress bar or timeout indicators as appropriate for your application
    await page.waitForTimeout(2000); // Brief pause to simulate processing
  });
});