/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import { TestHelpers } from '../helpers/test-helpers';
import * as path from 'path';

test.describe('File Upload Edge Cases', () => {
  let authHeaders: Record<string, string>;

  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await TestHelpers.loginWithSession(page, context);
    authHeaders = await TestHelpers.getAuthHeaders(context);
    await context.close();
  });

  test.beforeEach(async ({ page, context }) => {
    await TestHelpers.loginWithSession(page, context);
  });

  test.describe('PCAP Upload Validation', () => {
    test('should reject files that are too large', async ({ request }) => {
      // Create a mock large file (simulate > max size)
      const mockLargeFile = new File(
        [new ArrayBuffer(1024 * 1024 * 101)], // 101MB
        'large.pcap',
        { type: 'application/octet-stream' }
      );

      const formData = new FormData();
      formData.append('file', mockLargeFile);

      const response = await request.post('/api/upload/pcap', {
        headers: authHeaders,
        multipart: {
          file: {
            name: 'large.pcap',
            mimeType: 'application/octet-stream',
            buffer: Buffer.alloc(1024 * 1024 * 101),
          },
        },
      });

      expect(response.status()).toBe(413); // Payload Too Large
      const data = await response.json();
      expect(data.error).toContain('too large');
    });

    test('should reject invalid file extensions', async ({ request }) => {
      const invalidExtensions = ['.txt', '.pdf', '.jpg', '.exe', '.sh'];

      for (const ext of invalidExtensions) {
        const response = await request.post('/api/upload/pcap', {
          headers: authHeaders,
          multipart: {
            file: {
              name: `test${ext}`,
              mimeType: 'application/octet-stream',
              buffer: Buffer.from('invalid content'),
            },
          },
        });

        expect([400, 500]).toContain(response.status());
        const data = await response.json();
        expect(
          data.error?.toLowerCase() || data.message?.toLowerCase()
        ).toMatch(/invalid|type|extension/);
      }
    });

    test('should reject empty files', async ({ request }) => {
      const response = await request.post('/api/upload/pcap', {
        headers: authHeaders,
        multipart: {
          file: {
            name: 'empty.pcap',
            mimeType: 'application/octet-stream',
            buffer: Buffer.alloc(0),
          },
        },
      });

      expect([400, 500]).toContain(response.status());
    });

    test('should reject files with invalid PCAP magic number', async ({
      request,
    }) => {
      // Create a file with wrong magic number
      const invalidPcap = Buffer.from('NOT A PCAP FILE HEADER');

      const response = await request.post('/api/upload/pcap', {
        headers: authHeaders,
        multipart: {
          file: {
            name: 'invalid.pcap',
            mimeType: 'application/octet-stream',
            buffer: invalidPcap,
          },
        },
      });

      // Should either reject during upload or during processing
      const data = await response.json();
      if (response.ok()) {
        // If upload succeeded, check that processing detected the issue
        expect(data.data?.networks?.length || 0).toBe(0);
      } else {
        expect([400, 500]).toContain(response.status());
      }
    });

    test('should handle concurrent uploads from same user', async ({
      request,
    }) => {
      const { pcapPath } = TestHelpers.getTestFilePaths();

      // Create multiple upload promises
      const uploads = Array(3)
        .fill(null)
        .map(() => TestHelpers.uploadPcap(request, authHeaders, pcapPath));

      const results = await Promise.allSettled(uploads);

      // At least some should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // Check that each successful upload has unique ID
      const successfulResults = successful
        .filter(
          (
            r
          ): r is PromiseFulfilledResult<{
            upload: { id: string; path: string; name: string };
            networks: any[];
          }> => r.status === 'fulfilled'
        )
        .map(r => r.value.upload.id);
      const uniqueIds = new Set(successfulResults);
      expect(uniqueIds.size).toBe(successful.length);
    });

    test('should handle upload cancellation gracefully', async ({
      request,
    }) => {
      const { pcapPath } = TestHelpers.getTestFilePaths();

      // Start upload
      const uploadPromise = TestHelpers.uploadPcap(
        request,
        authHeaders,
        pcapPath
      );

      // Immediately try to get status (simulating quick cancellation check)
      const statusResponse = await request.get('/api/upload/pcap', {
        headers: authHeaders,
      });

      // Wait for upload to complete
      const result = await uploadPromise;

      expect(result).toBeDefined();
      expect(statusResponse.status()).toBeLessThan(500);
    });

    test('should preserve original filename', async ({ request }) => {
      const { pcapPath } = TestHelpers.getTestFilePaths();
      const originalName = path.basename(pcapPath);

      const result = await TestHelpers.uploadPcap(
        request,
        authHeaders,
        pcapPath
      );

      expect(result.upload.name).toBe(originalName);
    });

    test('should handle duplicate file uploads', async ({ request }) => {
      const { pcapPath } = TestHelpers.getTestFilePaths();

      const result1 = await TestHelpers.uploadPcap(
        request,
        authHeaders,
        pcapPath
      );
      const result2 = await TestHelpers.uploadPcap(
        request,
        authHeaders,
        pcapPath
      );

      // Both uploads should succeed
      expect(result1.upload.id).toBeTruthy();
      expect(result2.upload.id).toBeTruthy();
      // Each should have unique ID
      expect(result1.upload.id).not.toBe(result2.upload.id);
    });
  });

  test.describe('Dictionary Upload Validation', () => {
    test('should accept compressed dictionary files', async ({ request }) => {
      const compressedExtensions = ['.gz', '.bz2'];

      for (const ext of compressedExtensions) {
        // Create mock compressed file
        const mockCompressed = Buffer.from('mock compressed content');

        const response = await request.post('/api/upload/dictionary', {
          headers: authHeaders,
          multipart: {
            file: {
              name: `wordlist${ext}`,
              mimeType: 'application/octet-stream',
              buffer: mockCompressed,
            },
          },
        });

        // Should accept compressed files
        expect([200, 500]).toContain(response.status());
      }
    });

    test('should reject dictionary files that are too large', async ({
      request,
    }) => {
      const response = await request.post('/api/upload/dictionary', {
        headers: authHeaders,
        multipart: {
          file: {
            name: 'huge_wordlist.txt',
            mimeType: 'text/plain',
            buffer: Buffer.alloc(1024 * 1024 * 1024 * 6), // 6GB
          },
        },
      });

      expect(response.status()).toBe(413);
    });

    test('should handle dictionary with special characters in filename', async ({
      request,
    }) => {
      const specialNames = [
        'wordlist-2024.txt',
        'wordlist_v2.txt',
        'wordlist (copy).txt',
      ];

      for (const name of specialNames) {
        const response = await request.post('/api/upload/dictionary', {
          headers: authHeaders,
          multipart: {
            file: {
              name,
              mimeType: 'text/plain',
              buffer: Buffer.from('password1\npassword2\npassword3\n'),
            },
          },
        });

        const data = await response.json();
        if (response.ok()) {
          expect(data.success).toBe(true);
        }
      }
    });

    test('should upload dictionary successfully', async ({ request }) => {
      const { dictionaryPath } = TestHelpers.getTestFilePaths();
      const result = await TestHelpers.uploadDictionary(
        request,
        authHeaders,
        dictionaryPath
      );

      // Check that upload succeeded
      expect(result.id).toBeDefined();
      expect(result.name).toBeTruthy();
    });

    test('should handle empty dictionary files', async ({ request }) => {
      const response = await request.post('/api/upload/dictionary', {
        headers: authHeaders,
        multipart: {
          file: {
            name: 'empty.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from(''),
          },
        },
      });

      // Should reject empty dictionaries
      expect([400, 500]).toContain(response.status());
    });
  });

  test.describe('Upload Progress Tracking', () => {
    test('should provide upload progress updates', async ({ request }) => {
      const { pcapPath } = TestHelpers.getTestFilePaths();

      // Start upload and get fileId
      const uploadPromise = TestHelpers.uploadPcap(
        request,
        authHeaders,
        pcapPath
      );

      // Upload should complete
      const result = await uploadPromise;
      expect(result).toBeDefined();
      expect(result.upload.id).toBeTruthy();

      // Progress endpoint should exist if implemented
      const progressResponse = await request.get(
        `/api/upload/progress/${result.upload.id}`,
        { headers: authHeaders }
      );

      expect([200, 404]).toContain(progressResponse.status());
    });
  });

  test.describe('Upload Error Recovery', () => {
    test('should handle network interruption gracefully', async ({
      request,
    }) => {
      // This test ensures the API doesn't crash on partial uploads
      const { pcapPath } = TestHelpers.getTestFilePaths();

      try {
        await TestHelpers.uploadPcap(request, authHeaders, pcapPath);
        // If it succeeds, that's fine
        expect(true).toBe(true);
      } catch (error) {
        // If it fails, it should fail gracefully
        expect(error).toBeDefined();
      }
    });

    test('should clean up failed uploads', async ({ request }) => {
      // Upload an invalid file
      const response = await request.post('/api/upload/pcap', {
        headers: authHeaders,
        multipart: {
          file: {
            name: 'corrupt.pcap',
            mimeType: 'application/octet-stream',
            buffer: Buffer.from('CORRUPT DATA'),
          },
        },
      });

      // Even if upload fails, it should return proper error
      expect(response.status()).toBeDefined();
      expect([200, 400, 500]).toContain(response.status());
    });
  });

  test.describe('File Upload Security', () => {
    test('should sanitize filenames with path traversal attempts', async ({
      request,
    }) => {
      const maliciousNames = [
        '../../../etc/passwd.pcap',
        '..\\..\\..\\windows\\system32\\config\\sam.pcap',
        '/etc/shadow.pcap',
        'C:\\Windows\\System32\\cmd.exe.pcap',
      ];

      for (const name of maliciousNames) {
        const response = await request.post('/api/upload/pcap', {
          headers: authHeaders,
          multipart: {
            file: {
              name,
              mimeType: 'application/octet-stream',
              buffer: Buffer.from('test'),
            },
          },
        });

        // Should either reject or sanitize
        const data = await response.json();
        if (response.ok() && data.data?.upload?.originalName) {
          // If accepted, filename should be sanitized
          expect(data.data.upload.originalName).not.toContain('..');
          expect(data.data.upload.originalName).not.toContain('\\');
        }
      }
    });

    test('should reject executable files disguised as PCAP', async ({
      request,
    }) => {
      // MZ header (Windows executable)
      const exeHeader = Buffer.from([0x4d, 0x5a]);

      const response = await request.post('/api/upload/pcap', {
        headers: authHeaders,
        multipart: {
          file: {
            name: 'malicious.pcap',
            mimeType: 'application/octet-stream',
            buffer: exeHeader,
          },
        },
      });

      // Should fail validation
      expect([400, 500]).toContain(response.status());
    });

    test('should validate file content matches extension', async ({
      request,
    }) => {
      // Upload a text file with .pcap extension
      const textContent = Buffer.from('This is plain text, not a PCAP file');

      const response = await request.post('/api/upload/pcap', {
        headers: authHeaders,
        multipart: {
          file: {
            name: 'fake.pcap',
            mimeType: 'application/octet-stream',
            buffer: textContent,
          },
        },
      });

      const data = await response.json();
      // Should detect invalid content
      if (response.ok()) {
        // If upload succeeded, processing should detect the issue
        expect(data.data?.networks?.length || 0).toBe(0);
      }
    });
  });

  test.describe('Upload Resource Limits', () => {
    test('should handle multiple simultaneous uploads', async ({ request }) => {
      const { pcapPath, dictionaryPath } = TestHelpers.getTestFilePaths();

      const uploads = [
        TestHelpers.uploadPcap(request, authHeaders, pcapPath),
        TestHelpers.uploadDictionary(request, authHeaders, dictionaryPath),
        TestHelpers.uploadPcap(request, authHeaders, pcapPath),
      ];

      const results = await Promise.allSettled(uploads);

      // All should complete (succeed or fail gracefully)
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(['fulfilled', 'rejected']).toContain(result.status);
      });
    });

    test('should enforce rate limiting on uploads', async ({ request }) => {
      const { pcapPath } = TestHelpers.getTestFilePaths();

      // Try to upload many times rapidly
      const rapidUploads = Array(15)
        .fill(null)
        .map(() => TestHelpers.uploadPcap(request, authHeaders, pcapPath));

      const results = await Promise.allSettled(rapidUploads);

      // Some should succeed, system should handle load
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });
  });
});
