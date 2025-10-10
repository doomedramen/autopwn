import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testUsers } from '../../utils/fixtures';

// Mock database
const mockDb = {
  select: vi.fn(),
};

vi.mock('../../../db', () => ({
  db: mockDb,
  jobs: {},
  results: {},
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

// Mock SQL tag function from drizzle-orm
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual('drizzle-orm');
  return {
    ...actual,
    sql: vi.fn((strings, ...values) => {
      return { strings, values };
    }),
  };
});

describe('Analytics API Endpoints', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import Hono and router after mocks are set up
    const { Hono } = await import('hono');
    const { analyticsRouter } = await import('../../../routes/analytics');

    // Create app and mount router
    app = new Hono();
    app.route('/analytics', analyticsRouter);
  });

  describe('GET /', () => {
    it('should return comprehensive analytics with default 30d range', async () => {
      // Mock jobsOverTime query
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { date: '2025-09-10', count: '5' },
              { date: '2025-09-15', count: '8' },
              { date: '2025-09-20', count: '12' },
            ]),
          }),
        }),
      });

      mockDb.select.mockReturnValue({ from: mockFrom });

      // Create a mock request
      const req = new Request('http://localhost/analytics');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('jobsOverTime');
      expect(data).toHaveProperty('cracksOverTime');
      expect(data).toHaveProperty('statusDistribution');
      expect(data).toHaveProperty('dictionaryEffectiveness');
      expect(data).toHaveProperty('avgCompletionTime');
      expect(data).toHaveProperty('successRate');
    });

    it('should handle 7d range parameter', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.select.mockReturnValue({ from: mockFrom });

      const req = new Request('http://localhost/analytics?range=7d');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('jobsOverTime');
    });

    it('should handle 90d range parameter', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.select.mockReturnValue({ from: mockFrom });

      const req = new Request('http://localhost/analytics?range=90d');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('jobsOverTime');
    });

    it('should handle 1y range parameter', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.select.mockReturnValue({ from: mockFrom });

      const req = new Request('http://localhost/analytics?range=1y');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('jobsOverTime');
    });

    it('should handle "all" range parameter', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.select.mockReturnValue({ from: mockFrom });

      const req = new Request('http://localhost/analytics?range=all');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('jobsOverTime');
    });

    it('should return 0 for missing avgCompletionTime', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock avgCompletionTime returning no results
      mockDb.select.mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ avgSeconds: null }]),
          })
        });

      const req = new Request('http://localhost/analytics');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.avgCompletionTime).toBe(0);
    });

    it('should return 0 for missing successRate', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock successRate returning no results
      mockDb.select.mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ rate: null }]),
          })
        });

      const req = new Request('http://localhost/analytics');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.successRate).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        }),
      });

      const req = new Request('http://localhost/analytics');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to fetch analytics');
    });
  });

  describe('GET /jobs', () => {
    it('should return job statistics', async () => {
      const mockJobStats = {
        totalJobs: '100',
        completedJobs: '75',
        failedJobs: '10',
        processingJobs: '5',
        pendingJobs: '10',
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockJobStats]),
        }),
      });

      const req = new Request('http://localhost/analytics/jobs');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.totalJobs).toBe('100');
      expect(data.completedJobs).toBe('75');
      expect(data.failedJobs).toBe('10');
      expect(data.processingJobs).toBe('5');
      expect(data.pendingJobs).toBe('10');
    });

    it('should handle zero jobs', async () => {
      const mockJobStats = {
        totalJobs: '0',
        completedJobs: '0',
        failedJobs: '0',
        processingJobs: '0',
        pendingJobs: '0',
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockJobStats]),
        }),
      });

      const req = new Request('http://localhost/analytics/jobs');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.totalJobs).toBe('0');
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      const req = new Request('http://localhost/analytics/jobs');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to fetch job analytics');
    });
  });

  describe('GET /results', () => {
    it('should return result statistics', async () => {
      const mockResultStats = {
        totalCracks: '150',
        uniqueEssids: '45',
        avgCracksPerJob: '3.5',
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockResolvedValue([mockResultStats]),
      });

      const req = new Request('http://localhost/analytics/results');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.totalCracks).toBe('150');
      expect(data.uniqueEssids).toBe('45');
      expect(data.avgCracksPerJob).toBe('3.5');
    });

    it('should handle no results', async () => {
      const mockResultStats = {
        totalCracks: '0',
        uniqueEssids: '0',
        avgCracksPerJob: null,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockResolvedValue([mockResultStats]),
      });

      const req = new Request('http://localhost/analytics/results');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.totalCracks).toBe('0');
      expect(data.uniqueEssids).toBe('0');
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const req = new Request('http://localhost/analytics/results');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to fetch result analytics');
    });
  });

  describe('GET /export', () => {
    it('should export analytics in JSON format by default', async () => {
      // Mock database responses for export
      const mockJobs = [
        {
          id: 1,
          filename: 'test.pcap',
          status: 'completed',
          progress: 100,
          speed: '1000 H/s',
          eta: null,
          itemsCracked: 10,
          itemsTotal: 10,
          priority: 5,
          createdAt: new Date(),
          startedAt: new Date(),
          completedAt: new Date(),
        },
      ];

      const mockResults = [
        {
          id: 1,
          essid: 'TestNetwork',
          password: 'password123',
          crackedAt: new Date(),
          jobId: 1,
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockJobs),
          }),
        }),
      });

      const req = new Request('http://localhost/analytics/export');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/json');
      expect(res.headers.get('content-disposition')).toContain('attachment');
      expect(res.headers.get('content-disposition')).toContain('.json');

      const data = await res.json();
      expect(data).toHaveProperty('metadata');
      expect(data).toHaveProperty('analytics');
      expect(data).toHaveProperty('jobs');
      expect(data).toHaveProperty('results');
      expect(data.metadata).toHaveProperty('exportedAt');
      expect(data.metadata).toHaveProperty('dateRange');
      expect(data.metadata).toHaveProperty('recordCounts');
    });

    it('should handle 7d range parameter in export', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/analytics/export?range=7d');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.metadata.dateRange).toBe('7d');
    });

    it('should handle export errors gracefully', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockRejectedValue(new Error('Export failed')),
          }),
        }),
      });

      const req = new Request('http://localhost/analytics/export');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to export analytics');
    });
  });

  describe('Authentication', () => {
    it('should include user context from authentication middleware', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            totalJobs: '50',
            completedJobs: '40',
            failedJobs: '5',
            processingJobs: '3',
            pendingJobs: '2',
          }]),
        }),
      });

      const req = new Request('http://localhost/analytics/jobs');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      // Verify that the request was processed (authentication middleware ran)
      const data = await res.json();
      expect(data).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid range parameter gracefully', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/analytics?range=invalid');
      const res = await app.fetch(req);

      // Should default to 30d
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('jobsOverTime');
    });

    it('should handle empty analytics data', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/analytics');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data.jobsOverTime)).toBe(true);
      expect(data.jobsOverTime.length).toBe(0);
    });

    it('should handle large datasets', async () => {
      // Generate large mock dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        date: `2025-01-${String(i % 31 + 1).padStart(2, '0')}`,
        count: String(Math.floor(Math.random() * 100)),
      }));

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(largeDataset),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/analytics');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.jobsOverTime.length).toBe(1000);
    });
  });
});
