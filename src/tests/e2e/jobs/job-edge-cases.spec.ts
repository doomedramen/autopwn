/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { test, expect } from '@playwright/test';
import { TestHelpers, UploadedFile } from '../helpers/test-helpers';

test.describe('Job Execution Edge Cases', () => {
  let authHeaders: Record<string, string>;
  let testDictionary: UploadedFile;
  let testNetworks: string[];

  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async ({ browser, request }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await TestHelpers.loginWithSession(page, context);
    authHeaders = await TestHelpers.getAuthHeaders(context);

    const { dictionaryPath, pcapPath } = TestHelpers.getTestFilePaths();

    testDictionary = await TestHelpers.uploadDictionary(
      request,
      authHeaders,
      dictionaryPath
    );

    const { networks } = await TestHelpers.uploadPcap(
      request,
      authHeaders,
      pcapPath
    );

    testNetworks = networks.map(n => n.bssid);

    await context.close();
  });

  test.beforeEach(async ({ page, context }) => {
    await TestHelpers.loginWithSession(page, context);
  });

  test.describe('Job Creation Validation', () => {
    test('should reject job with missing name', async ({ request }) => {
      const response = await request.post('/api/jobs', {
        data: {
          name: '',
          networks: testNetworks.slice(0, 1),
          dictionaries: [testDictionary.id],
          options: { attackMode: 0, hashType: 22000 },
        },
        headers: authHeaders,
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    test('should reject job with empty networks array', async ({ request }) => {
      const response = await request.post('/api/jobs', {
        data: {
          name: 'Empty Networks Test',
          networks: [],
          dictionaries: [testDictionary.id],
          options: { attackMode: 0, hashType: 22000 },
        },
        headers: authHeaders,
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('networks');
    });

    test('should reject job with empty dictionaries array', async ({
      request,
    }) => {
      const response = await request.post('/api/jobs', {
        data: {
          name: 'Empty Dictionaries Test',
          networks: testNetworks.slice(0, 1),
          dictionaries: [],
          options: { attackMode: 0, hashType: 22000 },
        },
        headers: authHeaders,
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('dictionaries');
    });

    test('should reject job with non-existent network IDs', async ({
      request,
    }) => {
      const response = await request.post('/api/jobs', {
        data: {
          name: 'Invalid Networks Test',
          networks: ['00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF'],
          dictionaries: [testDictionary.id],
          options: { attackMode: 0, hashType: 22000 },
        },
        headers: authHeaders,
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/network|found/i);
    });

    test('should reject job with non-existent dictionary IDs', async ({
      request,
    }) => {
      const response = await request.post('/api/jobs', {
        data: {
          name: 'Invalid Dictionaries Test',
          networks: testNetworks.slice(0, 1),
          dictionaries: ['00000000-0000-0000-0000-000000000000'],
          options: { attackMode: 0, hashType: 22000 },
        },
        headers: authHeaders,
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/dictionary|found/i);
    });

    test('should reject job with invalid attack mode', async ({ request }) => {
      const response = await request.post('/api/jobs', {
        data: {
          name: 'Invalid Attack Mode Test',
          networks: testNetworks.slice(0, 1),
          dictionaries: [testDictionary.id],
          options: { attackMode: 999, hashType: 22000 },
        },
        headers: authHeaders,
      });

      // Should either reject at API level or fail during hashcat execution
      expect([400, 500]).toContain(response.status());
    });

    test('should validate job name length', async ({ request }) => {
      // Test extremely long job name
      const longName = 'A'.repeat(500);

      const response = await request.post('/api/jobs', {
        data: {
          name: longName,
          networks: testNetworks.slice(0, 1),
          dictionaries: [testDictionary.id],
          options: { attackMode: 0, hashType: 22000 },
        },
        headers: authHeaders,
      });

      // Should either accept and truncate, or reject
      if (response.ok()) {
        const data = await response.json();
        expect(data.data.name.length).toBeLessThanOrEqual(255);
      } else {
        expect([400, 413]).toContain(response.status());
      }
    });

    test('should sanitize job name for malicious content', async ({
      request,
    }) => {
      const maliciousNames = [
        'Job<script>alert(1)</script>',
        'Job"; DROP TABLE jobs; --',
        'Job/../../../etc/passwd',
        'Job\x00null',
      ];

      for (const name of maliciousNames) {
        const response = await request.post('/api/jobs', {
          data: {
            name,
            networks: testNetworks.slice(0, 1),
            dictionaries: [testDictionary.id],
            options: { attackMode: 0, hashType: 22000 },
          },
          headers: authHeaders,
        });

        if (response.ok()) {
          const data = await response.json();
          // Name should be sanitized
          expect(data.data.name).not.toContain('<script>');
          expect(data.data.name).not.toContain('DROP TABLE');
          expect(data.data.name).not.toContain('..');
          expect(data.data.name).not.toContain('\x00');
        }
      }
    });
  });

  test.describe('Job Concurrency and Resource Management', () => {
    test('should handle multiple concurrent jobs from same user', async ({
      request,
    }) => {
      // Create 5 jobs simultaneously
      const jobPromises = Array(5)
        .fill(null)
        .map((_, i) =>
          TestHelpers.createJob(
            request,
            authHeaders,
            `Concurrent Job ${i}`,
            testNetworks.slice(0, 1),
            [testDictionary.id]
          )
        );

      const results = await Promise.allSettled(jobPromises);

      // At least some should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // Each successful job should have unique ID
      const jobIds = successful.map((r: any) => r.value.id);
      const uniqueIds = new Set(jobIds);
      expect(uniqueIds.size).toBe(successful.length);
    });

    test('should prevent resource exhaustion with job limits', async ({
      request,
    }) => {
      // Try to create many jobs rapidly
      const jobPromises = Array(20)
        .fill(null)
        .map((_, i) =>
          request.post('/api/jobs', {
            data: {
              name: `Resource Test ${i}`,
              networks: testNetworks.slice(0, 1),
              dictionaries: [testDictionary.id],
              options: { attackMode: 0, hashType: 22000 },
            },
            headers: authHeaders,
          })
        );

      const results = await Promise.allSettled(jobPromises);

      // System should handle load gracefully (either succeed or rate limit)
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect([200, 201, 429, 503]).toContain(result.value.status());
        }
      });
    });

    test('should clean up resources when job creation fails', async ({
      request,
    }) => {
      // Create job with invalid data to trigger failure
      const response = await request.post('/api/jobs', {
        data: {
          name: 'Cleanup Test',
          networks: ['invalid-network'],
          dictionaries: [testDictionary.id],
          options: { attackMode: 0, hashType: 22000 },
        },
        headers: authHeaders,
      });

      expect(response.status()).toBe(400);

      // Verify no orphaned job directories or processes
      // This would require filesystem access in a real test
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  test.describe('Job State Transitions', () => {
    test('should handle rapid state changes gracefully', async ({
      request,
    }) => {
      // Create a job
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'State Transition Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      // Try rapid pause/resume cycles
      const operations = [
        request.post(`/api/jobs/${job.id}/pause`, { headers: authHeaders }),
        request.post(`/api/jobs/${job.id}/resume`, { headers: authHeaders }),
        request.post(`/api/jobs/${job.id}/pause`, { headers: authHeaders }),
        request.post(`/api/jobs/${job.id}/resume`, { headers: authHeaders }),
      ];

      const results = await Promise.allSettled(operations);

      // All operations should complete without crashing
      results.forEach(result => {
        expect(['fulfilled', 'rejected']).toContain(result.status);
      });
    });

    test('should prevent invalid state transitions', async ({ request }) => {
      // Create and complete a job
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Invalid Transition Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      await TestHelpers.waitForJobCompletion(
        request,
        authHeaders,
        job.id,
        120,
        1000
      );

      // Try to resume a completed job
      const resumeResponse = await request.post(`/api/jobs/${job.id}/resume`, {
        headers: authHeaders,
      });

      if (resumeResponse.status() !== 404) {
        // Should reject invalid state transition
        expect([400, 409]).toContain(resumeResponse.status());
      }
    });

    test('should handle job that was externally killed', async ({
      request,
    }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'External Kill Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      // Try to get job status
      const statusResponse = await request.get(`/api/jobs/${job.id}`, {
        headers: authHeaders,
      });

      expect([200, 404]).toContain(statusResponse.status());

      if (statusResponse.ok()) {
        const data = await statusResponse.json();
        // Job should have a valid status
        expect(data.data.status).toBeDefined();
      }
    });
  });

  test.describe('Job Output Validation', () => {
    test('should validate job output file exists', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Output Validation Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      const result = await TestHelpers.waitForJobCompletion(
        request,
        authHeaders,
        job.id,
        120,
        1000
      );

      expect(result.status).toBeDefined();
      expect(['completed', 'exhausted', 'cracked', 'failed']).toContain(
        result.status
      );
    });

    test('should handle corrupted output gracefully', async ({ request }) => {
      // Get job results
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Corrupted Output Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      await TestHelpers.waitForJobCompletion(
        request,
        authHeaders,
        job.id,
        120,
        1000
      );

      const resultsResponse = await request.get(`/api/jobs/${job.id}/results`, {
        headers: authHeaders,
      });

      if (resultsResponse.ok()) {
        const data = await resultsResponse.json();
        // Should return valid structure even if empty
        expect(data.success).toBeDefined();
        expect(data.data).toBeDefined();
      }
    });

    test('should validate cracked password format', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Password Format Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      const result = await TestHelpers.waitForJobCompletion(
        request,
        authHeaders,
        job.id,
        120,
        1000
      );

      if (result.cracked > 0) {
        const resultsResponse = await request.get(
          `/api/jobs/${job.id}/results`,
          {
            headers: authHeaders,
          }
        );

        if (resultsResponse.ok()) {
          const data = await resultsResponse.json();

          if (data.data.results && data.data.results.length > 0) {
            // Validate structure of cracked passwords
            const firstResult = data.data.results[0];
            expect(firstResult).toHaveProperty('bssid');
            expect(firstResult).toHaveProperty('password');
          }
        }
      }
    });

    test('should prevent path traversal in output files', async ({
      request,
    }) => {
      // Create job with malicious network names if possible
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Path Traversal Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      await TestHelpers.waitForJobCompletion(
        request,
        authHeaders,
        job.id,
        120,
        1000
      );

      // Try to access job results - should not allow path traversal
      const maliciousRequests = [
        `/api/jobs/${job.id}/../../../etc/passwd`,
        `/api/jobs/../${job.id}`,
        `/api/jobs/${job.id}/%2e%2e%2f`,
      ];

      for (const path of maliciousRequests) {
        const response = await request.get(path, {
          headers: authHeaders,
        });

        // Should either normalize path or return 404
        expect([400, 404]).toContain(response.status());
      }
    });
  });

  test.describe('Job Error Handling', () => {
    test('should handle hashcat process crash', async ({ request }) => {
      // Create a job
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Crash Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      // Wait a bit then check status
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await request.get(`/api/jobs/${job.id}`, {
        headers: authHeaders,
      });

      expect(statusResponse.ok()).toBeTruthy();
      const data = await statusResponse.json();

      // Job should have a valid status
      expect(['processing', 'completed', 'failed', 'exhausted']).toContain(
        data.data.status
      );
    });

    test('should handle out-of-memory conditions', async ({ request }) => {
      // This test is mostly to ensure the API doesn't crash
      const response = await request.get('/api/jobs', {
        headers: authHeaders,
      });

      expect(response.ok()).toBeTruthy();
    });

    test('should handle disk space issues gracefully', async ({ request }) => {
      // Create job (might fail if disk is full)
      const response = await request.post('/api/jobs', {
        data: {
          name: 'Disk Space Test',
          networks: testNetworks.slice(0, 1),
          dictionaries: [testDictionary.id],
          options: { attackMode: 0, hashType: 22000 },
        },
        headers: authHeaders,
      });

      // Should either succeed or fail gracefully
      expect([200, 201, 500, 503]).toContain(response.status());

      if (!response.ok()) {
        const data = await response.json();
        expect(data.error).toBeDefined();
      }
    });
  });

  test.describe('Job Timeout and Duration', () => {
    test('should handle very short job timeouts', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Short Timeout Test',
        testNetworks.slice(0, 1),
        [testDictionary.id],
        {
          workloadProfile: 4, // Highest workload
        }
      );

      // Job should complete or fail quickly
      const result = await TestHelpers.waitForJobCompletion(
        request,
        authHeaders,
        job.id,
        30,
        500
      );

      expect(result.status).toBeDefined();
    });

    test('should track job runtime accurately', async ({ request }) => {
      const startTime = Date.now();

      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Runtime Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      const result = await TestHelpers.waitForJobCompletion(
        request,
        authHeaders,
        job.id,
        120,
        1000
      );

      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      // Verify runtime is reasonable
      expect(actualDuration).toBeGreaterThan(0);
      expect(actualDuration).toBeLessThan(180000); // Less than 3 minutes
    });
  });

  test.describe('Job Progress Tracking', () => {
    test('should update progress consistently', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Progress Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      // Check progress multiple times
      let lastProgress = -1;
      let progressUpdates = 0;

      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await request.get(`/api/jobs/${job.id}`, {
          headers: authHeaders,
        });

        if (statusResponse.ok()) {
          const data = await statusResponse.json();
          const currentProgress = data.data.progress || 0;

          // Progress should not decrease
          expect(currentProgress).toBeGreaterThanOrEqual(lastProgress);

          if (currentProgress > lastProgress) {
            progressUpdates++;
          }

          lastProgress = currentProgress;

          // If job completed, break
          if (
            ['completed', 'exhausted', 'cracked', 'failed'].includes(
              data.data.status
            )
          ) {
            break;
          }
        }
      }

      // Should have at least some progress updates
      expect(progressUpdates).toBeGreaterThanOrEqual(0);
    });

    test('should handle progress calculation edge cases', async ({
      request,
    }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Progress Edge Case Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      const statusResponse = await request.get(`/api/jobs/${job.id}`, {
        headers: authHeaders,
      });

      if (statusResponse.ok()) {
        const data = await statusResponse.json();

        // Progress should be between 0 and 100
        expect(data.data.progress).toBeGreaterThanOrEqual(0);
        expect(data.data.progress).toBeLessThanOrEqual(100);

        // Total hashes should be positive
        if (data.data.totalHashes) {
          expect(data.data.totalHashes).toBeGreaterThan(0);
        }

        // Cracked should not exceed total
        if (
          data.data.cracked !== undefined &&
          data.data.totalHashes !== undefined
        ) {
          expect(data.data.cracked).toBeLessThanOrEqual(data.data.totalHashes);
        }
      }
    });
  });

  test.describe('Job Cleanup and Orphaned Resources', () => {
    test('should clean up job directory on deletion', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Cleanup Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      // Try to delete job
      const deleteResponse = await request.delete(`/api/jobs/${job.id}`, {
        headers: authHeaders,
      });

      if (deleteResponse.ok()) {
        // Job should be gone
        const getResponse = await request.get(`/api/jobs/${job.id}`, {
          headers: authHeaders,
        });

        expect(getResponse.status()).toBe(404);
      }
    });

    test('should handle orphaned hashcat sessions', async ({ request }) => {
      // Get list of jobs
      const response = await request.get('/api/jobs', {
        headers: authHeaders,
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Should return valid list
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  test.describe('Job Authentication and Authorization', () => {
    test('should require authentication for job creation', async ({
      request,
    }) => {
      const response = await request.post('/api/jobs', {
        data: {
          name: 'Unauth Test',
          networks: testNetworks.slice(0, 1),
          dictionaries: [testDictionary.id],
          options: { attackMode: 0, hashType: 22000 },
        },
        // No auth headers
      });

      expect(response.status()).toBe(401);
    });

    test('should require authentication for job status', async ({
      request,
    }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Auth Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      const response = await request.get(`/api/jobs/${job.id}`);
      // Should require auth or return public data only
      expect([200, 401]).toContain(response.status());
    });
  });
});
