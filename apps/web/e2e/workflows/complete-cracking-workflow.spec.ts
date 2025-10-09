import { test, expect } from '../../tests/helpers/test-client';
import {
  createTestFileUpload,
  waitForJobCompletion,
  getJobStatus,
  navigateToJobs,
  navigateToAnalytics
} from '../../tests/helpers/test-client';

test.describe('Complete Cracking Workflow', () => {
  test('should handle full workflow from upload to results', async ({
    authenticatedPage,
    database,
    testUser
  }) => {
    // 1. Start at dashboard with empty state
    await authenticatedPage.goto('/');
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="empty-state"]')).toBeVisible();

    // 2. Navigate to jobs page
    await navigateToJobs(authenticatedPage);
    await expect(authenticatedPage.locator('[data-testid="empty-jobs-state"]')).toBeVisible();

    // 3. Create new job
    await authenticatedPage.click('[data-testid="create-job-btn"]');
    await expect(authenticatedPage.locator('[data-testid="job-creation-dialog"]')).toBeVisible();

    // 4. Upload WPA2 PCAP file with known handshake
    const testFilePath = createTestFileUpload(authenticatedPage, 'wpa2-dictionary.cap');

    // 5. Fill job details
    await authenticatedPage.fill('input[name="filename"]', 'wpa2-dictionary-test.cap');
    await authenticatedPage.fill('input[name="priority"]', '5');

    // 6. Submit job
    await authenticatedPage.click('button[type="submit"]');
    await expect(authenticatedPage.locator('[data-testid="job-creation-dialog"]')).not.toBeVisible();

    // 7. Verify job appears in list
    await expect(authenticatedPage.locator('[data-testid^="job-item-"]')).toHaveCount(1);

    // 8. Get job ID for later verification
    const jobElement = authenticatedPage.locator('[data-testid^="job-item-"]').first();
    const jobId = await jobElement.getAttribute('data-job-id');
    expect(jobId).toBeTruthy();

    // 9. Verify initial job status
    await expect(jobElement.locator('[data-testid="job-status"]')).toContainText('pending');
    await expect(jobElement.locator('[data-testid="job-progress"]')).toContainText('0%');

    // 10. Navigate back to dashboard
    await authenticatedPage.click('[data-testid="nav-dashboard"]');
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();

    // 11. Should show job in recent activity
    await expect(authenticatedPage.locator(`[data-job-id="${jobId}"]`)).toBeVisible();

    // 12. Should update stats cards
    await expect(authenticatedPage.locator('[data-testid="total-jobs-card"]')).toBeVisible();

    // 13. Simulate job completion via database
    await database.createTestData(testUser.id, { resultCount: 1 });

    // 14. Navigate to analytics
    await navigateToAnalytics(authenticatedPage);
    await expect(authenticatedPage.locator('[data-testid="analytics-container"]')).toBeVisible();

    // 15. Should see updated analytics
    await expect(authenticatedPage.locator('[data-testid="total-jobs-metric"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="total-cracks-stat"]')).toBeVisible();

    // 16. Export analytics data
    await authenticatedPage.click('[data-testid="export-analytics-btn"]');
    await expect(authenticatedPage.locator('[data-testid="export-dialog"]')).toBeVisible();

    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('[data-testid="confirm-export-btn"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    // 17. Verify user session persists
    await authenticatedPage.reload();
    await expect(authenticatedPage.locator('[data-testid="user-menu"]')).toBeVisible();

    // 18. Logout
    await authenticatedPage.click('[data-testid="user-menu"]');
    await authenticatedPage.click('text=Logout');
    await expect(authenticatedPage).toHaveURL('**/auth/signin');

    // 19. Verify protected routes redirect to login
    await authenticatedPage.goto('/');
    await expect(authenticatedPage).toHaveURL('**/auth/signin');
  });

  test('should handle batch job processing workflow', async ({
    authenticatedPage,
    database,
    testUser
  }) => {
    // Create multiple jobs
    const jobs = [];
    for (let i = 0; i < 3; i++) {
      await navigateToJobs(authenticatedPage);

      await authenticatedPage.click('[data-testid="create-job-btn"]');
      createTestFileUpload(authenticatedPage, `wpa2-test-${i}.cap`);
      await authenticatedPage.fill('input[name="filename"]', `wpa2-test-job-${i}.cap`);
      await authenticatedPage.click('button[type="submit"]');

      await expect(authenticatedPage.locator('[data-testid="job-creation-dialog"]')).not.toBeVisible();

      const jobElement = authenticatedPage.locator('[data-testid^="job-item-"]').nth(i);
      const jobId = await jobElement.getAttribute('data-job-id');
      jobs.push(jobId);
    }

    // Enable batch mode
    await authenticatedPage.click('[data-testid="batch-mode-btn"]');
    await expect(authenticatedPage.locator('[data-testid="batch-actions"]')).toBeVisible();

    // Select all jobs
    const jobItems = authenticatedPage.locator('[data-testid^="job-item-"]');
    await expect(jobItems).toHaveCount(3);

    for (let i = 0; i < 3; i++) {
      await jobItems.nth(i).locator('[data-testid="job-checkbox"]').click();
    }

    // Set high priority for all selected jobs
    await authenticatedPage.click('[data-testid="batch-priority-btn"]');
    await authenticatedPage.selectOption('[data-testid="batch-priority-select"]', '8');
    await authenticatedPage.click('[data-testid="save-batch-priority-btn"]');

    // Start all jobs
    await authenticatedPage.click('[data-testid="batch-start-btn"]');

    // Verify all jobs are processing
    for (let i = 0; i < 3; i++) {
      await expect(jobItems.nth(i).locator('[data-testid="job-status"]')).toContainText('processing');
    }

    // Monitor progress
    let allCompleted = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const jobItemsList = await jobItems.all();
      const statuses = await Promise.all(
        jobItemsList.map(async item => {
          const jobId = await item.getAttribute('data-job-id');
          return getJobStatus(authenticatedPage, jobId || '');
        })
      );

      const completedCount = statuses.filter((status: string) => status === 'completed').length;
      if (completedCount === 3) {
        allCompleted = true;
        break;
      }

      await authenticatedPage.waitForTimeout(2000);
    }

    expect(allCompleted).toBe(true);

    // Check results
    await authenticatedPage.goto('/results');
    await expect(authenticatedPage.locator('[data-testid="results-table"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid^="result-item-"]')).toHaveCount(3);
  });

  test('should handle error recovery workflow', async ({
    authenticatedPage,
    database,
    testUser
  }) => {
    // Create job that will fail
    await navigateToJobs(authenticatedPage);

    await authenticatedPage.click('[data-testid="create-job-btn"]');
    createTestFileUpload(authenticatedPage, 'corrupted.cap');
    await authenticatedPage.fill('input[name="filename"]', 'corrupted-wpa2.cap');
    await authenticatedPage.click('button[type="submit"]');

    const jobElement = authenticatedPage.locator('[data-testid^="job-item-"]').first();
    const jobId = await jobElement.getAttribute('data-job-id');

    // Simulate job failure
    await authenticatedPage.request.put(`http://localhost:3000/api/jobs/${jobId}/status`, {
      data: { status: 'failed', error: 'Invalid PCAP file format' }
    });

    await authenticatedPage.reload();
    await navigateToJobs(authenticatedPage);

    // Should show error state
    await expect(jobElement.locator('[data-testid="job-error"]')).toBeVisible();
    await expect(jobElement.locator('[data-testid="job-status"]')).toContainText('failed');

    // Should allow retry
    await expect(jobElement.locator('[data-testid="retry-job-btn"]')).toBeVisible();
    await jobElement.locator('[data-testid="retry-job-btn"]').click();

    // Should reset to pending
    await expect(jobElement.locator('[data-testid="job-status"]')).toContainText('pending');

    // Should allow deletion if still fails
    await jobElement.locator('[data-testid="delete-job-btn"]').click();
    await authenticatedPage.click('[data-testid="confirm-delete-btn"]');
    await expect(jobElement).not.toBeVisible();
  });

  test('should handle dictionary management workflow', async ({
    authenticatedPage,
    database,
    testUser
  }) => {
    // Navigate to dictionaries page
    await authenticatedPage.click('[data-testid="nav-dictionaries"]');
    await expect(authenticatedPage.locator('[data-testid="dictionaries-page"]')).toBeVisible();

    // Should show empty state initially
    await expect(authenticatedPage.locator('[data-testid="empty-dictionaries-state"]')).toBeVisible();

    // Upload dictionary
    await authenticatedPage.click('[data-testid="upload-dictionary-btn"]');
    await expect(authenticatedPage.locator('[data-testid="dictionary-upload-dialog"]')).toBeVisible();

    // Create test dictionary file
    const dictionaryContent = 'password\n123456\nadmin\nletmein\nwelcome';
    const dictionaryBuffer = Buffer.from(dictionaryContent, 'utf-8');

    const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
    await authenticatedPage.click('input[type="file"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test-dictionary.txt',
      mimeType: 'text/plain',
      buffer: dictionaryBuffer
    });

    await authenticatedPage.fill('input[name="dictionary-name"]', 'Test Dictionary');
    await authenticatedPage.click('button[type="submit"]');

    // Should show dictionary in list
    await expect(authenticatedPage.locator('[data-testid^="dictionary-item-"]')).toHaveCount(1);
    await expect(authenticatedPage.locator('[data-testid="dictionary-name"]')).toContainText('Test Dictionary');
    await expect(authenticatedPage.locator('[data-testid="dictionary-size"]')).toContainText('5');

    // Create job using this dictionary
    await navigateToJobs(authenticatedPage);
    await authenticatedPage.click('[data-testid="create-job-btn"]');
    createTestFileUpload(authenticatedPage, 'wpa2-with-dict.cap');
    await authenticatedPage.fill('input[name="filename"]', 'wpa2-with-dict.cap');

    // Select dictionary
    await authenticatedPage.selectOption('[data-testid="dictionary-select"]', 'Test Dictionary');
    await authenticatedPage.click('button[type="submit"]');

    // Should create job with dictionary
    await expect(authenticatedPage.locator('[data-testid^="job-item-"]')).toHaveCount(1);
    await expect(authenticatedPage.locator('[data-testid="job-dictionary"]')).toContainText('Test Dictionary');

    // Check dictionary effectiveness in analytics
    await navigateToAnalytics(authenticatedPage);
    await expect(authenticatedPage.locator('[data-testid="dictionary-effectiveness"]')).toBeVisible();
  });

  test('should handle WebSocket real-time updates workflow', async ({
    authenticatedPage,
    database,
    testUser
  }) => {
    // Start with dashboard
    await authenticatedPage.goto('/');
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();

    // Create job
    await navigateToJobs(authenticatedPage);
    await authenticatedPage.click('[data-testid="create-job-btn"]');
    createTestFileUpload(authenticatedPage, 'wpa2-realtime.cap');
    await authenticatedPage.fill('input[name="filename"]', 'wpa2-realtime.cap');
    await authenticatedPage.click('button[type="submit"]');

    const jobElement = authenticatedPage.locator('[data-testid^="job-item-"]').first();
    const jobId = await jobElement.getAttribute('data-job-id');

    // Navigate to dashboard to monitor
    await authenticatedPage.click('[data-testid="nav-dashboard"]');

    // Simulate real-time progress updates
    const progressUpdates = [25, 50, 75, 100];
    for (const progress of progressUpdates) {
      // Simulate WebSocket update
      await authenticatedPage.evaluate(({ jobId, progress }) => {
        window.dispatchEvent(new CustomEvent('job-progress', {
          detail: { jobId, progress }
        }));
      }, { jobId, progress });

      await authenticatedPage.waitForTimeout(500);

      // Should update progress
      const jobOnDashboard = authenticatedPage.locator(`[data-job-id="${jobId}"]`);
      await expect(jobOnDashboard.locator('[data-testid="job-progress"]')).toContainText(`${progress}%`);
    }

    // Simulate job completion
    await authenticatedPage.evaluate((jobId) => {
      window.dispatchEvent(new CustomEvent('job-completed', {
        detail: {
          jobId,
          status: 'completed',
          result: {
            essid: 'TestNetwork',
            password: 'foundpassword123'
          }
        }
      }));
    }, jobId);

    await authenticatedPage.waitForTimeout(1000);

    // Should show completion
    const jobOnDashboard = authenticatedPage.locator(`[data-job-id="${jobId}"]`);
    await expect(jobOnDashboard.locator('[data-testid="job-status"]')).toContainText('completed');

    // Should update stats
    await expect(authenticatedPage.locator('[data-testid="completed-jobs-card"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="total-cracks-card"]')).toBeVisible();
  });
});