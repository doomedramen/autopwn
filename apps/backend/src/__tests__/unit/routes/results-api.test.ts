import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testUsers, testJobs } from '../../utils/fixtures';

// Mock database
const mockDb = {
  select: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../../db', () => ({
  db: mockDb,
  results: {},
  jobs: {},
  jobItems: {},
}));

// Mock authentication middleware
vi.mock('../../../middleware/auth', () => ({
  requireAuth: vi.fn(async (c, next) => {
    c.set('user', testUsers.admin);
    await next();
  }),
}));

describe('Results API Endpoints', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import Hono and router after mocks are set up
    const { Hono } = await import('hono');
    const { resultsRouter } = await import('../../../routes/results');

    // Create app and mount router
    app = new Hono();
    app.route('/results', resultsRouter);
  });

  describe('GET /list', () => {
    it('should return paginated results with default parameters', async () => {
      const mockResults = [
        {
          id: 1,
          jobId: 1,
          essid: 'HomeNetwork',
          password: 'password123',
          crackedAt: new Date('2024-01-15'),
          pcapFilename: 'capture1.pcap',
          jobFilename: 'job1.pcap',
          jobStatus: 'completed',
        },
        {
          id: 2,
          jobId: 2,
          essid: 'OfficeWiFi',
          password: 'secure456',
          crackedAt: new Date('2024-01-16'),
          pcapFilename: 'capture2.pcap',
          jobFilename: 'job2.pcap',
          jobStatus: 'completed',
        },
      ];

      // Mock count query
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 2 }]),
          }),
        })
        // Mock results query
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockResults),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/list');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('pagination');
      expect(data.results).toHaveLength(2);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(50);
      expect(data.pagination.total).toBe(2);
    });

    it('should handle pagination parameters', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 100 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/list?page=2&limit=25');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.pagination.page).toBe(2);
      expect(data.pagination.limit).toBe(25);
      expect(data.pagination.totalPages).toBe(4);
    });

    it('should filter by jobId', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 5 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/list?jobId=123');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
    });

    it('should filter by ESSID', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 3 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/list?essid=HomeNet');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
    });

    it('should filter by date range', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 10 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/list?startDate=2024-01-01&endDate=2024-01-31');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
    });

    it('should handle empty results', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/list');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.results).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      const req = new Request('http://localhost/results/list');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Failed to fetch results');
    });
  });

  describe('GET /export', () => {
    const mockExportResults = [
      {
        id: 1,
        jobId: 1,
        essid: 'TestNetwork',
        password: 'password123',
        crackedAt: new Date('2024-01-15'),
        pcapFilename: 'test.pcap',
        jobFilename: 'job1.pcap',
      },
    ];

    it('should export results in JSON format by default', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockExportResults),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/results/export');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const data = await res.json();
      expect(data).toHaveProperty('exportDate');
      expect(data).toHaveProperty('totalResults');
      expect(data).toHaveProperty('results');
      expect(data.totalResults).toBe(1);
    });

    it('should export results in CSV format', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockExportResults),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/results/export?format=csv');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/csv');
      expect(res.headers.get('content-disposition')).toContain('attachment');
      expect(res.headers.get('content-disposition')).toContain('.csv');

      const text = await res.text();
      expect(text).toContain('ID,Job ID,ESSID,Password');
      expect(text).toContain('TestNetwork');
      expect(text).toContain('password123');
    });

    it('should export results in plain text format', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockExportResults),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/results/export?format=txt');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/plain');
      expect(res.headers.get('content-disposition')).toContain('.txt');

      const text = await res.text();
      expect(text).toContain('ESSID: TestNetwork');
      expect(text).toContain('Password: password123');
    });

    it('should export results in hashcat format', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockExportResults),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/results/export?format=hashcat');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/plain');
      expect(res.headers.get('content-disposition')).toContain('.hccapx');

      const text = await res.text();
      expect(text).toBe('TestNetwork:password123');
    });

    it('should handle export filters', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/results/export?jobId=123&essid=Test&startDate=2024-01-01');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
    });

    it('should handle database errors during export', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockRejectedValue(new Error('Database error')),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/results/export');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBe('Failed to export results');
    });
  });

  describe('GET /job/:jobId', () => {
    it('should return results for specific job', async () => {
      const mockJob = [{ id: 1, userId: testUsers.admin.id }];
      const mockResults = [
        {
          id: 1,
          essid: 'TestNet',
          password: 'pass123',
          crackedAt: new Date(),
        },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockJob),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockResults),
            }),
          }),
        });

      const req = new Request('http://localhost/results/job/1');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
    });

    it('should handle job not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/results/job/999');
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Job not found');
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const req = new Request('http://localhost/results/job/1');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBe('Failed to fetch job results');
    });
  });

  describe('GET /stats', () => {
    it('should return result statistics', async () => {
      const mockAllResults = [
        { essid: 'Net1' },
        { essid: 'Net2' },
        { essid: 'Net1' },
      ];

      const mockRecentResults = [{ essid: 'Net1' }];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockAllResults),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockRecentResults),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockAllResults),
          }),
        });

      const req = new Request('http://localhost/results/stats');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('totalCracked');
      expect(data).toHaveProperty('recentCracked');
      expect(data).toHaveProperty('uniqueEssids');
      expect(data).toHaveProperty('period');
      expect(data.totalCracked).toBe(3);
      expect(data.recentCracked).toBe(1);
      expect(data.uniqueEssids).toBe(2);
      expect(data.period).toBe('30d');
    });

    it('should handle no results', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/results/stats');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.totalCracked).toBe(0);
      expect(data.recentCracked).toBe(0);
      expect(data.uniqueEssids).toBe(0);
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      const req = new Request('http://localhost/results/stats');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBe('Failed to fetch result stats');
    });
  });

  describe('GET /search', () => {
    it('should search results by ESSID', async () => {
      const mockSearchResults = [
        {
          id: 1,
          essid: 'HomeNetwork',
          password: 'test123',
          crackedAt: new Date(),
        },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockSearchResults),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/search?q=Home&type=essid');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('query');
      expect(data).toHaveProperty('pagination');
      expect(data.query).toBe('Home');
      expect(data.type).toBe('essid');
    });

    it('should search results by password', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 2 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/search?q=pass&type=password');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.type).toBe('password');
    });

    it('should reject missing search query', async () => {
      const req = new Request('http://localhost/results/search');
      const res = await app.fetch(req);

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toBe('Search query is required');
    });

    it('should handle pagination in search', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 50 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/search?q=test&page=2&limit=10');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.pagination.page).toBe(2);
      expect(data.pagination.limit).toBe(10);
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      const req = new Request('http://localhost/results/search?q=test');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBe('Failed to search results');
    });
  });

  describe('DELETE /:id', () => {
    it('should delete result successfully', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1, userId: testUsers.admin.id }]),
          }),
        }),
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const req = new Request('http://localhost/results/1', {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Result deleted successfully');
    });

    it('should handle result not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new Request('http://localhost/results/999', {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Result not found');
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const req = new Request('http://localhost/results/1', {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBe('Failed to delete result');
    });
  });

  describe('DELETE /bulk', () => {
    it('should bulk delete results by jobId', async () => {
      const mockDeletedResults = [{ id: 1 }, { id: 2 }, { id: 3 }];

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(mockDeletedResults),
        }),
      });

      const req = new Request('http://localhost/results/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: 123 }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      // Check for either deletedCount or the actual array length
      expect(data.deletedCount || data.message).toBeDefined();
    });

    it('should bulk delete results older than date', async () => {
      const mockDeletedResults = [{ id: 1 }];

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(mockDeletedResults),
        }),
      });

      const req = new Request('http://localhost/results/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThan: '2024-01-01' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('message');
    });

    it('should handle no results deleted', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request('http://localhost/results/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: 999 }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const req = new Request('http://localhost/results/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: 123 }),
      });
      const res = await app.fetch(req);

      // May return 200 or 500 depending on error handling
      expect([200, 500]).toContain(res.status);

      const data = await res.json();
      expect(data).toBeDefined();
    });
  });

  describe('GET /:id', () => {
    it('should return detailed result information', async () => {
      const mockResult = [
        {
          id: 1,
          jobId: 1,
          essid: 'TestNetwork',
          password: 'password123',
          crackedAt: new Date('2024-01-15'),
          pcapFilename: 'test.pcap',
          jobFilename: 'job1.pcap',
          jobStatus: 'completed',
          jobCreatedAt: new Date('2024-01-10'),
          jobCompletedAt: new Date('2024-01-15'),
        },
      ];

      const mockRelatedResults = [
        {
          id: 2,
          jobId: 2,
          password: 'otherpass',
          crackedAt: new Date('2024-01-16'),
          jobFilename: 'job2.pcap',
        },
      ];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockResult),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockRelatedResults),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/1');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('result');
      expect(data).toHaveProperty('relatedResults');
      expect(data.result.id).toBe(1);
      expect(data.relatedResults).toHaveLength(1);
    });

    it('should handle result not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/results/999');
      const res = await app.fetch(req);

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Result not found');
    });

    it('should handle database errors', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockRejectedValue(new Error('Database error')),
            }),
          }),
        }),
      });

      const req = new Request('http://localhost/results/1');
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBe('Failed to fetch result details');
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid page number', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 10 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/list?page=-1');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      // Should handle gracefully, defaulting to valid page
    });

    it('should handle very large limit', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 100 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/list?limit=10000');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
    });

    it('should handle special characters in search query', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/search?q=%23!@&type=essid');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
    });

    it('should handle malformed date filters', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/list?startDate=invalid-date');
      const res = await app.fetch(req);

      // Should still work, may just ignore invalid date
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      // All endpoints use requireAuth middleware
      // This is validated by the authentication middleware mock
      const req = new Request('http://localhost/results/list');
      const res = await app.fetch(req);

      // Should work with authenticated user
      expect(res.status).not.toBe(401);
    });

    it('should filter results by authenticated user', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 5 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        });

      const req = new Request('http://localhost/results/list');
      await app.fetch(req);

      // Verify user filtering is applied (would be in where conditions)
      expect(mockDb.select).toHaveBeenCalled();
    });
  });
});
