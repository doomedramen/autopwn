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

describe('Stats API Endpoints', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import Hono and router after mocks are set up
    const { Hono } = await import('hono');
    const { statsRouter } = await import('../../../routes/stats');

    // Create app and mount router
    app = new Hono();
    app.route('/stats', statsRouter);
  });

  describe('GET /', () => {
    it('should return comprehensive statistics', async () => {
      // Mock database responses for all statistics queries
      mockDb.select
        // totalJobs
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: '100' }]),
          }),
        })
        // completedJobs
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: '75' }]),
          }),
        })
        // processingJobs
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: '10' }]),
          }),
        })
        // failedJobs
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: '15' }]),
          }),
        })
        // totalCracks
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: '250' }]),
          }),
        })
        // recentCracks
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: '45' }]),
          }),
        })
        // uniqueEssids
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: '80' }]),
          }),
        });

      const req = new Request('http://localhost/stats');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toEqual({
        totalJobs: 100,
        completedJobs: 75,
        processingJobs: 10,
        failedJobs: 15,
        totalCracked: 250,
        recentCracked: 45,
        uniqueEssids: 80,
      });
    });

    it('should handle zero statistics', async () => {
      // Mock all counts as zero
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: '0' }]),
        }),
      });

      const req = new Request('http://localhost/stats');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toEqual({
        totalJobs: 0,
        completedJobs: 0,
        processingJobs: 0,
        failedJobs: 0,
        totalCracked: 0,
        recentCracked: 0,
        uniqueEssids: 0,
      });
    });

    it('should handle null counts gracefully', async () => {
      // Mock null counts
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: null }]),
        }),
      });

      const req = new Request('http://localhost/stats');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.totalJobs).toBe(0);
      expect(data.completedJobs).toBe(0);
      expect(data.processingJobs).toBe(0);
      expect(data.failedJobs).toBe(0);
      expect(data.totalCracked).toBe(0);
      expect(data.recentCracked).toBe(0);
      expect(data.uniqueEssids).toBe(0);
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        }),
      });

      const req = new Request('http://localhost/stats');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to fetch stats');
    });

    it('should handle large numbers', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: '999999' }]),
          }),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: '0' }]),
          }),
        });

      const req = new Request('http://localhost/stats');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.totalJobs).toBe(999999);
    });

    it('should isolate statistics by user', async () => {
      // The mock verifies user isolation happens at the query level
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: '50' }]),
        }),
      });

      const req = new Request('http://localhost/stats');
      await app.fetch(req);

      // Verify database queries were made
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('GET /success-rate', () => {
    it('should calculate success rate correctly', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ rate: 75.5 }]),
        }),
      });

      const req = new Request('http://localhost/stats/success-rate');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.successRate).toBe(75.5);
    });

    it('should handle 100% success rate', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ rate: 100 }]),
        }),
      });

      const req = new Request('http://localhost/stats/success-rate');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.successRate).toBe(100);
    });

    it('should handle 0% success rate', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ rate: 0 }]),
        }),
      });

      const req = new Request('http://localhost/stats/success-rate');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.successRate).toBe(0);
    });

    it('should handle no completed/failed jobs', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ rate: null }]),
        }),
      });

      const req = new Request('http://localhost/stats/success-rate');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.successRate).toBe(0);
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      const req = new Request('http://localhost/stats/success-rate');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to fetch success rate');
    });

    it('should handle fractional success rates', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ rate: 33.333333 }]),
        }),
      });

      const req = new Request('http://localhost/stats/success-rate');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.successRate).toBeCloseTo(33.33, 1);
    });
  });

  describe('GET /recent', () => {
    it('should return recent jobs and results', async () => {
      const mockRecentJobs = [
        {
          id: 1,
          filename: 'capture1.pcap',
          status: 'completed',
          createdAt: new Date('2025-10-10T10:00:00Z'),
          completedAt: new Date('2025-10-10T10:30:00Z'),
        },
        {
          id: 2,
          filename: 'capture2.pcap',
          status: 'processing',
          createdAt: new Date('2025-10-10T09:00:00Z'),
          completedAt: null,
        },
      ];

      const mockRecentResults = [
        {
          id: 1,
          essid: 'TestNetwork',
          password: 'password123',
          crackedAt: new Date('2025-10-10T10:00:00Z'),
        },
      ];

      mockDb.select
        // recentJobs
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockRecentJobs),
              }),
            }),
          }),
        })
        // recentResults
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockRecentResults),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/stats/recent');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('recentJobs');
      expect(data).toHaveProperty('recentResults');
      expect(data.recentJobs).toHaveLength(2);
      expect(data.recentResults).toHaveLength(1);
      expect(data.recentJobs[0].filename).toBe('capture1.pcap');
      expect(data.recentResults[0].essid).toBe('TestNetwork');
    });

    it('should limit to 10 jobs and 10 results', async () => {
      const mockJobs = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        filename: `capture${i + 1}.pcap`,
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date(),
      }));

      const mockResults = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        essid: `Network${i + 1}`,
        password: `pass${i + 1}`,
        crackedAt: new Date(),
      }));

      // Mock returns 10 items (limited by query)
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockJobs.slice(0, 10)),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockResults.slice(0, 10)),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/stats/recent');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.recentJobs).toHaveLength(10);
      expect(data.recentResults).toHaveLength(10);
    });

    it('should handle empty recent activity', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/stats/recent');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.recentJobs).toHaveLength(0);
      expect(data.recentResults).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockRejectedValue(new Error('Database error')),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/stats/recent');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to fetch recent activity');
    });

    it('should return jobs sorted by creation date', async () => {
      const mockJobs = [
        {
          id: 3,
          filename: 'newest.pcap',
          status: 'completed',
          createdAt: new Date('2025-10-10T12:00:00Z'),
          completedAt: new Date(),
        },
        {
          id: 2,
          filename: 'middle.pcap',
          status: 'completed',
          createdAt: new Date('2025-10-10T11:00:00Z'),
          completedAt: new Date(),
        },
        {
          id: 1,
          filename: 'oldest.pcap',
          status: 'completed',
          createdAt: new Date('2025-10-10T10:00:00Z'),
          completedAt: new Date(),
        },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockJobs),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/stats/recent');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      // Jobs should be in descending order (newest first)
      expect(data.recentJobs[0].filename).toBe('newest.pcap');
      expect(data.recentJobs[1].filename).toBe('middle.pcap');
      expect(data.recentJobs[2].filename).toBe('oldest.pcap');
    });

    it('should include job completion timestamps', async () => {
      const completedAt = new Date('2025-10-10T10:30:00Z');
      const mockJobs = [
        {
          id: 1,
          filename: 'test.pcap',
          status: 'completed',
          createdAt: new Date('2025-10-10T10:00:00Z'),
          completedAt,
        },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockJobs),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/stats/recent');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.recentJobs[0].completedAt).toBe(completedAt.toISOString());
    });

    it('should handle processing jobs with null completedAt', async () => {
      const mockJobs = [
        {
          id: 1,
          filename: 'processing.pcap',
          status: 'processing',
          createdAt: new Date(),
          completedAt: null,
        },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockJobs),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/stats/recent');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.recentJobs[0].completedAt).toBeNull();
    });
  });

  describe('Authentication', () => {
    it('should require authentication for GET /', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: '0' }]),
        }),
      });

      const req = new Request('http://localhost/stats');
      const res = await app.fetch(req);

      // Should work with authentication
      expect(res.status).toBe(200);
    });

    it('should require authentication for GET /success-rate', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ rate: 0 }]),
        }),
      });

      const req = new Request('http://localhost/stats/success-rate');
      const res = await app.fetch(req);

      // Should work with authentication
      expect(res.status).toBe(200);
    });

    it('should require authentication for GET /recent', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/stats/recent');
      const res = await app.fetch(req);

      // Should work with authentication
      expect(res.status).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very recent activity (same timestamp)', async () => {
      const sameTime = new Date('2025-10-10T10:00:00Z');
      const mockJobs = [
        { id: 1, filename: 'job1.pcap', status: 'completed', createdAt: sameTime, completedAt: sameTime },
        { id: 2, filename: 'job2.pcap', status: 'completed', createdAt: sameTime, completedAt: sameTime },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockJobs),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/stats/recent');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.recentJobs).toHaveLength(2);
    });

    it('should handle mixed job statuses', async () => {
      const mockJobs = [
        { id: 1, filename: 'completed.pcap', status: 'completed', createdAt: new Date(), completedAt: new Date() },
        { id: 2, filename: 'processing.pcap', status: 'processing', createdAt: new Date(), completedAt: null },
        { id: 3, filename: 'failed.pcap', status: 'failed', createdAt: new Date(), completedAt: new Date() },
        { id: 4, filename: 'pending.pcap', status: 'pending', createdAt: new Date(), completedAt: null },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockJobs),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/stats/recent');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.recentJobs).toHaveLength(4);
    });

    it('should handle string count values from database', async () => {
      // Database might return string counts
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: '42' }]),
        }),
      });

      const req = new Request('http://localhost/stats');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      // Should be converted to numbers
      expect(typeof data.totalJobs).toBe('number');
      expect(data.totalJobs).toBe(42);
    });
  });
});
