import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testUsers, testJobs } from '../../utils/fixtures';

// Mock WebSocket service
vi.mock('../../../services/websocket', () => ({
  webSocketService: {
    broadcastJobUpdate: vi.fn(),
  },
}));

// Mock database with proper query chain
const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../../db', () => ({
  db: mockDb,
  jobs: {
    id: 'id',
    userId: 'userId',
    status: 'status',
    paused: 'paused',
    progress: 'progress',
    createdAt: 'createdAt',
  },
  jobItems: {},
  jobDictionaries: {},
  dictionaries: {},
}));

// Mock authentication middleware
vi.mock('../../../middleware/auth', () => ({
  requireAuth: vi.fn(async (c, next) => {
    c.set('user', testUsers.admin);
    await next();
  }),
}));

// Mock drizzle-orm functions
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual('drizzle-orm');
  return {
    ...actual,
    eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
    and: vi.fn((...conditions) => ({ conditions, op: 'and' })),
    desc: vi.fn((field) => ({ field, op: 'desc' })),
  };
});

describe('Jobs API Endpoints', () => {
  let app: any;
  let webSocketService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import dependencies
    const { Hono } = await import('hono');
    const { jobsRouter } = await import('../../../routes/jobs');
    webSocketService = await import('../../../services/websocket');

    // Create app and mount router
    app = new Hono();
    app.route('/jobs', jobsRouter);
  });

  describe('POST /:id/pause', () => {
    it('should pause a job successfully', async () => {
      const jobId = 1;
      const mockResult = [{ ...testJobs.processing, id: jobId, status: 'paused', paused: 1 }];

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(mockResult),
          }),
        }),
      });

      const req = new Request(`http://localhost/jobs/${jobId}/pause`, {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Job paused successfully');
      expect(webSocketService.webSocketService.broadcastJobUpdate).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          type: 'status',
          data: expect.objectContaining({
            status: 'paused',
            paused: 1,
          }),
        })
      );
    });

    it('should return 404 when job not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/999/pause', {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Job not found');
    });

    it('should handle database errors', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/1/pause', {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBe('Failed to pause job');
    });
  });

  describe('POST /:id/resume', () => {
    it('should resume a paused job successfully', async () => {
      const jobId = 2;
      const mockResult = [{ ...testJobs.paused, id: jobId, status: 'pending', paused: 0 }];

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(mockResult),
          }),
        }),
      });

      const req = new Request(`http://localhost/jobs/${jobId}/resume`, {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Job resumed successfully');
      expect(webSocketService.webSocketService.broadcastJobUpdate).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          type: 'status',
          data: expect.objectContaining({
            status: 'pending',
            paused: 0,
          }),
        })
      );
    });

    it('should return 404 when job not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/999/resume', {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Job not found');
    });

    it('should handle database errors', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/1/resume', {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBe('Failed to resume job');
    });
  });

  describe('POST /:id/stop', () => {
    it('should stop a job successfully', async () => {
      const jobId = 3;
      const now = new Date();
      const mockResult = [{
        ...testJobs.processing,
        id: jobId,
        status: 'stopped',
        completedAt: now,
      }];

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(mockResult),
          }),
        }),
      });

      const req = new Request(`http://localhost/jobs/${jobId}/stop`, {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Job stopped successfully');
      expect(webSocketService.webSocketService.broadcastJobUpdate).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          type: 'status',
          data: expect.objectContaining({
            status: 'stopped',
          }),
        })
      );
    });

    it('should return 404 when job not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/999/stop', {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Job not found');
    });

    it('should handle database errors', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/1/stop', {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBe('Failed to stop job');
    });
  });

  describe('POST /:id/restart', () => {
    it('should restart a completed job successfully', async () => {
      const jobId = 4;
      const mockJobResult = [{
        ...testJobs.completed,
        id: jobId,
        status: 'pending',
        progress: 0,
        itemsCracked: 0,
      }];

      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(mockJobResult),
          }),
        }),
      }).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const req = new Request(`http://localhost/jobs/${jobId}/restart`, {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Job restarted successfully');
      expect(webSocketService.webSocketService.broadcastJobUpdate).toHaveBeenCalled();
    });

    it('should return 404 when job not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/999/restart', {
        method: 'POST',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Job not found');
    });
  });

  describe('GET /list', () => {
    it('should return list of jobs for authenticated user', async () => {
      const mockJobs = [
        testJobs.pending,
        testJobs.processing,
        testJobs.completed,
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockJobs),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/list');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);
    });

    it('should return empty array when no jobs exist', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/list');
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

      const req = new Request('http://localhost/jobs/list');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBe('Failed to fetch jobs');
    });
  });

  describe('GET /:id', () => {
    it('should return specific job by ID', async () => {
      const jobId = 1;
      const mockJob = [{ ...testJobs.processing, id: jobId }];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockJob),
          }),
        }),
      });

      const req = new Request(`http://localhost/jobs/${jobId}`);
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.id).toBe(jobId);
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('filename');
    });

    it('should return 404 when job not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/999');
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Job not found');
    });
  });

  describe('GET /:id/status', () => {
    it('should return job status and progress', async () => {
      const jobId = 2;
      const mockJobStatus = [{
        id: jobId,
        status: 'processing',
        progress: 45,
        itemsTotal: 10,
        itemsCracked: 4,
        speed: '1250 kH/s',
        eta: '00:15:30',
        startedAt: new Date(),
        completedAt: null,
        currentDictionary: 'rockyou.txt',
        error: null,
        hashCount: 5,
        totalHashes: 10,
      }];

      // Mock job status query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockJobStatus),
          }),
        }),
      });

      // Mock crackedItemsCount query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue(4),
          }),
        }),
      });

      // Mock totalItemsCount query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue(10),
          }),
        }),
      });

      const req = new Request(`http://localhost/jobs/${jobId}/status`);
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('processing');
      expect(data.progress).toBe(45);
      expect(data).toHaveProperty('calculatedProgress');
      expect(data).toHaveProperty('crackedItems');
      expect(data).toHaveProperty('totalItems');
    });

    it('should return 404 when job not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/999/status');
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Job not found');
    });
  });

  describe('DELETE /:id', () => {
    it('should delete a completed job', async () => {
      const jobId = 5;
      const mockJob = [{ ...testJobs.completed, id: jobId }];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockJob),
          }),
        }),
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const req = new Request(`http://localhost/jobs/${jobId}`, {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Job deleted successfully');
    });

    it('should not delete a processing job', async () => {
      const jobId = 6;
      const mockJob = [{ ...testJobs.processing, id: jobId }];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockJob),
          }),
        }),
      });

      const req = new Request(`http://localhost/jobs/${jobId}`, {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toBe('Cannot delete job while it is processing');
    });

    it('should return 404 when job not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/999', {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Job not found');
    });
  });

  describe('PUT /:id/priority', () => {
    it('should update job priority', async () => {
      const jobId = 7;
      const newPriority = 10;
      const mockJob = [{ ...testJobs.pending, id: jobId, priority: newPriority }];

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(mockJob),
          }),
        }),
      });

      const req = new Request(`http://localhost/jobs/${jobId}/priority`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Job priority updated successfully');
    });

    it('should return 404 when job not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/jobs/999/priority', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 5 }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Job not found');
    });
  });

  describe('WebSocket Integration', () => {
    it('should broadcast updates on job state changes', async () => {
      const jobId = 8;
      const mockResult = [{ ...testJobs.pending, id: jobId, status: 'paused', paused: 1 }];

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(mockResult),
          }),
        }),
      });

      const req = new Request(`http://localhost/jobs/${jobId}/pause`, {
        method: 'POST',
      });
      await app.fetch(req);

      expect(webSocketService.webSocketService.broadcastJobUpdate).toHaveBeenCalledTimes(1);
      expect(webSocketService.webSocketService.broadcastJobUpdate).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          type: 'status',
        })
      );
    });
  });
});
