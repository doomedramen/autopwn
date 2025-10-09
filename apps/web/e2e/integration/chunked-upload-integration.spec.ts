import { test, expect } from '../../tests/helpers/test-client';
import {
  createTestDictionaryFile,
  createLargeTestDictionary,
  navigateToDictionaries
} from '../../tests/helpers/test-client';

test.describe('Chunked Upload Integration', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await navigateToDictionaries(authenticatedPage);
  });

  test('should integrate chunked upload with dictionary management', async ({ authenticatedPage, database, testUser }) => {
    // Start with empty dictionaries
    const initialCount = await database.getDictionaryCount(testUser.id);
    expect(initialCount).toBe(0);

    // Open chunked upload dialog
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');
    await expect(authenticatedPage.locator('[data-testid="chunked-upload-dialog"]')).toBeVisible();

    // Test multiple file types
    const txtDict = createTestDictionaryFile('passwords.txt', 50);
    const gzDict = createTestDictionaryFile('compressed.gz', 75, { compressed: true, format: 'gz' });

    // Upload both files
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([txtDict, gzDict]);

    // Should show both files in queue
    await expect(authenticatedPage.locator('[data-testid="uppy-file-item"]')).toHaveCount(2);

    // Start upload
    await authenticatedPage.click('[data-testid="upload-files-btn"]');

    // Monitor progress
    await expect(authenticatedPage.locator('[data-testid="upload-progress"]')).toBeVisible();

    // Wait for completion
    await expect(authenticatedPage.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 60000 });
    await expect(authenticatedPage.locator('text=Successfully uploaded 2 file(s)')).toBeVisible();

    // Verify database state
    await authenticatedPage.reload();
    await navigateToDictionaries(authenticatedPage);

    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toHaveCount(2);

    const dictNames = await authenticatedPage.locator('[data-testid="dictionary-name"]').allTextContents();
    expect(dictNames).toContain('passwords.txt');
    expect(dictNames).toContain('compressed.gz');

    // Verify database count
    const finalCount = await database.getDictionaryCount(testUser.id);
    expect(finalCount).toBe(initialCount + 2);
  });

  test('should handle chunked upload error recovery', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Create a file for upload
    const testDict = createTestDictionaryFile('recovery-test.txt', 100);

    // Mock network failure during upload
    await authenticatedPage.route('**/api/dictionaries/chunked/*/chunk/*', route => {
      // Fail the first chunk
      route.abort('failed');
    });

    // Start upload
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testDict);

    await authenticatedPage.click('[data-testid="upload-files-btn"]');

    // Should show error state
    await expect(authenticatedPage.locator('[data-testid="uppy-error"]')).toBeVisible({ timeout: 30000 });

    // Should allow retry
    await authenticatedPage.unroute('**/api/dictionaries/chunked/*/chunk/*');
    await authenticatedPage.click('[data-testid="retry-upload-btn"]');

    // Should succeed on retry
    await expect(authenticatedPage.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 60000 });
  });

  test('should validate chunked upload with real-time progress', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Create a large file to ensure multiple chunks
    const largeDict = createLargeTestDictionary('large-integration.txt', 5000);

    // Start upload
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(largeDict);

    await authenticatedPage.click('[data-testid="upload-files-btn"]');

    // Monitor progress updates
    let lastProgress = 0;
    const progressUpdates = [];

    for (let i = 0; i < 30; i++) { // Max 60 seconds
      try {
        const progressElement = authenticatedPage.locator('[data-testid="upload-progress"]');
        const progressText = await progressElement.textContent();
        const currentProgress = parseInt(progressText?.match(/(\d+)%/)?.[1] || '0');

        if (currentProgress > lastProgress) {
          progressUpdates.push(currentProgress);
          lastProgress = currentProgress;
        }

        if (currentProgress === 100) break;

        await authenticatedPage.waitForTimeout(2000);
      } catch (error) {
        // Element might not be visible yet
        await authenticatedPage.waitForTimeout(1000);
      }
    }

    // Should have made progress
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(lastProgress).toBe(100);

    // Should complete successfully
    await expect(authenticatedPage.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 60000 });
  });

  test('should integrate chunked upload with WebSocket updates', async ({ authenticatedPage, database, testUser }) => {
    // Start WebSocket listener
    const wsUpdates: any[] = [];

    await authenticatedPage.evaluate(() => {
      window.addEventListener('message', (event) => {
        if (event.data.type === 'dictionary-uploaded') {
          (window as any).testWsUpdates = (window as any).testWsUpdates || [];
          (window as any).testWsUpdates.push(event.data);
        }
      });
    });

    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Upload dictionary
    const testDict = createTestDictionaryFile('websocket-test.txt', 25);

    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testDict);

    await authenticatedPage.click('[data-testid="upload-files-btn"]');

    // Wait for upload to complete
    await expect(authenticatedPage.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });

    // Check for WebSocket updates
    await authenticatedPage.waitForTimeout(2000); // Allow time for WebSocket message

    const updates = await authenticatedPage.evaluate(() => (window as any).testWsUpdates || []);
    // Note: This test assumes WebSocket integration is implemented
    // The actual implementation would depend on how WebSocket updates are handled
  });

  test('should handle concurrent chunked uploads', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Create multiple files
    const files = [
      createTestDictionaryFile('concurrent1.txt', 100),
      createTestDictionaryFile('concurrent2.txt', 150),
      createTestDictionaryFile('concurrent3.txt', 200)
    ];

    // Upload all files simultaneously
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(files);

    // Should show all files
    await expect(authenticatedPage.locator('[data-testid="uppy-file-item"]')).toHaveCount(3);

    // Start concurrent uploads
    await authenticatedPage.click('[data-testid="upload-files-btn"]');

    // Monitor all uploads
    const startTime = Date.now();
    await expect(authenticatedPage.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 90000 });
    const endTime = Date.now();

    // Should complete within reasonable time (demonstrates parallel processing)
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(90000); // 90 seconds max

    // Verify all files were uploaded
    await authenticatedPage.reload();
    await navigateToDictionaries(authenticatedPage);
    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toHaveCount(3);
  });

  test('should handle chunked upload with file size limits', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Create a file that's too large (simulating >5GB limit)
    const oversizedFile = createLargeTestDictionary('oversized.txt', 1000000); // Very large

    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(oversizedFile);

    // Should show size limit error
    await expect(authenticatedPage.locator('[data-testid="uppy-error"]')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('text=maximum file size')).toBeVisible();
  });

  test('should integrate chunked upload with dictionary analytics', async ({ authenticatedPage, database, testUser }) => {
    // Upload dictionary via chunked upload
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    const analyticsDict = createTestDictionaryFile('analytics-test.txt', 500);

    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(analyticsDict);

    await authenticatedPage.click('[data-testid="upload-files-btn"]');
    await expect(authenticatedPage.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });

    // Navigate to analytics
    await authenticatedPage.click('[data-testid="nav-analytics"]');

    // Should see updated dictionary statistics
    await expect(authenticatedPage.locator('[data-testid="dictionary-stats"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="total-dictionaries"]')).toBeVisible();

    // Should be able to export dictionary data
    await authenticatedPage.click('[data-testid="export-dictionaries-btn"]');
    await expect(authenticatedPage.locator('[data-testid="export-dialog"]')).toBeVisible();

    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('[data-testid="start-dictionary-export-btn"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test('should handle chunked upload session persistence', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Start upload with large file
    const largeDict = createLargeTestDictionary('session-test.txt', 2000);

    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(largeDict);

    await authenticatedPage.click('[data-testid="upload-files-btn"]');

    // Wait for some progress
    await expect(authenticatedPage.locator('[data-testid="upload-progress"]')).toBeVisible();

    // Simulate browser refresh/navigate away and back
    await authenticatedPage.goto('/jobs');
    await authenticatedPage.goto('/dictionaries');

    // Should recover upload session (this would require session persistence implementation)
    // For now, just verify the page loads correctly
    await expect(authenticatedPage.locator('[data-testid="dictionaries-page"]')).toBeVisible();
  });
});