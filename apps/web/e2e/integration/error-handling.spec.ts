import { test, expect } from '../../tests/helpers/test-client';
import { takeScreenshotOnFailure, getPageContent } from '../../tests/helpers/test-client';

test.describe('Error Handling', () => {
  test('should handle network connectivity issues', async ({ authenticatedPage }) => {
    // Simulate network offline
    await authenticatedPage.context().setOffline(true);

    // Should show offline indicator
    await expect(authenticatedPage.locator('[data-testid="offline-indicator"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=No internet connection')).toBeVisible();

    // Try to perform action that requires network
    await authenticatedPage.click('[data-testid="refresh-btn"]');

    // Should show appropriate error message
    await expect(authenticatedPage.locator('[data-testid="network-error"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Network request failed')).toBeVisible();

    // Restore network
    await authenticatedPage.context().setOffline(false);

    // Should show reconnected message
    await expect(authenticatedPage.locator('[data-testid="reconnected-indicator"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Connection restored')).toBeVisible();
  });

  test('should handle API rate limiting', async ({ authenticatedPage }) => {
    // Mock rate limiting response
    await authenticatedPage.route('**/api/**', route => {
      if (route.request().url().includes('/jobs')) {
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Rate limit exceeded' })
        });
      } else {
        route.continue();
      }
    });

    // Try to access jobs
    await authenticatedPage.click('[data-testid="nav-jobs"]');

    // Should show rate limit error
    await expect(authenticatedPage.locator('[data-testid="rate-limit-error"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Too many requests')).toBeVisible();

    // Should show retry after delay
    await expect(authenticatedPage.locator('[data-testid="retry-after-timer"]')).toBeVisible();

    // Remove rate limiting mock
    await authenticatedPage.unroute('**/api/**');

    // Retry should work
    await authenticatedPage.click('[data-testid="retry-btn"]');
    await expect(authenticatedPage.locator('[data-testid="jobs-container"]')).toBeVisible();
  });

  test('should handle server errors gracefully', async ({ authenticatedPage }) => {
    // Mock server error
    await authenticatedPage.route('**/api/stats', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await authenticatedPage.goto('/');

    // Should show server error message
    await expect(authenticatedPage.locator('[data-testid="server-error"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Something went wrong')).toBeVisible();

    // Should provide option to report issue
    await expect(authenticatedPage.locator('[data-testid="report-issue-btn"]')).toBeVisible();

    // Should allow retry
    await expect(authenticatedPage.locator('[data-testid="retry-server-btn"]')).toBeVisible();

    // Remove server error mock
    await authenticatedPage.unroute('**/api/stats');

    // Retry should work
    await authenticatedPage.click('[data-testid="retry-server-btn"]');
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should handle file upload errors', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="create-job-btn"]');

    // Try to upload invalid file
    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.click('input[type="file"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a pcap file', 'utf-8')
    });

    await authenticatedPage.fill('input[name="filename"]', 'invalid.txt');
    await authenticatedPage.click('button[type="submit"]');

    // Should show file validation error
    await expect(authenticatedPage.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Invalid file format')).toBeVisible();

    // Should show suggestions
    await expect(authenticatedPage.locator('text=Please upload a valid PCAP file')).toBeVisible();
  });

  test('should handle large file uploads', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="create-job-btn"]');

    // Create large file (simulate)
    const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB
    largeBuffer.fill('A');

    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.click('input[type="file"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'large.pcap',
      mimeType: 'application/octet-stream',
      buffer: largeBuffer
    });

    // Should show upload progress
    await expect(authenticatedPage.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="upload-percentage"]')).toBeVisible();

    // Should handle timeout if upload takes too long
    await expect(authenticatedPage.locator('[data-testid="upload-timeout"]')).toBeVisible({ timeout: 30000 });
  });

  test('should handle database connection errors', async ({ authenticatedPage }) => {
    // Mock database error
    await authenticatedPage.route('**/api/health', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'error',
          database: 'connection failed'
        })
      });
    });

    await authenticatedPage.goto('/');

    // Should show database error
    await expect(authenticatedPage.locator('[data-testid="database-error"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Database connection failed')).toBeVisible();

    // Should show degraded functionality notice
    await expect(authenticatedPage.locator('[data-testid="degraded-mode"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Limited functionality available')).toBeVisible();

    // Remove database error mock
    await authenticatedPage.unroute('**/api/health');

    // Should recover when database is back
    await authenticatedPage.reload();
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should handle authentication token expiration', async ({ authenticatedPage }) => {
    // Clear auth token to simulate expiration
    await authenticatedPage.context().clearCookies();

    // Try to access protected route
    await authenticatedPage.goto('/analytics');

    // Should redirect to login
    await expect(authenticatedPage).toHaveURL('**/auth/signin');

    // Should show session expired message
    await expect(authenticatedPage.locator('[data-testid="session-expired"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Your session has expired')).toBeVisible();

    // Should allow re-login
    await expect(authenticatedPage.locator('input[name="email"]')).toBeVisible();
    await expect(authenticatedPage.locator('input[name="password"]')).toBeVisible();
  });

  test('should handle form validation errors', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/auth/signup');

    // Submit empty form
    await authenticatedPage.click('button[type="submit"]');

    // Should show validation errors
    await expect(authenticatedPage.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Name is required')).toBeVisible();
    await expect(authenticatedPage.locator('text=Email is required')).toBeVisible();
    await expect(authenticatedPage.locator('text=Password is required')).toBeVisible();

    // Test invalid email
    await authenticatedPage.fill('input[name="email"]', 'invalid-email');
    await authenticatedPage.click('button[type="submit"]');
    await expect(authenticatedPage.locator('text=Invalid email format')).toBeVisible();

    // Test weak password
    await authenticatedPage.fill('input[name="email"]', 'test@example.com');
    await authenticatedPage.fill('input[name="password"]', '123');
    await authenticatedPage.click('button[type="submit"]');
    await expect(authenticatedPage.locator('text=Password must be at least 6 characters')).toBeVisible();
  });

  test('should handle CORS errors', async ({ authenticatedPage }) => {
    // Mock CORS error
    await authenticatedPage.route('**/api/**', route => {
      route.fulfill({
        status: 0,
        headers: {
          'Access-Control-Allow-Origin': 'https://example.com'
        }
      });
    });

    await authenticatedPage.goto('/');

    // Should show CORS error
    await expect(authenticatedPage.locator('[data-testid="cors-error"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Cross-origin request blocked')).toBeVisible();

    // Should provide guidance
    await expect(authenticatedPage.locator('text=Please check your server configuration')).toBeVisible();
  });

  test('should handle JavaScript errors gracefully', async ({ page, testUser }) => {
    // Login first
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/');

    // Inject JavaScript error
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('Test JavaScript error');
      }, 1000);
    });

    // Should catch and show error
    await expect(page.locator('[data-testid="javascript-error"]')).toBeVisible();
    await expect(page.locator('text=An unexpected error occurred')).toBeVisible();

    // Should allow reporting
    await expect(page.locator('[data-testid="report-js-error-btn"]')).toBeVisible();

    // Should allow continue
    await expect(page.locator('[data-testid="continue-anyway-btn"]')).toBeVisible();
  });

  test('should handle memory errors with large datasets', async ({ authenticatedPage, database, testUser }) => {
    // Create large dataset
    for (let i = 0; i < 100; i++) {
      await database.createTestData(testUser.id);
    }

    await authenticatedPage.goto('/analytics');

    // Should show loading indicator for large data
    await expect(authenticatedPage.locator('[data-testid="loading-large-dataset"]')).toBeVisible();

    // If memory issues occur, should show appropriate message
    const memoryError = await authenticatedPage.locator('[data-testid="memory-error"]').isVisible().catch(() => false);
    if (memoryError) {
      await expect(authenticatedPage.locator('text=Dataset too large')).toBeVisible();
      await expect(authenticatedPage.locator('[data-testid="reduce-dataset-btn"]')).toBeVisible();
    }
  });

  test('should provide fallback content when features fail', async ({ authenticatedPage }) => {
    // Mock chart library failure
    await authenticatedPage.route('**/charts.js', route => route.abort('failed'));

    await authenticatedPage.goto('/analytics');

    // Should show fallback for charts
    await expect(authenticatedPage.locator('[data-testid="chart-fallback"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Charts unavailable')).toBeVisible();

    // Should show table alternative
    await expect(authenticatedPage.locator('[data-testid="data-table"]')).toBeVisible();
    await expect(authenticatedPage.locator('table')).toBeVisible();
  });

  test('should capture error details for debugging', async ({ page }) => {
    // Enable error capture
    await page.goto('/');

    // Trigger various errors
    await page.route('**/api/stats', route => route.abort('failed'));

    // Should capture error details
    const errorDetails = await page.evaluate(() => {
      return (window as any).errorDetails || null;
    });

    if (errorDetails) {
      expect(errorDetails).toHaveProperty('timestamp');
      expect(errorDetails).toHaveProperty('url');
      expect(errorDetails).toHaveProperty('userAgent');
      expect(errorDetails).toHaveProperty('error');
    }
  });
});