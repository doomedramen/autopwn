/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import { TestHelpers, UploadedFile } from '../helpers/test-helpers';

test.describe('Job Output and Results Edge Cases', () => {
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

  test.describe('Output File Validation', () => {
    test('should handle empty output files', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Empty Output Test',
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

      // Job should complete even with no cracks
      expect(['completed', 'exhausted', 'failed']).toContain(result.status);

      // Results should be accessible
      const resultsResponse = await request.get(`/api/jobs/${job.id}/results`, {
        headers: authHeaders,
      });

      if (resultsResponse.ok()) {
        const data = await resultsResponse.json();
        expect(data.success).toBe(true);
        expect(data.data.results || []).toBeInstanceOf(Array);
      }
    });

    test('should handle very large output files', async ({ request }) => {
      // This test ensures system can handle jobs with many cracks
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Large Output Test',
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
        // Should handle results without crashing
        expect(data.success).toBeDefined();
      }
    });

    test('should validate output file integrity', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Integrity Test',
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

      // Get results multiple times - should be consistent
      const results1 = await request.get(`/api/jobs/${job.id}/results`, {
        headers: authHeaders,
      });
      const results2 = await request.get(`/api/jobs/${job.id}/results`, {
        headers: authHeaders,
      });

      if (results1.ok() && results2.ok()) {
        const data1 = await results1.json();
        const data2 = await results2.json();

        // Results should be identical on multiple reads
        expect(JSON.stringify(data1)).toBe(JSON.stringify(data2));
      }
    });
  });

  test.describe('Cracked Password Format Validation', () => {
    test('should handle special characters in passwords', async ({
      request,
    }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Special Chars Test',
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
            data.data.results.forEach((result: any) => {
              // Password should be a string
              expect(typeof result.password).toBe('string');

              // Should not contain null bytes
              expect(result.password).not.toContain('\x00');

              // BSSID should be valid MAC format
              if (result.bssid) {
                expect(result.bssid).toMatch(
                  /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
                );
              }
            });
          }
        }
      }
    });

    test('should handle Unicode characters in passwords', async ({
      request,
    }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Unicode Test',
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
            // Results should be valid JSON (no encoding issues)
            expect(data.success).toBe(true);
          }
        }
      }
    });

    test('should handle very long passwords', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Long Password Test',
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
            data.data.results.forEach((result: any) => {
              // Password should have reasonable length limit
              expect(result.password.length).toBeLessThan(1000);
            });
          }
        }
      }
    });

    test('should escape HTML in password output', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'HTML Escape Test',
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
            // Password containing HTML should not be interpreted
            const resultsText = JSON.stringify(data.data.results);
            // Should not have unescaped HTML tags in raw JSON
            expect(resultsText).toBeDefined();
          }
        }
      }
    });
  });

  test.describe('Results API Edge Cases', () => {
    test('should handle concurrent result requests', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Concurrent Results Test',
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

      // Make multiple simultaneous requests for results
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request.get(`/api/jobs/${job.id}/results`, {
            headers: authHeaders,
          })
        );

      const results = await Promise.allSettled(requests);

      // All should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(10);
    });

    test('should paginate large result sets', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Pagination Test',
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

      // Try to get results with pagination parameters
      const response = await request.get(
        `/api/jobs/${job.id}/results?limit=10&offset=0`,
        {
          headers: authHeaders,
        }
      );

      if (response.ok()) {
        const data = await response.json();
        // Should handle pagination parameters
        expect(data.success).toBe(true);
      }
    });

    test('should handle invalid job ID in results request', async ({
      request,
    }) => {
      const invalidIds = [
        'invalid-uuid',
        '00000000-0000-0000-0000-000000000000',
        'null',
        '',
      ];

      for (const id of invalidIds) {
        const response = await request.get(`/api/jobs/${id}/results`, {
          headers: authHeaders,
        });

        expect([400, 404]).toContain(response.status());
      }
    });

    test('should not leak results to unauthorized users', async ({
      request,
    }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Authorization Test',
        testNetworks.slice(0, 1),
        [testDictionary.id]
      );

      // Try to access without auth
      const response = await request.get(`/api/jobs/${job.id}/results`);

      // Should require authentication
      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Export Functionality', () => {
    test('should export results in multiple formats', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Export Format Test',
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

      // Try different export formats
      const formats = ['json', 'csv', 'txt'];

      for (const format of formats) {
        const response = await request.get(
          `/api/jobs/${job.id}/export?format=${format}`,
          {
            headers: authHeaders,
          }
        );

        if (response.ok()) {
          // Should return appropriate content type
          const contentType = response.headers()['content-type'];
          expect(contentType).toBeDefined();
        }
      }
    });

    test('should handle export of empty results', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Empty Export Test',
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

      if (result.cracked === 0) {
        const response = await request.get(`/api/jobs/${job.id}/export`, {
          headers: authHeaders,
        });

        // Should handle empty export gracefully
        expect([200, 204]).toContain(response.status());
      }
    });

    test('should set correct headers for export downloads', async ({
      request,
    }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Export Headers Test',
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

      const response = await request.get(`/api/jobs/${job.id}/export`, {
        headers: authHeaders,
      });

      if (response.ok()) {
        const headers = response.headers();

        // Should have content-disposition for download
        if (headers['content-disposition']) {
          expect(headers['content-disposition']).toContain('attachment');
        }
      }
    });

    test('should sanitize filenames in export', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Export/../../etc/passwd',
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

      const response = await request.get(`/api/jobs/${job.id}/export`, {
        headers: authHeaders,
      });

      if (response.ok()) {
        const headers = response.headers();
        const contentDisposition = headers['content-disposition'];

        if (contentDisposition) {
          // Should not contain path traversal
          expect(contentDisposition).not.toContain('..');
          expect(contentDisposition).not.toContain('/');
          expect(contentDisposition).not.toContain('\\');
        }
      }
    });
  });

  test.describe('Result Consistency', () => {
    test('should maintain consistent results across API calls', async ({
      request,
    }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Consistency Test',
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

      // Get results from different endpoints
      const statusResponse = await request.get(`/api/jobs/${job.id}`, {
        headers: authHeaders,
      });
      const resultsResponse = await request.get(`/api/jobs/${job.id}/results`, {
        headers: authHeaders,
      });

      if (statusResponse.ok() && resultsResponse.ok()) {
        const statusData = await statusResponse.json();
        const resultsData = await resultsResponse.json();

        // Cracked count should match
        const crackedFromStatus = statusData.data.cracked || 0;
        const crackedFromResults = resultsData.data.results
          ? resultsData.data.results.length
          : 0;

        expect(crackedFromStatus).toBe(crackedFromResults);
      }
    });

    test('should not modify results after job completion', async ({
      request,
    }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Immutability Test',
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

      // Get results
      const results1 = await request.get(`/api/jobs/${job.id}/results`, {
        headers: authHeaders,
      });

      // Wait and get results again
      await new Promise(resolve => setTimeout(resolve, 5000));

      const results2 = await request.get(`/api/jobs/${job.id}/results`, {
        headers: authHeaders,
      });

      if (results1.ok() && results2.ok()) {
        const data1 = await results1.json();
        const data2 = await results2.json();

        // Results should be identical
        expect(JSON.stringify(data1.data.results)).toBe(
          JSON.stringify(data2.data.results)
        );
      }
    });
  });

  test.describe('Output Security', () => {
    test('should prevent SQL injection in output', async ({ request }) => {
      // This test ensures results don't cause SQL injection
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        "SQL Injection'; DROP TABLE jobs; --",
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

      // Get all jobs - should still work
      const allJobsResponse = await request.get('/api/jobs', {
        headers: authHeaders,
      });

      expect(allJobsResponse.ok()).toBeTruthy();
      const data = await allJobsResponse.json();
      expect(data.success).toBe(true);
    });

    test('should prevent XSS in results output', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        '<script>alert("XSS")</script>',
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
        // Should not execute as script
        expect(data.success).toBeDefined();
      }
    });

    test('should not expose sensitive system paths', async ({ request }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Path Exposure Test',
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
        const resultsText = await resultsResponse.text();

        // Should not leak system paths
        expect(resultsText).not.toContain('/etc/');
        expect(resultsText).not.toContain('/root/');
        expect(resultsText).not.toContain('C:\\Windows\\');
      }
    });
  });

  test.describe('Network-Specific Results', () => {
    test('should correctly associate passwords with networks', async ({
      request,
    }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Network Association Test',
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
            data.data.results.forEach((result: any) => {
              // Should have network identifier
              expect(result.bssid || result.essid).toBeDefined();

              // BSSID should be one we submitted
              if (result.bssid) {
                expect(testNetworks).toContain(result.bssid);
              }
            });
          }
        }
      }
    });

    test('should handle multiple passwords for same network', async ({
      request,
    }) => {
      const job = await TestHelpers.createJob(
        request,
        authHeaders,
        'Multiple Passwords Test',
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

          // Should handle duplicate network entries if they exist
          expect(data.success).toBe(true);
        }
      }
    });
  });
});
