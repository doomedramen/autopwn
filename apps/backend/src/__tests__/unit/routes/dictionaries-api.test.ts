import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testUsers, testDictionaries } from '../../utils/fixtures';

// Mock database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../../db', () => ({
  db: mockDb,
  dictionaries: {},
  jobDictionaries: {},
  results: {},
}));

// Mock authentication middleware
vi.mock('../../../middleware/auth', () => ({
  requireAuth: vi.fn(async (c, next) => {
    c.set('user', testUsers.admin);
    await next();
  }),
}));

// Mock filesystem
const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('test content')),
  readdir: vi.fn().mockResolvedValue([]),
  unlink: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('fs', () => ({
  promises: mockFs,
}));

// Mock crypto
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-12345'),
}));

describe('Dictionaries API Endpoints', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset all fs mocks to default behavior
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));
    mockFs.readdir.mockResolvedValue([]);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);

    // Import Hono and router after mocks are set up
    const { Hono } = await import('hono');
    const { dictionariesRouter } = await import('../../../routes/dictionaries');

    // Create app and mount router
    app = new Hono();
    app.route('/dictionaries', dictionariesRouter);
  });

  describe('GET /', () => {
    it('should return all dictionaries for current user', async () => {
      const mockDictionaries = [testDictionaries.rockyou, testDictionaries.common];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockDictionaries),
          }),
        }),
      });

      const req = new Request('http://localhost/dictionaries');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
      expect(data[0]).toHaveProperty('name');
      expect(data[0]).toHaveProperty('path');
      expect(data[0]).toHaveProperty('size');
    });

    it('should return empty array when user has no dictionaries', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/dictionaries');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const req = new Request('http://localhost/dictionaries');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to fetch dictionaries');
    });
  });

  describe('POST /chunked/start', () => {
    it('should initialize chunked upload successfully', async () => {
      const req = new Request('http://localhost/dictionaries/chunked/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'large-dict.txt',
          fileSize: 1024000,
          totalChunks: 10,
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.uploadId).toBe('test-uuid-12345');
      expect(data.message).toBe('Chunked upload initialized');
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should reject missing required fields', async () => {
      const req = new Request('http://localhost/dictionaries/chunked/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.txt',
          // Missing fileSize and totalChunks
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Missing required fields');
    });

    it('should reject invalid file types', async () => {
      const req = new Request('http://localhost/dictionaries/chunked/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'malicious.exe',
          fileSize: 1024,
          totalChunks: 1,
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Invalid file type');
    });

    it('should accept various valid dictionary file extensions', async () => {
      const validExtensions = ['.txt', '.dict', '.wordlist', '.gz', '.pcapng', '.22000'];

      for (const ext of validExtensions) {
        vi.clearAllMocks();

        const req = new Request('http://localhost/dictionaries/chunked/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: `test${ext}`,
            fileSize: 1024,
            totalChunks: 1,
          }),
        });
        const res = await app.fetch(req);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
      }
    });

    it('should handle filesystem errors', async () => {
      // First mkdir call is for cleanup, second is for upload dir
      mockFs.mkdir
        .mockResolvedValueOnce(undefined) // Cleanup mkdir succeeds
        .mockRejectedValueOnce(new Error('Filesystem error')); // Upload dir mkdir fails

      const req = new Request('http://localhost/dictionaries/chunked/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.txt',
          fileSize: 1024,
          totalChunks: 1,
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to start chunked upload');
    });
  });

  describe('POST /chunked/:uploadId/chunk/:chunkIndex', () => {
    it('should upload chunk successfully', async () => {
      const metadata = {
        filename: 'test.txt',
        userId: testUsers.admin.id,
        totalChunks: 3,
        fileSize: 1024,
        createdAt: Date.now(),
        receivedChunks: [],
      };

      // Mock metadata load - needs 2 reads: initial load + metadata save/reload
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(metadata))  // Initial metadata load
        .mockResolvedValueOnce(JSON.stringify(metadata)); // Metadata reload after update

      const formData = new FormData();
      const chunkBlob = new Blob(['chunk data']);
      formData.append('chunk', chunkBlob);

      const req = new Request('http://localhost/dictionaries/chunked/test-uuid/chunk/0', {
        method: 'POST',
        body: formData,
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.chunkIndex).toBe(0);
      expect(data.receivedChunks).toBe(1);
      expect(data.totalChunks).toBe(3);
    });

    it('should reject missing chunk data', async () => {
      mockFs.readFile.mockResolvedValueOnce(
        JSON.stringify({
          filename: 'test.txt',
          userId: testUsers.admin.id,
          totalChunks: 3,
          fileSize: 1024,
          createdAt: Date.now(),
          receivedChunks: [],
        })
      );

      const formData = new FormData();
      // Not adding chunk data

      const req = new Request('http://localhost/dictionaries/chunked/test-uuid/chunk/0', {
        method: 'POST',
        body: formData,
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('No chunk data provided');
    });

    it('should reject invalid upload session', async () => {
      // Mock readFile to return metadata with different user - route should reject early so only need one mock
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          filename: 'test.txt',
          userId: 'user-different-456', // Different from testUsers.admin.id which is 'user-admin-123'
          totalChunks: 3,
          fileSize: 1024,
          createdAt: Date.now(),
          receivedChunks: [],
        })
      );

      const formData = new FormData();
      formData.append('chunk', new Blob(['test']));

      const req = new Request('http://localhost/dictionaries/chunked/test-uuid/chunk/0', {
        method: 'POST',
        body: formData,
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Invalid upload session');
    });

    it('should handle 404 for non-existent upload', async () => {
      mockFs.readFile.mockResolvedValueOnce(null);

      const formData = new FormData();
      formData.append('chunk', new Blob(['test']));

      const req = new Request('http://localhost/dictionaries/chunked/non-existent/chunk/0', {
        method: 'POST',
        body: formData,
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);
    });

    it('should handle filesystem write errors', async () => {
      const metadata = {
        filename: 'test.txt',
        userId: testUsers.admin.id,
        totalChunks: 3,
        fileSize: 1024,
        createdAt: Date.now(),
        receivedChunks: [],
      };

      // Mock readFile to return valid metadata for all reads
      mockFs.readFile.mockResolvedValue(JSON.stringify(metadata));

      // First writeFile is for the chunk data (should fail)
      mockFs.writeFile.mockRejectedValueOnce(new Error('Write error'));

      const formData = new FormData();
      formData.append('chunk', new Blob(['test']));

      const req = new Request('http://localhost/dictionaries/chunked/test-uuid/chunk/0', {
        method: 'POST',
        body: formData,
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to upload chunk');
    });
  });

  describe('POST /chunked/:uploadId/complete', () => {
    it('should complete chunked upload successfully', async () => {
      const metadata = {
        filename: 'test.txt',
        userId: testUsers.admin.id,
        totalChunks: 2,
        fileSize: 1024,
        createdAt: Date.now(),
        receivedChunks: [0, 1],
      };

      // Mock readFile: 1st for metadata, 2nd and 3rd for chunk files
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(metadata))  // Load metadata
        .mockResolvedValueOnce(Buffer.from('chunk0'))     // Read chunk 0
        .mockResolvedValueOnce(Buffer.from('chunk1'));    // Read chunk 1

      // Mock database check for existing dictionary
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock database insert
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 1,
            name: 'test.txt',
            userId: testUsers.admin.id,
            path: '/path/to/test.txt',
            size: 1024,
          }]),
        }),
      });

      const req = new Request('http://localhost/dictionaries/chunked/test-uuid/complete', {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.dictionary).toBeDefined();
      expect(data.message).toBe('Dictionary uploaded successfully');
      expect(mockFs.rm).toHaveBeenCalled();
    });

    it('should reject when missing chunks', async () => {
      // Mock readFile to return metadata with missing chunks
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          filename: 'test.txt',
          userId: testUsers.admin.id,
          totalChunks: 3,
          fileSize: 1024,
          createdAt: Date.now(),
          receivedChunks: [0, 1], // Missing chunk 2
        })
      );

      const req = new Request('http://localhost/dictionaries/chunked/test-uuid/complete', {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Missing chunks');
      expect(data.received).toBe(2);
      expect(data.expected).toBe(3);
    });

    it('should reject when dictionary already exists', async () => {
      // First readFile for metadata, then readFile for each chunk
      mockFs.readFile
        .mockResolvedValueOnce(
          JSON.stringify({
            filename: 'test.txt',
            userId: testUsers.admin.id,
            totalChunks: 1,
            fileSize: 1024,
            createdAt: Date.now(),
            receivedChunks: [0],
          })
        )
        .mockResolvedValueOnce(Buffer.from('chunk0')); // Read chunk file

      // Mock database check returning existing dictionary
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1, name: 'test.txt' }]),
          }),
        }),
      });

      const req = new Request('http://localhost/dictionaries/chunked/test-uuid/complete', {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(409);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Dictionary already exists');
      expect(mockFs.rm).toHaveBeenCalled(); // Should clean up
    });

    it('should handle invalid upload session', async () => {
      // Mock readFile to return metadata with different user
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          filename: 'test.txt',
          userId: 'different-user',
          totalChunks: 1,
          fileSize: 1024,
          createdAt: Date.now(),
          receivedChunks: [0],
        })
      );

      const req = new Request('http://localhost/dictionaries/chunked/test-uuid/complete', {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Invalid upload session');
    });

    it('should handle database insertion errors', async () => {
      mockFs.readFile
        .mockResolvedValueOnce(
          JSON.stringify({
            filename: 'test.txt',
            userId: testUsers.admin.id,
            totalChunks: 1,
            fileSize: 1024,
            createdAt: Date.now(),
            receivedChunks: [0],
          })
        )
        .mockResolvedValueOnce(Buffer.from('test'));

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      const req = new Request('http://localhost/dictionaries/chunked/test-uuid/complete', {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to complete chunked upload');
    });
  });

  describe('DELETE /chunked/:uploadId', () => {
    it('should cancel upload successfully', async () => {
      // Mock readFile to return valid metadata
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          filename: 'test.txt',
          userId: testUsers.admin.id,
          totalChunks: 3,
          fileSize: 1024,
          createdAt: Date.now(),
          receivedChunks: [0],
        })
      );

      const req = new Request('http://localhost/dictionaries/chunked/test-uuid', {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Upload cancelled successfully');
      expect(mockFs.rm).toHaveBeenCalled();
    });

    it('should handle invalid upload session', async () => {
      // Mock readFile to return metadata with different user
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          filename: 'test.txt',
          userId: 'different-user',
          totalChunks: 3,
          fileSize: 1024,
          createdAt: Date.now(),
          receivedChunks: [0],
        })
      );

      const req = new Request('http://localhost/dictionaries/chunked/test-uuid', {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Invalid upload session');
    });

    it('should handle filesystem errors', async () => {
      // Mock readFile to return valid metadata
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          filename: 'test.txt',
          userId: testUsers.admin.id,
          totalChunks: 3,
          fileSize: 1024,
          createdAt: Date.now(),
          receivedChunks: [0],
        })
      );

      mockFs.rm.mockRejectedValueOnce(new Error('Filesystem error'));

      const req = new Request('http://localhost/dictionaries/chunked/test-uuid', {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to cancel chunked upload');
    });
  });

  describe('POST /simple', () => {
    it('should create simple dictionary successfully', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 1,
            name: 'test-dict',
            userId: testUsers.admin.id,
            path: '/path/to/test_dict.txt',
            size: 100,
          }]),
        }),
      });

      const req = new Request('http://localhost/dictionaries/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'test-dict',
          content: 'password1\npassword2\npassword3',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.dictionary).toBeDefined();
      expect(data.message).toBe('Dictionary created successfully');
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should reject missing name or content', async () => {
      const req = new Request('http://localhost/dictionaries/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'test-dict',
          // Missing content
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Name and content are required');
    });

    it('should sanitize dictionary filename', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 1,
            name: 'test dict!@#',
            userId: testUsers.admin.id,
            path: '/path/to/test_dict____.txt',
            size: 100,
          }]),
        }),
      });

      const req = new Request('http://localhost/dictionaries/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'test dict!@#',
          content: 'test',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should handle database errors', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      const req = new Request('http://localhost/dictionaries/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'test',
          content: 'test',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to create dictionary');
    });
  });

  describe('DELETE /:id', () => {
    it('should delete dictionary successfully', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 1,
              name: 'test.txt',
              path: '/path/to/test.txt',
              userId: testUsers.admin.id,
            }]),
          }),
        }),
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const req = new Request('http://localhost/dictionaries/1', {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Dictionary deleted successfully');
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it('should handle dictionary not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/dictionaries/999', {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Dictionary not found');
    });

    it('should handle filesystem delete errors gracefully', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 1,
              name: 'test.txt',
              path: '/path/to/test.txt',
              userId: testUsers.admin.id,
            }]),
          }),
        }),
      });

      mockFs.unlink.mockRejectedValueOnce(new Error('File not found'));

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const req = new Request('http://localhost/dictionaries/1', {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      // Should still succeed even if file deletion fails
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 1,
              name: 'test.txt',
              path: '/path/to/test.txt',
              userId: testUsers.admin.id,
            }]),
          }),
        }),
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const req = new Request('http://localhost/dictionaries/1', {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to delete dictionary');
    });
  });

  describe('GET /:id/coverage', () => {
    it('should return dictionary coverage statistics', async () => {
      // Mock dictionary select
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([testDictionaries.rockyou]),
            }),
          }),
        })
        // Mock jobs used count
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 10 }]),
          }),
        })
        // Mock jobs with dictionary
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { jobId: 1 },
              { jobId: 2 },
              { jobId: 3 },
            ]),
          }),
        })
        // Mock jobs with results
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([
                { jobId: 1, crackedCount: 5 },
                { jobId: 2, crackedCount: 3 },
              ]),
            }),
          }),
        });

      const req = new Request('http://localhost/dictionaries/1/coverage');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('dictionary');
      expect(data).toHaveProperty('coverage');
      expect(data.coverage).toHaveProperty('jobsUsed');
      expect(data.coverage).toHaveProperty('jobsSuccessful');
      expect(data.coverage).toHaveProperty('successRate');
      expect(data.coverage).toHaveProperty('totalCrackedPasswords');
    });

    it('should handle dictionary not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/dictionaries/999/coverage');
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Dictionary not found');
    });

    it('should handle dictionary with no usage', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([testDictionaries.rockyou]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      const req = new Request('http://localhost/dictionaries/1/coverage');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.coverage.jobsUsed).toBe(0);
      expect(data.coverage.successRate).toBe(0);
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const req = new Request('http://localhost/dictionaries/1/coverage');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to get dictionary coverage');
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent chunked uploads', async () => {
      // Multiple users should be able to upload simultaneously
      const req1 = new Request('http://localhost/dictionaries/chunked/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'dict1.txt',
          fileSize: 1024,
          totalChunks: 1,
        }),
      });

      const req2 = new Request('http://localhost/dictionaries/chunked/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'dict2.txt',
          fileSize: 2048,
          totalChunks: 2,
        }),
      });

      const res1 = await app.fetch(req1);
      const res2 = await app.fetch(req2);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const data1 = await res1.json();
      const data2 = await res2.json();

      expect(data1.uploadId).toBeDefined();
      expect(data2.uploadId).toBeDefined();
    });

    it('should handle large dictionary metadata', async () => {
      const largeDictionary = {
        ...testDictionaries.rockyou,
        size: 14344384000, // 14GB dictionary
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([largeDictionary]),
          }),
        }),
      });

      const req = new Request('http://localhost/dictionaries');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data[0].size).toBe(14344384000);
    });

    it('should handle special characters in dictionary names', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 1,
            name: 'test-dict-αβγ-中文',
            userId: testUsers.admin.id,
            path: '/path/to/dict.txt',
            size: 100,
          }]),
        }),
      });

      const req = new Request('http://localhost/dictionaries/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'test-dict-αβγ-中文',
          content: 'test',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
    });
  });

  describe('Authentication', () => {
    it('should include user context from authentication middleware', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/dictionaries');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      // Verify that the request was processed (authentication middleware ran)
      const data = await res.json();
      expect(data).toBeDefined();
    });
  });
});
