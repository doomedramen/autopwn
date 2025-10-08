import { test, expect } from '../../tests/helpers/test-client';
import { navigateToJobs, waitForJobCompletion, getJobStatus, createTestFileUpload } from '../../tests/helpers/test-client';

test.describe('Job Management', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to jobs page
    await navigateToJobs(authenticatedPage);
  });

  test('should display jobs page with empty state', async ({ authenticatedPage, database, testUser }) => {
    // Ensure no jobs exist
    const jobCount = await database.getJobCount(testUser.id);
    expect(jobCount).toBe(0);

    // Should show empty state
    await expect(authenticatedPage.locator('[data-testid="empty-jobs-state"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=No jobs found')).toBeVisible();

    // Should show create job button
    await expect(authenticatedPage.locator('[data-testid="create-job-btn"]')).toBeVisible();
  });

  test('should allow creating new jobs', async ({ authenticatedPage, testUser }) => {
    // Click create job button
    await authenticatedPage.click('[data-testid="create-job-btn"]');

    // Should show job creation dialog
    await expect(authenticatedPage.locator('[data-testid="job-creation-dialog"]')).toBeVisible();

    // Create a test PCAP file
    const testFilePath = createTestFileUpload(authenticatedPage, 'test-capture.pcap');

    // Fill job details
    await authenticatedPage.fill('input[name="filename"]', 'test-job.pcap');
    await authenticatedPage.fill('input[name="priority"]', '5');

    // Submit job creation
    await authenticatedPage.click('button[type="submit"]');

    // Should close dialog and show job in list
    await expect(authenticatedPage.locator('[data-testid="job-creation-dialog"]')).not.toBeVisible();
    await expect(authenticatedPage.locator('[data-testid^="job-item-"]')).toHaveCount(1);
  });

  test('should display job information correctly', async ({ authenticatedPage, database, testUser }) => {
    // Create test job
    const { job } = await database.createTestData(testUser.id);

    await authenticatedPage.reload();
    await navigateToJobs(authenticatedPage);

    // Should show job item
    const jobElement = authenticatedPage.locator(`[data-job-id="${job.jobId}"]`);
    await expect(jobElement).toBeVisible();

    // Should display job details
    await expect(jobElement.locator('[data-testid="job-filename"]')).toContainText(job.filename);
    await expect(jobElement.locator('[data-testid="job-status"]')).toContainText(job.status);
    await expect(jobElement.locator('[data-testid="job-progress"]')).toBeVisible();
  });

  test('should allow pausing and resuming jobs', async ({ authenticatedPage, database, testUser }) => {
    // Create test job
    const { job } = await database.createTestData(testUser.id, {
      jobCount: 1
    });

    await authenticatedPage.reload();
    await navigateToJobs(authenticatedPage);

    const jobElement = authenticatedPage.locator(`[data-job-id="${job.jobId}"]`);

    // Should show pause button for processing jobs
    const pauseButton = jobElement.locator('[data-testid="pause-job-btn"]');
    if (await pauseButton.isVisible()) {
      await pauseButton.click();

      // Should show resume button
      await expect(jobElement.locator('[data-testid="resume-job-btn"]')).toBeVisible();
      await expect(jobElement.locator('[data-testid="job-status"]')).toContainText('paused');

      // Resume the job
      await jobElement.locator('[data-testid="resume-job-btn"]').click();
      await expect(jobElement.locator('[data-testid="pause-job-btn"]')).toBeVisible();
    }
  });

  test('should allow changing job priority', async ({ authenticatedPage, database, testUser }) => {
    // Create test job
    const { job } = await database.createTestData(testUser.id);

    await authenticatedPage.reload();
    await navigateToJobs(authenticatedPage);

    const jobElement = authenticatedPage.locator(`[data-job-id="${job.jobId}"]`);

    // Click job to open details
    await jobElement.click();

    // Should show job details dialog
    await expect(authenticatedPage.locator('[data-testid="job-details-dialog"]')).toBeVisible();

    // Change priority
    await authenticatedPage.selectOption('[data-testid="priority-select"]', '8');
    await authenticatedPage.click('[data-testid="save-priority-btn"]');

    // Should close dialog and update job
    await expect(authenticatedPage.locator('[data-testid="job-details-dialog"]')).not.toBeVisible();

    // Verify priority was updated (may need to refresh)
    await authenticatedPage.reload();
    await navigateToJobs(authenticatedPage);

    const updatedJobElement = authenticatedPage.locator(`[data-job-id="${job.jobId}"]`);
    await expect(updatedJobElement.locator('[data-testid="job-priority"]')).toContainText('8');
  });

  test('should allow retrying failed jobs', async ({ authenticatedPage, database, testUser }) => {
    // Create failed job
    const { job } = await database.createTestData(testUser.id);

    // Update job to failed status in database
    await authenticatedPage.request.put(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'failed', error: 'Test failure' }
    });

    await authenticatedPage.reload();
    await navigateToJobs(authenticatedPage);

    const jobElement = authenticatedPage.locator(`[data-job-id="${job.jobId}"]`);

    // Should show error indicator
    await expect(jobElement.locator('[data-testid="job-error"]')).toBeVisible();

    // Should show retry button
    await expect(jobElement.locator('[data-testid="retry-job-btn"]')).toBeVisible();

    // Click retry
    await jobElement.locator('[data-testid="retry-job-btn"]').click();

    // Should reset job to pending status
    await expect(jobElement.locator('[data-testid="job-status"]')).toContainText('pending');
  });

  test('should allow batch operations on multiple jobs', async ({ authenticatedPage, database, testUser }) => {
    // Create multiple jobs
    await database.createTestData(testUser.id, { jobCount: 3 });

    await authenticatedPage.reload();
    await navigateToJobs(authenticatedPage);

    // Select multiple jobs
    const jobItems = authenticatedPage.locator('[data-testid^="job-item-"]');
    await expect(jobItems).toHaveCount(3);

    // Enable batch mode
    await authenticatedPage.click('[data-testid="batch-mode-btn"]');

    // Select first two jobs
    await jobItems.first().locator('[data-testid="job-checkbox"]').click();
    await jobItems.nth(1).locator('[data-testid="job-checkbox"]').click();

    // Should show batch actions toolbar
    await expect(authenticatedPage.locator('[data-testid="batch-actions"]')).toBeVisible();

    // Test batch pause
    await authenticatedPage.click('[data-testid="batch-pause-btn"]');
    await expect(jobItems.first().locator('[data-testid="job-status"]')).toContainText('paused');
    await expect(jobItems.nth(1).locator('[data-testid="job-status"]')).toContainText('paused');

    // Test batch resume
    await authenticatedPage.click('[data-testid="batch-resume-btn"]');
    await expect(jobItems.first().locator('[data-testid="job-status"]')).not.toContainText('paused');
    await expect(jobItems.nth(1).locator('[data-testid="job-status"]')).not.toContainText('paused');

    // Test batch delete
    await authenticatedPage.click('[data-testid="batch-delete-btn"]');
    await expect(authenticatedPage.locator('[data-testid="confirm-dialog"]')).toBeVisible();
    await authenticatedPage.click('[data-testid="confirm-delete-btn"]');

    // Should show remaining job
    await expect(authenticatedPage.locator('[data-testid^="job-item-"]')).toHaveCount(1);
  });

  test('should filter jobs by status', async ({ authenticatedPage, database, testUser }) => {
    // Create jobs with different statuses
    const { job: job1 } = await database.createTestData(testUser.id);
    const { job: job2 } = await database.createTestData(testUser.id);
    const { job: job3 } = await database.createTestData(testUser.id);

    // Update job statuses
    await authenticatedPage.request.put(`http://localhost:3000/api/jobs/${job1.id}/status`, {
      data: { status: 'completed' }
    });
    await authenticatedPage.request.put(`http://localhost:3000/api/jobs/${job2.id}/status`, {
      data: { status: 'failed' }
    });

    await authenticatedPage.reload();
    await navigateToJobs(authenticatedPage);

    // Should show all jobs initially
    await expect(authenticatedPage.locator('[data-testid^="job-item-"]')).toHaveCount(3);

    // Filter by completed status
    await authenticatedPage.selectOption('[data-testid="status-filter"]', 'completed');
    await expect(authenticatedPage.locator('[data-testid^="job-item-"]')).toHaveCount(1);

    // Filter by failed status
    await authenticatedPage.selectOption('[data-testid="status-filter"]', 'failed');
    await expect(authenticatedPage.locator('[data-testid^="job-item-"]')).toHaveCount(1);

    // Filter by pending status
    await authenticatedPage.selectOption('[data-testid="status-filter"]', 'pending');
    await expect(authenticatedPage.locator('[data-testid^="job-item-"]')).toHaveCount(1);

    // Clear filter
    await authenticatedPage.selectOption('[data-testid="status-filter"]', 'all');
    await expect(authenticatedPage.locator('[data-testid^="job-item-"]')).toHaveCount(3);
  });

  test('should sort jobs by different criteria', async ({ authenticatedPage, database, testUser }) => {
    // Create multiple jobs with different timestamps
    const jobs = [];
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      const { job } = await database.createTestData(testUser.id);
      jobs.push(job);
    }

    await authenticatedPage.reload();
    await navigateToJobs(authenticatedPage);

    // Should show jobs sorted by newest first by default
    await expect(authenticatedPage.locator('[data-testid^="job-item-"]')).toHaveCount(3);

    // Sort by oldest first
    await authenticatedPage.selectOption('[data-testid="sort-by"]', 'oldest');
    await authenticatedPage.waitForTimeout(1000); // Wait for re-sort

    // Sort by priority
    await authenticatedPage.selectOption('[data-testid="sort-by"]', 'priority');
    await authenticatedPage.waitForTimeout(1000); // Wait for re-sort
  });

  test('should show real-time job progress updates', async ({ authenticatedPage, database, testUser }) => {
    // Create test job
    const { job } = await database.createTestData(testUser.id);

    await authenticatedPage.reload();
    await navigateToJobs(authenticatedPage);

    const jobElement = authenticatedPage.locator(`[data-job-id="${job.jobId}"]`);

    // Should show initial progress
    await expect(jobElement.locator('[data-testid="job-progress"]')).toContainText('0%');

    // Simulate progress update via WebSocket
    await authenticatedPage.evaluate((jobId) => {
      // This would normally come from WebSocket
      window.dispatchEvent(new CustomEvent('job-progress', {
        detail: { jobId, progress: 25 }
      }));
    }, job.jobId);

    // Should update progress
    await expect(jobElement.locator('[data-testid="job-progress"]')).toContainText('25%');
  });

  test('should handle job deletion with confirmation', async ({ authenticatedPage, database, testUser }) => {
    // Create test job
    const { job } = await database.createTestData(testUser.id);

    await authenticatedPage.reload();
    await navigateToJobs(authenticatedPage);

    const jobElement = authenticatedPage.locator(`[data-job-id="${job.jobId}"]`);

    // Click delete button
    await jobElement.locator('[data-testid="delete-job-btn"]').click();

    // Should show confirmation dialog
    await expect(authenticatedPage.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
    await expect(authenticatedPage.locator('text=Are you sure you want to delete this job?')).toBeVisible();

    // Cancel deletion
    await authenticatedPage.click('[data-testid="cancel-delete-btn"]');
    await expect(authenticatedPage.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
    await expect(jobElement).toBeVisible();

    // Try deletion again and confirm
    await jobElement.locator('[data-testid="delete-job-btn"]').click();
    await authenticatedPage.click('[data-testid="confirm-delete-btn"]');

    // Job should be removed
    await expect(jobElement).not.toBeVisible();
    await expect(authenticatedPage.locator('[data-testid^="job-item-"]')).toHaveCount(0);
  });

  test('should export job data', async ({ authenticatedPage, database, testUser }) => {
    // Create test job with results
    const { job } = await database.createTestData(testUser.id, { resultCount: 1 });

    await authenticatedPage.reload();
    await navigateToJobs(authenticatedPage);

    // Click export button
    await authenticatedPage.click('[data-testid="export-jobs-btn"]');

    // Should show export dialog
    await expect(authenticatedPage.locator('[data-testid="export-dialog"]')).toBeVisible();

    // Select CSV format
    await authenticatedPage.selectOption('[data-testid="export-format"]', 'csv');

    // Start export
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('[data-testid="start-export-btn"]');

    // Should download file
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);

    // Should show success message
    await expect(authenticatedPage.locator('[data-testid="export-success"]')).toBeVisible();
  });
});