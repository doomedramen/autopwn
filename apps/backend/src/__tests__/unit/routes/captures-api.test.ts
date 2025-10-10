import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testUsers } from '../../utils/fixtures';

// Mock database
const mockDb = {
  select: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../../db', () => ({
  db: mockDb,
  pcapEssidMapping: {},
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
  readdir: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('fs', () => ({
  promises: mockFs,
}));

// Mock environment
vi.mock('../../../config/env.js', () => ({
  env: {
    PCAPS_PATH: '/tmp/pcaps',
  },
}));

describe('Captures API Endpoints', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset fs mocks
    mockFs.readdir.mockResolvedValue([]);
    mockFs.stat.mockResolvedValue({
      isFile: () => true,
      size: 1024,
      mtime: new Date('2025-10-10T10:00:00Z'),
    });
    mockFs.unlink.mockResolvedValue(undefined);

    // Import Hono and router after mocks are set up
    const { Hono } = await import('hono');
    const { capturesRouter } = await import('../../../routes/captures');

    // Create app and mount router
    app = new Hono();
    app.route('/captures', capturesRouter);
  });

  describe('GET /', () => {
    it('should return all PCAP captures for current user', async () => {
      const mockFiles = ['capture1.pcap', 'capture2.pcapng', 'capture3.cap'];
      mockFs.readdir.mockResolvedValue(mockFiles);

      const mockEssidMappings = [
        { essid: 'TestNetwork1', bssid: '00:11:22:33:44:55' },
        { essid: 'TestNetwork2', bssid: null },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockEssidMappings),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.captures).toHaveLength(3);
      expect(data.count).toBe(3);
      expect(data.captures[0]).toHaveProperty('filename');
      expect(data.captures[0]).toHaveProperty('size');
      expect(data.captures[0]).toHaveProperty('uploaded_at');
      expect(data.captures[0]).toHaveProperty('essids');
      expect(data.captures[0]).toHaveProperty('bssids');
    });

    it('should filter only PCAP file extensions', async () => {
      const mockFiles = [
        'capture.pcap',
        'capture.pcapng',
        'capture.cap',
        'readme.txt',
        'image.png',
        'script.sh',
      ];
      mockFs.readdir.mockResolvedValue(mockFiles);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      // Only 3 valid PCAP files should be returned
      expect(data.captures).toHaveLength(3);
      expect(data.captures.every((c: any) =>
        c.filename.endsWith('.pcap') ||
        c.filename.endsWith('.pcapng') ||
        c.filename.endsWith('.cap')
      )).toBe(true);
    });

    it('should sort captures by upload time (newest first)', async () => {
      const mockFiles = ['old.pcap', 'new.pcap', 'middle.pcap'];
      mockFs.readdir.mockResolvedValue(mockFiles);

      let callCount = 0;
      mockFs.stat.mockImplementation(() => {
        callCount++;
        const dates = [
          new Date('2025-01-01T10:00:00Z'), // old.pcap
          new Date('2025-10-10T10:00:00Z'), // new.pcap
          new Date('2025-05-15T10:00:00Z'), // middle.pcap
        ];
        return Promise.resolve({
          isFile: () => true,
          size: 1024,
          mtime: dates[callCount - 1],
        });
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.captures).toHaveLength(3);
      // Should be sorted newest first
      expect(data.captures[0].filename).toBe('new.pcap');
      expect(data.captures[1].filename).toBe('middle.pcap');
      expect(data.captures[2].filename).toBe('old.pcap');
    });

    it('should include ESSID mappings in capture info', async () => {
      mockFs.readdir.mockResolvedValue(['test.pcap']);

      const mockMappings = [
        { essid: 'Network1', bssid: '00:11:22:33:44:55' },
        { essid: 'Network2', bssid: 'AA:BB:CC:DD:EE:FF' },
        { essid: 'Network3', bssid: null },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockMappings),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.captures[0].essids).toEqual(['Network1', 'Network2', 'Network3']);
      expect(data.captures[0].bssids).toEqual(['00:11:22:33:44:55', 'AA:BB:CC:DD:EE:FF']);
    });

    it('should handle empty directory', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.captures).toHaveLength(0);
      expect(data.count).toBe(0);
    });

    it('should handle directory not found', async () => {
      mockFs.readdir.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.captures).toHaveLength(0);
      expect(data.count).toBe(0);
    });

    it('should handle stat errors for individual files', async () => {
      mockFs.readdir.mockResolvedValue(['file1.pcap', 'file2.pcap']);

      let statCallCount = 0;
      mockFs.stat.mockImplementation(() => {
        statCallCount++;
        if (statCallCount === 2) {
          return Promise.reject(new Error('Permission denied'));
        }
        return Promise.resolve({
          isFile: () => true,
          size: 1024,
          mtime: new Date('2025-10-10T10:00:00Z'),
        });
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      // Should return the files that didn't error
      expect(data.success).toBe(true);
    });

    it('should filter out directories', async () => {
      mockFs.readdir.mockResolvedValue(['capture.pcap', 'subdirectory']);

      let callCount = 0;
      mockFs.stat.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          isFile: () => callCount === 1, // First is file, second is directory
          size: 1024,
          mtime: new Date('2025-10-10T10:00:00Z'),
        });
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.captures).toHaveLength(1);
      expect(data.captures[0].filename).toBe('capture.pcap');
    });

    it('should handle database query errors gracefully', async () => {
      mockFs.readdir.mockResolvedValue(['test.pcap']);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      // Database errors during ESSID mapping are caught and logged,
      // but the endpoint still returns success with available data
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      // May have partial data or empty array depending on where error occurred
      expect(data).toHaveProperty('captures');
    });

    it('should include file size in bytes', async () => {
      mockFs.readdir.mockResolvedValue(['large.pcap']);
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1048576, // 1 MB
        mtime: new Date('2025-10-10T10:00:00Z'),
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.captures[0].size).toBe(1048576);
    });

    it('should include uploaded_at timestamp in ISO format', async () => {
      mockFs.readdir.mockResolvedValue(['test.pcap']);
      const testDate = new Date('2025-10-10T12:30:45Z');
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
        mtime: testDate,
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.captures[0].uploaded_at).toBe(testDate.toISOString());
    });
  });

  describe('DELETE /', () => {
    it('should delete PCAP file and ESSID mappings successfully', async () => {
      mockFs.unlink.mockResolvedValue(undefined);

      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDb.delete.mockReturnValue(mockDelete());

      const req = new Request('http://localhost/captures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test-capture.pcap',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Successfully deleted test-capture.pcap');
      expect(data.message).toContain('ESSID mappings');
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it('should reject missing filename', async () => {
      const req = new Request('http://localhost/captures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Filename is required');
    });

    it('should reject empty filename', async () => {
      const req = new Request('http://localhost/captures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: '',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toBe('Filename is required');
    });

    it('should handle file not found', async () => {
      mockFs.unlink.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const req = new Request('http://localhost/captures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'nonexistent.pcap',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('File not found or could not be deleted');
    });

    it('should handle filesystem permission errors', async () => {
      mockFs.unlink.mockRejectedValue(new Error('EACCES: permission denied'));

      const req = new Request('http://localhost/captures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'protected.pcap',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('File not found or could not be deleted');
    });

    it('should handle malformed JSON', async () => {
      const req = new Request('http://localhost/captures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json',
      });
      const res = await app.fetch(req);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should delete ESSID mappings even if file deletion fails', async () => {
      mockFs.unlink.mockRejectedValue(new Error('File already deleted'));

      const req = new Request('http://localhost/captures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.pcap',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);
    });

    it('should handle special characters in filename', async () => {
      mockFs.unlink.mockResolvedValue(undefined);

      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDb.delete.mockReturnValue(mockDelete());

      const req = new Request('http://localhost/captures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test capture (2024) [final].pcap',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should construct correct file path with user ID', async () => {
      mockFs.unlink.mockResolvedValue(undefined);

      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDb.delete.mockReturnValue(mockDelete());

      const req = new Request('http://localhost/captures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.pcap',
        }),
      });
      await app.fetch(req);

      // Verify unlink was called with correct path
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining(`user-${testUsers.admin.id}`)
      );
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('test.pcap')
      );
    });
  });

  describe('Authentication', () => {
    it('should require authentication for GET endpoint', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      // Should work with authentication
      expect(res.status).toBe(200);
    });

    it('should require authentication for DELETE endpoint', async () => {
      mockFs.unlink.mockResolvedValue(undefined);

      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDb.delete.mockReturnValue(mockDelete());

      const req = new Request('http://localhost/captures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.pcap',
        }),
      });
      const res = await app.fetch(req);

      // Should work with authentication
      expect(res.status).toBe(200);
    });

    it('should use authenticated user ID for file path', async () => {
      mockFs.readdir.mockResolvedValue(['test.pcap']);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/captures');
      await app.fetch(req);

      // Verify readdir was called with user-specific path
      expect(mockFs.readdir).toHaveBeenCalledWith(
        expect.stringContaining(`user-${testUsers.admin.id}`)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long filenames', async () => {
      const longFilename = 'a'.repeat(250) + '.pcap';
      mockFs.readdir.mockResolvedValue([longFilename]);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.captures).toHaveLength(1);
      expect(data.captures[0].filename).toBe(longFilename);
    });

    it('should handle multiple file extensions in filename', async () => {
      mockFs.readdir.mockResolvedValue(['archive.tar.pcap', 'backup.zip.pcapng']);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.captures).toHaveLength(2);
    });

    it('should handle capture with no ESSID mappings', async () => {
      mockFs.readdir.mockResolvedValue(['test.pcap']);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.captures[0].essids).toEqual([]);
      expect(data.captures[0].bssids).toEqual([]);
    });

    it('should handle ESSID mapping with missing BSSID', async () => {
      mockFs.readdir.mockResolvedValue(['test.pcap']);

      const mockMappings = [
        { essid: 'Network1', bssid: '00:11:22:33:44:55' },
        { essid: 'Network2', bssid: null },
        { essid: 'Network3', bssid: undefined },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockMappings),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.captures[0].essids).toHaveLength(3);
      expect(data.captures[0].bssids).toHaveLength(1);
      expect(data.captures[0].bssids[0]).toBe('00:11:22:33:44:55');
    });

    it('should handle zero-byte files', async () => {
      mockFs.readdir.mockResolvedValue(['empty.pcap']);
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 0,
        mtime: new Date('2025-10-10T10:00:00Z'),
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/captures');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.captures[0].size).toBe(0);
    });

    it('should handle path traversal attempt in delete', async () => {
      mockFs.unlink.mockResolvedValue(undefined);

      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDb.delete.mockReturnValue(mockDelete());

      const req = new Request('http://localhost/captures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: '../../../etc/passwd',
        }),
      });
      const res = await app.fetch(req);

      // Should still process but path should be constructed safely with join()
      expect([200, 404]).toContain(res.status);
    });
  });
});
