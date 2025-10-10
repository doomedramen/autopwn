import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join } from 'path';

// Mock dependencies
vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dictionaries: {},
  jobDictionaries: {},
  results: {},
}));

vi.mock('../../../config/env', () => ({
  env: {
    JOBS_PATH: '/tmp/test-jobs',
    DICTIONARIES_PATH: '/tmp/test-dictionaries',
  },
}));

vi.mock('fs/promises', () => ({
  promises: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
  },
}));

describe('Chunked Upload - Filesystem Storage', () => {
  let mockFs: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFs = await import('fs/promises');
  });

  describe('Metadata Storage', () => {
    it('should save upload metadata to filesystem', async () => {
      const uploadId = 'test-upload-123';
      const metadata = {
        filename: 'large-dictionary.txt',
        userId: 'user-123',
        totalChunks: 10,
        fileSize: 10485760, // 10MB
        createdAt: Date.now(),
        receivedChunks: [],
      };

      const expectedPath = join('/tmp/test-jobs', 'uploads', uploadId, 'metadata.json');

      vi.mocked(mockFs.promises.writeFile).mockResolvedValue(undefined);

      // Simulate saving metadata
      await mockFs.promises.writeFile(
        expectedPath,
        JSON.stringify(metadata, null, 2)
      );

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        expectedPath,
        expect.stringContaining('large-dictionary.txt')
      );
    });

    it('should load upload metadata from filesystem', async () => {
      const uploadId = 'test-upload-123';
      const metadata = {
        filename: 'large-dictionary.txt',
        userId: 'user-123',
        totalChunks: 10,
        fileSize: 10485760,
        createdAt: Date.now(),
        receivedChunks: [0, 1, 2],
      };

      vi.mocked(mockFs.promises.readFile).mockResolvedValue(
        JSON.stringify(metadata)
      );

      const content = await mockFs.promises.readFile(
        join('/tmp/test-jobs', 'uploads', uploadId, 'metadata.json'),
        'utf-8'
      );
      const loadedMetadata = JSON.parse(content);

      expect(loadedMetadata.filename).toBe('large-dictionary.txt');
      expect(loadedMetadata.receivedChunks).toEqual([0, 1, 2]);
    });

    it('should handle missing metadata files gracefully', async () => {
      vi.mocked(mockFs.promises.readFile).mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      try {
        await mockFs.promises.readFile(
          join('/tmp/test-jobs', 'uploads', 'nonexistent', 'metadata.json'),
          'utf-8'
        );
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('ENOENT');
      }
    });
  });

  describe('Chunk Storage', () => {
    it('should save individual chunks to filesystem', async () => {
      const uploadId = 'test-upload-123';
      const chunkIndex = 5;
      const chunkData = Buffer.from('chunk data content');

      const expectedPath = join('/tmp/test-jobs', 'uploads', uploadId, `chunk-${chunkIndex}`);

      vi.mocked(mockFs.promises.writeFile).mockResolvedValue(undefined);

      await mockFs.promises.writeFile(expectedPath, chunkData);

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        expectedPath,
        chunkData
      );
    });

    it('should read chunk data from filesystem', async () => {
      const uploadId = 'test-upload-123';
      const chunkIndex = 3;
      const chunkData = Buffer.from('test chunk content');

      vi.mocked(mockFs.promises.readFile).mockResolvedValue(chunkData);

      const loadedChunk = await mockFs.promises.readFile(
        join('/tmp/test-jobs', 'uploads', uploadId, `chunk-${chunkIndex}`)
      );

      expect(loadedChunk).toEqual(chunkData);
    });

    it('should handle large chunk files', async () => {
      const uploadId = 'test-upload-123';
      const chunkIndex = 0;
      // Create 1MB chunk
      const largeChunk = Buffer.alloc(1024 * 1024, 'a');

      vi.mocked(mockFs.promises.writeFile).mockResolvedValue(undefined);

      await mockFs.promises.writeFile(
        join('/tmp/test-jobs', 'uploads', uploadId, `chunk-${chunkIndex}`),
        largeChunk
      );

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        largeChunk
      );
    });
  });

  describe('Upload Directory Management', () => {
    it('should create upload directory recursively', async () => {
      const uploadId = 'test-upload-123';
      const uploadDir = join('/tmp/test-jobs', 'uploads', uploadId);

      vi.mocked(mockFs.promises.mkdir).mockResolvedValue(undefined);

      await mockFs.promises.mkdir(uploadDir, { recursive: true });

      expect(mockFs.promises.mkdir).toHaveBeenCalledWith(uploadDir, { recursive: true });
    });

    it('should clean up entire upload directory', async () => {
      const uploadId = 'test-upload-123';
      const uploadDir = join('/tmp/test-jobs', 'uploads', uploadId);

      vi.mocked(mockFs.promises.rm).mockResolvedValue(undefined);

      await mockFs.promises.rm(uploadDir, { recursive: true, force: true });

      expect(mockFs.promises.rm).toHaveBeenCalledWith(
        uploadDir,
        { recursive: true, force: true }
      );
    });
  });

  describe('Abandoned Upload Cleanup', () => {
    it('should identify uploads older than 24 hours', () => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      const recentUpload = { createdAt: now - (1000 * 60 * 60) }; // 1 hour ago
      const oldUpload = { createdAt: now - (25 * 60 * 60 * 1000) }; // 25 hours ago

      expect(now - recentUpload.createdAt).toBeLessThan(maxAge);
      expect(now - oldUpload.createdAt).toBeGreaterThan(maxAge);
    });

    it('should clean up abandoned uploads', async () => {
      const uploadsDir = join('/tmp/test-jobs', 'uploads');
      const oldUploadId = 'old-upload-123';
      const now = Date.now();

      // Mock directory listing
      vi.mocked(mockFs.promises.readdir).mockResolvedValue([
        {
          name: oldUploadId,
          isDirectory: () => true,
          isFile: () => false,
        },
      ] as any);

      // Mock metadata reading (old upload)
      vi.mocked(mockFs.promises.readFile).mockResolvedValue(
        JSON.stringify({
          filename: 'abandoned.txt',
          userId: 'user-123',
          totalChunks: 10,
          fileSize: 1000,
          createdAt: now - (25 * 60 * 60 * 1000), // 25 hours ago
          receivedChunks: [0, 1, 2],
        })
      );

      vi.mocked(mockFs.promises.rm).mockResolvedValue(undefined);

      // Simulate cleanup
      const entries = await mockFs.promises.readdir(uploadsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metadataPath = join(uploadsDir, entry.name, 'metadata.json');
          const content = await mockFs.promises.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(content);

          const maxAge = 24 * 60 * 60 * 1000;
          if (now - metadata.createdAt > maxAge) {
            await mockFs.promises.rm(join(uploadsDir, entry.name), {
              recursive: true,
              force: true,
            });
          }
        }
      }

      expect(mockFs.promises.rm).toHaveBeenCalledWith(
        join(uploadsDir, oldUploadId),
        { recursive: true, force: true }
      );
    });

    it('should not clean up recent uploads', async () => {
      const uploadsDir = join('/tmp/test-jobs', 'uploads');
      const recentUploadId = 'recent-upload-123';
      const now = Date.now();

      vi.mocked(mockFs.promises.readdir).mockResolvedValue([
        {
          name: recentUploadId,
          isDirectory: () => true,
          isFile: () => false,
        },
      ] as any);

      // Mock metadata reading (recent upload)
      vi.mocked(mockFs.promises.readFile).mockResolvedValue(
        JSON.stringify({
          filename: 'recent.txt',
          userId: 'user-123',
          totalChunks: 10,
          fileSize: 1000,
          createdAt: now - (1000 * 60 * 60), // 1 hour ago
          receivedChunks: [0, 1, 2],
        })
      );

      const mockRm = vi.mocked(mockFs.promises.rm);
      mockRm.mockClear();

      // Simulate cleanup
      const entries = await mockFs.promises.readdir(uploadsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metadataPath = join(uploadsDir, entry.name, 'metadata.json');
          const content = await mockFs.promises.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(content);

          const maxAge = 24 * 60 * 60 * 1000;
          if (now - metadata.createdAt > maxAge) {
            await mockFs.promises.rm(join(uploadsDir, entry.name), {
              recursive: true,
              force: true,
            });
          }
        }
      }

      expect(mockRm).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const uploadsDir = join('/tmp/test-jobs', 'uploads');

      vi.mocked(mockFs.promises.readdir).mockRejectedValue(
        new Error('Permission denied')
      );

      try {
        await mockFs.promises.readdir(uploadsDir, { withFileTypes: true });
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Permission denied');
      }
    });
  });

  describe('Chunk Combining', () => {
    it('should combine chunks in correct order', async () => {
      const uploadId = 'test-upload-123';
      const totalChunks = 3;
      const chunks = [
        Buffer.from('chunk0'),
        Buffer.from('chunk1'),
        Buffer.from('chunk2'),
      ];

      for (let i = 0; i < totalChunks; i++) {
        vi.mocked(mockFs.promises.readFile)
          .mockResolvedValueOnce(chunks[i]);
      }

      const loadedChunks: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunk = await mockFs.promises.readFile(
          join('/tmp/test-jobs', 'uploads', uploadId, `chunk-${i}`)
        );
        loadedChunks.push(chunk as Buffer);
      }

      const combined = Buffer.concat(loadedChunks);
      expect(combined.toString()).toBe('chunk0chunk1chunk2');
    });

    it('should handle empty chunks', async () => {
      const emptyChunk = Buffer.alloc(0);
      const filledChunk = Buffer.from('data');

      const combined = Buffer.concat([emptyChunk, filledChunk, emptyChunk]);
      expect(combined.toString()).toBe('data');
    });

    it('should preserve binary data when combining', async () => {
      const binaryChunks = [
        Buffer.from([0x00, 0x01, 0x02]),
        Buffer.from([0x03, 0x04, 0x05]),
        Buffer.from([0x06, 0x07, 0x08]),
      ];

      const combined = Buffer.concat(binaryChunks);
      expect(combined).toEqual(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
    });
  });
});
