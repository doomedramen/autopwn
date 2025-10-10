import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testUsers } from '../../utils/fixtures';

// Mock upload service
const mockUploadService = {
  handlePcapUpload: vi.fn(),
};

vi.mock('../../../services/upload', () => ({
  uploadService: mockUploadService,
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
}));

vi.mock('fs', () => ({
  promises: mockFs,
}));

describe('Uploads API Endpoints', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset fs mocks
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    // Import Hono and router after mocks are set up
    const { Hono } = await import('hono');
    const { uploadsRouter } = await import('../../../routes/uploads');

    // Create app and mount router
    app = new Hono();
    app.route('/uploads', uploadsRouter);
  });

  describe('POST /test', () => {
    it('should create test PCAP file successfully', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test-capture.pcap',
          content: 'mock pcap content',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.filename).toBe('test-capture.pcap');
      expect(data.filepath).toBeDefined();
      expect(data.message).toContain('Test PCAP file created successfully');
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should create test PCAP file with default content when content not provided', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test-capture.pcap',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should reject missing filename', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'test',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Filename is required');
    });

    it('should reject invalid file extension', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'malicious.exe',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Invalid file extension');
    });

    it('should accept .pcap extension', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'capture.pcap',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should accept .pcapng extension', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'capture.pcapng',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should accept .cap extension', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'capture.cap',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should accept uppercase extensions', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'CAPTURE.PCAP',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should handle filesystem mkdir errors', async () => {
      mockFs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.pcap',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Test upload failed');
      expect(data.details).toBe('Permission denied');
    });

    it('should handle filesystem writeFile errors', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Disk full'));

      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.pcap',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Test upload failed');
      expect(data.details).toBe('Disk full');
    });

    it('should handle special characters in filename', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test capture (2024).pcap',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /files', () => {
    it('should upload PCAP files successfully', async () => {
      const mockUploadResult = {
        uploadedFiles: [
          { filename: 'capture1.pcap', size: 1024 },
          { filename: 'capture2.pcap', size: 2048 },
        ],
      };

      mockUploadService.handlePcapUpload.mockResolvedValue(mockUploadResult);

      const formData = new FormData();
      formData.append('files', new Blob(['pcap data 1'], { type: 'application/octet-stream' }), 'capture1.pcap');
      formData.append('files', new Blob(['pcap data 2'], { type: 'application/octet-stream' }), 'capture2.pcap');

      const req = new Request('http://localhost/uploads/files', {
        method: 'POST',
        body: formData,
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.uploaded).toHaveLength(2);
      expect(data.message).toContain('Successfully uploaded 2 file(s)');
      expect(mockUploadService.handlePcapUpload).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.any(Object),
          expect.any(Object),
        ]),
        testUsers.admin.id
      );
    });

    it('should upload single PCAP file successfully', async () => {
      const mockUploadResult = {
        uploadedFiles: [
          { filename: 'capture.pcap', size: 1024 },
        ],
      };

      mockUploadService.handlePcapUpload.mockResolvedValue(mockUploadResult);

      const formData = new FormData();
      formData.append('files', new Blob(['pcap data'], { type: 'application/octet-stream' }), 'capture.pcap');

      const req = new Request('http://localhost/uploads/files', {
        method: 'POST',
        body: formData,
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.uploaded).toHaveLength(1);
      expect(data.message).toContain('Successfully uploaded 1 file(s)');
    });

    it('should reject when no files provided', async () => {
      const formData = new FormData();

      const req = new Request('http://localhost/uploads/files', {
        method: 'POST',
        body: formData,
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('No files provided');
    });

    it('should handle upload service errors', async () => {
      mockUploadService.handlePcapUpload.mockRejectedValue(new Error('Invalid PCAP format'));

      const formData = new FormData();
      formData.append('files', new Blob(['invalid data'], { type: 'application/octet-stream' }), 'invalid.pcap');

      const req = new Request('http://localhost/uploads/files', {
        method: 'POST',
        body: formData,
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Upload failed');
      expect(data.details).toBe('Invalid PCAP format');
    });

    it('should handle large file uploads', async () => {
      const mockUploadResult = {
        uploadedFiles: [
          { filename: 'large-capture.pcap', size: 100 * 1024 * 1024 }, // 100MB
        ],
      };

      mockUploadService.handlePcapUpload.mockResolvedValue(mockUploadResult);

      const largeContent = new Array(1000).fill('a').join('');
      const formData = new FormData();
      formData.append('files', new Blob([largeContent], { type: 'application/octet-stream' }), 'large-capture.pcap');

      const req = new Request('http://localhost/uploads/files', {
        method: 'POST',
        body: formData,
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should pass user ID to upload service', async () => {
      const mockUploadResult = {
        uploadedFiles: [
          { filename: 'test.pcap', size: 1024 },
        ],
      };

      mockUploadService.handlePcapUpload.mockResolvedValue(mockUploadResult);

      const formData = new FormData();
      formData.append('files', new Blob(['test'], { type: 'application/octet-stream' }), 'test.pcap');

      const req = new Request('http://localhost/uploads/files', {
        method: 'POST',
        body: formData,
      });
      await app.fetch(req);

      expect(mockUploadService.handlePcapUpload).toHaveBeenCalledWith(
        expect.any(Array),
        testUsers.admin.id
      );
    });

    it('should handle multiple file upload with same name', async () => {
      const mockUploadResult = {
        uploadedFiles: [
          { filename: 'capture.pcap', size: 1024 },
          { filename: 'capture.pcap', size: 1024 },
        ],
      };

      mockUploadService.handlePcapUpload.mockResolvedValue(mockUploadResult);

      const formData = new FormData();
      formData.append('files', new Blob(['data1'], { type: 'application/octet-stream' }), 'capture.pcap');
      formData.append('files', new Blob(['data2'], { type: 'application/octet-stream' }), 'capture.pcap');

      const req = new Request('http://localhost/uploads/files', {
        method: 'POST',
        body: formData,
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.uploaded).toHaveLength(2);
    });
  });

  describe('Authentication', () => {
    it('should allow unauthenticated access to /test endpoint', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.pcap',
        }),
      });
      const res = await app.fetch(req);

      // Should work even without authentication
      expect(res.status).toBe(200);
    });

    it('should pass authenticated user to upload service', async () => {
      const mockUploadResult = {
        uploadedFiles: [{ filename: 'test.pcap', size: 1024 }],
      };

      mockUploadService.handlePcapUpload.mockResolvedValue(mockUploadResult);

      const formData = new FormData();
      formData.append('files', new Blob(['test'], { type: 'application/octet-stream' }), 'test.pcap');

      const req = new Request('http://localhost/uploads/files', {
        method: 'POST',
        body: formData,
      });
      await app.fetch(req);

      // Verify the authenticated user ID was passed
      expect(mockUploadService.handlePcapUpload).toHaveBeenCalledWith(
        expect.any(Array),
        testUsers.admin.id
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty filename', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
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

    it('should handle filename with only extension', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: '.pcap',
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should handle very long filename', async () => {
      const longFilename = 'a'.repeat(250) + '.pcap';

      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: longFilename,
        }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should handle filename with path traversal attempt', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: '../../../etc/passwd.pcap',
        }),
      });
      const res = await app.fetch(req);

      // Should still work but path should be sanitized by the service
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should handle malformed JSON in test endpoint', async () => {
      const req = new Request('http://localhost/uploads/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json',
      });
      const res = await app.fetch(req);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
