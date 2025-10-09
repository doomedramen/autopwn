import { test, expect } from '../../tests/helpers/test-client';
import { navigateToDictionaries, createTestDictionaryFile, createLargeTestDictionary } from '../../tests/helpers/test-client';

test.describe('Dictionary Management', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to dictionaries page
    await navigateToDictionaries(authenticatedPage);
  });

  test('should display dictionaries page with empty state', async ({ authenticatedPage, database, testUser }) => {
    // Ensure no dictionaries exist
    const dictCount = await database.getDictionaryCount(testUser.id);
    expect(dictCount).toBe(0);

    // Should show empty state
    await expect(authenticatedPage.locator('[data-testid="empty-dictionaries-state"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=No dictionaries yet')).toBeVisible();

    // Should show upload buttons
    await expect(authenticatedPage.locator('[data-testid="upload-dictionaries-btn"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="create-dictionary-btn"]')).toBeVisible();
  });

  test('should allow creating simple dictionary manually', async ({ authenticatedPage, testUser }) => {
    // Click create dictionary button
    await authenticatedPage.click('[data-testid="create-dictionary-btn"]');

    // Should show create dictionary dialog
    await expect(authenticatedPage.locator('[data-testid="create-dictionary-dialog"]')).toBeVisible();
    await expect(authenticatedPage.locator('input[name="dict-name"]')).toBeVisible();
    await expect(authenticatedPage.locator('textarea[name="dict-content"]')).toBeVisible();

    // Fill dictionary details
    await authenticatedPage.fill('input[name="dict-name"]', 'Test Manual Dictionary');
    await authenticatedPage.fill('textarea[name="dict-content"]', 'password123\nadmin123\n123456\nqwerty\nletmein');

    // Submit creation
    await authenticatedPage.click('button[type="submit"]');

    // Should close dialog and show dictionary in list
    await expect(authenticatedPage.locator('[data-testid="create-dictionary-dialog"]')).not.toBeVisible();
    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toHaveCount(1);

    // Should show dictionary details
    const dictElement = authenticatedPage.locator('[data-testid^="dictionary-item-"]').first();
    await expect(dictElement.locator('[data-testid="dictionary-name"]')).toContainText('Test Manual Dictionary');
    await expect(dictElement.locator('[data-testid="dictionary-size"]')).toBeVisible();
    await expect(dictElement.locator('[data-testid="dictionary-type"]')).toContainText('Dictionary');
  });

  test('should allow uploading dictionary files with chunked upload', async ({ authenticatedPage }) => {
    // Click upload dictionaries button
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Should show chunked upload dialog
    await expect(authenticatedPage.locator('[data-testid="chunked-upload-dialog"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Upload Dictionaries')).toBeVisible();
    await expect(authenticatedPage.locator('text=Upload large dictionary files with chunked, resumable uploads')).toBeVisible();

    // Should show supported formats
    await expect(authenticatedPage.locator('text=Hashcat-compatible dictionaries up to 5GB')).toBeVisible();
    await expect(authenticatedPage.locator('text=.txt, .dict, .wordlist, .gz, .bz2, .zip, .7z, .rar')).toBeVisible();

    // Create test dictionary file
    const testDictionary = createTestDictionaryFile('test-upload.txt', 100); // 100 passwords

    // Upload file using Uppy interface
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testDictionary);

    // Should show file in upload queue
    await expect(authenticatedPage.locator('[data-testid="uppy-file-item"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=test-upload.txt')).toBeVisible();

    // Click upload button
    await authenticatedPage.click('[data-testid="upload-files-btn"]');

    // Should show upload progress
    await expect(authenticatedPage.locator('[data-testid="upload-progress"]')).toBeVisible();

    // Wait for upload to complete (progress should reach 100%)
    await expect(authenticatedPage.locator('[data-testid="upload-progress"]')).toContainText('100%', { timeout: 30000 });

    // Should show success message
    await expect(authenticatedPage.locator('[data-testid="upload-success"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Successfully uploaded 1 file(s)')).toBeVisible();

    // Dialog should close automatically
    await expect(authenticatedPage.locator('[data-testid="chunked-upload-dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Should show dictionary in list
    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toHaveCount(1);
    const dictElement = authenticatedPage.locator('[data-testid^="dictionary-item-"]').first();
    await expect(dictElement.locator('[data-testid="dictionary-name"]')).toContainText('test-upload.txt');
  });

  test('should handle multiple dictionary uploads simultaneously', async ({ authenticatedPage }) => {
    // Click upload dictionaries button
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Create multiple test dictionary files
    const dict1 = createTestDictionaryFile('wordlist1.txt', 50);
    const dict2 = createTestDictionaryFile('wordlist2.txt', 75);
    const dict3 = createTestDictionaryFile('rockyou.txt', 100);

    // Upload multiple files
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([dict1, dict2, dict3]);

    // Should show all files in upload queue
    await expect(authenticatedPage.locator('[data-testid="uppy-file-item"]')).toHaveCount(3);

    // Click upload button
    await authenticatedPage.click('[data-testid="upload-files-btn"]');

    // Should show upload progress
    await expect(authenticatedPage.locator('[data-testid="upload-progress"]')).toBeVisible();

    // Wait for all uploads to complete
    await expect(authenticatedPage.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 60000 });
    await expect(authenticatedPage.locator('text=Successfully uploaded 3 file(s)')).toBeVisible();

    // Should show all dictionaries in list
    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toHaveCount(3);
  });

  test('should support compressed dictionary formats', async ({ authenticatedPage }) => {
    // Click upload dictionaries button
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Create compressed dictionary files
    const gzDict = createTestDictionaryFile('compressed.gz', 200, { compressed: true, format: 'gz' });
    const zipDict = createTestDictionaryFile('archive.zip', 150, { compressed: true, format: 'zip' });

    // Upload compressed files
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([gzDict, zipDict]);

    // Should show files in upload queue
    await expect(authenticatedPage.locator('[data-testid="uppy-file-item"]')).toHaveCount(2);

    // Click upload button
    await authenticatedPage.click('[data-testid="upload-files-btn"]');

    // Wait for uploads to complete
    await expect(authenticatedPage.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 60000 });
    await expect(authenticatedPage.locator('text=Successfully uploaded 2 file(s)')).toBeVisible();

    // Should show dictionaries in list
    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toHaveCount(2);

    // Verify file extensions are preserved
    const dictNames = await authenticatedPage.locator('[data-testid="dictionary-name"]').allTextContents();
    expect(dictNames.some(name => name.includes('.gz'))).toBe(true);
    expect(dictNames.some(name => name.includes('.zip'))).toBe(true);
  });

  test('should handle large dictionary files with chunked uploads', async ({ authenticatedPage }) => {
    // Create large dictionary file (>5MB to trigger chunking)
    const largeDict = createLargeTestDictionary('large-dict.txt', 10000); // 10K passwords

    // Click upload dictionaries button
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Upload large file
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(largeDict);

    // Should show file with large size
    await expect(authenticatedPage.locator('[data-testid="uppy-file-item"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=large-dict.txt')).toBeVisible();

    // Click upload button
    await authenticatedPage.click('[data-testid="upload-files-btn"]');

    // Should show progress indicator for chunked upload
    await expect(authenticatedPage.locator('[data-testid="upload-progress"]')).toBeVisible();

    // Monitor chunked upload progress
    let lastProgress = 0;
    for (let i = 0; i < 20; i++) { // Max 40 seconds wait
      const progressText = await authenticatedPage.locator('[data-testid="upload-progress"]').textContent();
      const currentProgress = parseInt(progressText?.match(/(\d+)%/)?.[1] || '0');

      // Progress should increase or complete
      expect(currentProgress >= lastProgress).toBe(true);
      if (currentProgress === 100) break;

      lastProgress = currentProgress;
      await authenticatedPage.waitForTimeout(2000);
    }

    // Should complete successfully
    await expect(authenticatedPage.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 60000 });

    // Should show large dictionary in list
    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toHaveCount(1);
    const dictElement = authenticatedPage.locator('[data-testid^="dictionary-item-"]').first();
    await expect(dictElement.locator('[data-testid="dictionary-name"]')).toContainText('large-dict.txt');
  });

  test('should handle upload errors gracefully', async ({ authenticatedPage }) => {
    // Click upload dictionaries button
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Try to upload invalid file type
    const invalidFile = Buffer.from('invalid content', 'utf-8');
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;

    // Uppy should reject invalid file types
    await fileChooser.setFiles({
      name: 'invalid.exe',
      mimeType: 'application/octet-stream',
      buffer: invalidFile
    });

    // Should show error message
    await expect(authenticatedPage.locator('[data-testid="uppy-error"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=You can only upload')).toBeVisible();
  });

  test('should allow deleting dictionaries', async ({ authenticatedPage, database, testUser }) => {
    // Create test dictionary via database
    await database.createTestDictionary(testUser.id, 'Test Dictionary', 'password\nadmin\n123456');

    await authenticatedPage.reload();
    await navigateToDictionaries(authenticatedPage);

    // Should show dictionary
    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toHaveCount(1);
    const dictElement = authenticatedPage.locator('[data-testid^="dictionary-item-"]').first();

    // Click delete button
    await dictElement.locator('[data-testid="delete-dictionary-btn"]').click();

    // Should show confirmation dialog
    await expect(authenticatedPage.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Are you sure you want to delete')).toBeVisible();

    // Cancel deletion
    await authenticatedPage.click('[data-testid="cancel-delete-btn"]');
    await expect(authenticatedPage.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
    await expect(dictElement).toBeVisible();

    // Confirm deletion
    await dictElement.locator('[data-testid="delete-dictionary-btn"]').click();
    await authenticatedPage.click('[data-testid="confirm-delete-btn"]');

    // Dictionary should be removed
    await expect(dictElement).not.toBeVisible();
    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toHaveCount(0);

    // Should show empty state again
    await expect(authenticatedPage.locator('[data-testid="empty-dictionaries-state"]')).toBeVisible();
  });

  test('should display dictionary information correctly', async ({ authenticatedPage, database, testUser }) => {
    // Create test dictionary with specific content
    const dictContent = 'password123\nadmin123\n123456\nqwerty\nletmein\nwelcome\nmonkey\ndragon';
    await database.createTestDictionary(testUser.id, 'Test Info Dictionary', dictContent);

    await authenticatedPage.reload();
    await navigateToDictionaries(authenticatedPage);

    const dictElement = authenticatedPage.locator('[data-testid^="dictionary-item-"]').first();

    // Should display dictionary details
    await expect(dictElement.locator('[data-testid="dictionary-name"]')).toContainText('Test Info Dictionary');
    await expect(dictElement.locator('[data-testid="dictionary-size"]')).toBeVisible();
    await expect(dictElement.locator('[data-testid="dictionary-type"]')).toContainText('Dictionary');

    // Size should be reasonable (8 lines of text)
    const sizeText = await dictElement.locator('[data-testid="dictionary-size"]').textContent();
    expect(sizeText).toMatch(/\d+ B/); // Should show bytes
  });

  test('should handle resumable uploads for interrupted connections', async ({ authenticatedPage }) => {
    // Create medium-sized dictionary
    const mediumDict = createTestDictionaryFile('resumable.txt', 1000);

    // Click upload dictionaries button
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Start upload
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.locator('[data-testid="uppy-dashboard"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(mediumDict);

    await authenticatedPage.click('[data-testid="upload-files-btn"]');

    // Wait for upload to start
    await expect(authenticatedPage.locator('[data-testid="upload-progress"]')).toBeVisible();

    // Simulate network interruption by pausing
    await authenticatedPage.click('[data-testid="pause-upload-btn"]');

    // Should show paused state
    await expect(authenticatedPage.locator('[data-testid="upload-paused"]')).toBeVisible();

    // Resume upload
    await authenticatedPage.click('[data-testid="resume-upload-btn"]');

    // Should continue and complete
    await expect(authenticatedPage.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 60000 });
  });

  test('should show proper file type validation messages', async ({ authenticatedPage }) => {
    // Click upload dictionaries button
    await authenticatedPage.click('[data-testid="upload-dictionaries-btn"]');

    // Should display supported formats in the UI
    await expect(authenticatedPage.locator('text=Formats: .txt, .dict, .wordlist, .gz, .bz2, .zip')).toBeVisible();
    await expect(authenticatedPage.locator('text=Hashcat-compatible dictionaries up to 5GB')).toBeVisible();

    // The drop zone should show appropriate message
    await expect(authenticatedPage.locator('text=Drop dictionary files here or click to browse')).toBeVisible();
  });

  test('should handle batch dictionary operations', async ({ authenticatedPage, database, testUser }) => {
    // Create multiple test dictionaries
    await database.createTestDictionary(testUser.id, 'Dict 1', 'password1\nadmin1');
    await database.createTestDictionary(testUser.id, 'Dict 2', 'password2\nadmin2');
    await database.createTestDictionary(testUser.id, 'Dict 3', 'password3\nadmin3');

    await authenticatedPage.reload();
    await navigateToDictionaries(authenticatedPage);

    // Should show all dictionaries
    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toHaveCount(3);

    // Test batch selection mode
    await authenticatedPage.click('[data-testid="batch-mode-btn"]');
    await expect(authenticatedPage.locator('[data-testid="batch-actions"]')).toBeVisible();

    // Select multiple dictionaries
    const dictItems = authenticatedPage.locator('[data-testid^="dictionary-item-"]');
    await dictItems.first().locator('[data-testid="dictionary-checkbox"]').click();
    await dictItems.nth(1).locator('[data-testid="dictionary-checkbox"]').click();

    // Should show selected count
    await expect(authenticatedPage.locator('[data-testid="selected-count"]')).toContainText('2');

    // Test batch delete
    await authenticatedPage.click('[data-testid="batch-delete-btn"]');
    await expect(authenticatedPage.locator('[data-testid="confirm-dialog"]')).toBeVisible();
    await authenticatedPage.click('[data-testid="confirm-batch-delete-btn"]');

    // Should show remaining dictionary
    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toHaveCount(1);
  });

  test('should provide dictionary analytics and insights', async ({ authenticatedPage, database, testUser }) => {
    // Create dictionary with various password types
    const dictContent = `password123
admin123
123456
qwerty
letmein
welcome
monkey
dragon
password1
admin
1234567890
test123
guest
user1
root
toor
pass123
changeme
default
iloveyou`;

    await database.createTestDictionary(testUser.id, 'Analytics Test Dict', dictContent);

    await authenticatedPage.reload();
    await navigateToDictionaries(authenticatedPage);

    const dictElement = authenticatedPage.locator('[data-testid^="dictionary-item-"]').first();

    // Click on dictionary to see details
    await dictElement.click();

    // Should show dictionary details dialog
    await expect(authenticatedPage.locator('[data-testid="dictionary-details-dialog"]')).toBeVisible();

    // Should show dictionary statistics
    await expect(authenticatedPage.locator('[data-testid="dictionary-stats"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="password-count"]')).toContainText('20');
    await expect(authenticatedPage.locator('[data-testid="unique-passwords"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="dictionary-coverage"]')).toBeVisible();

    // Should show usage statistics
    await expect(authenticatedPage.locator('[data-testid="usage-stats"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="jobs-used"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="success-rate"]')).toBeVisible();
  });
});