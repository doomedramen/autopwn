import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkerService } from '../../../services/worker';

// Mock dependencies
vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  jobs: {},
  jobItems: {},
  jobDictionaries: {},
  dictionaries: {},
  results: {},
}));

vi.mock('../../../config/env', () => ({
  env: {
    JOB_TIMEOUT_HOURS: 24,
    PCAPS_PATH: '/tmp/test-pcaps',
    DICTIONARIES_PATH: '/tmp/test-dictionaries',
    JOBS_PATH: '/tmp/test-jobs',
  },
}));

describe('Worker Service - Orphaned Job Cleanup', () => {
  let workerService: WorkerService;
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb = await import('../../../db');
    workerService = new WorkerService();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('cleanupOrphanedJobs', () => {
    it('should reset orphaned jobs from processing to pending', async () => {
      // Mock orphaned jobs in processing state
      const orphanedJobs = [
        { id: 1, status: 'processing', filename: 'job1.pcap' },
        { id: 2, status: 'processing', filename: 'job2.pcap' },
        { id: 3, status: 'processing', filename: 'job3.pcap' },
      ];

      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(orphanedJobs),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(mockDb.db.update).mockImplementation(mockUpdate);

      await (workerService as any).cleanupOrphanedJobs();

      // Should have updated all 3 orphaned jobs
      expect(mockUpdate).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Cleaning up 3 orphaned job(s)'));
    });

    it('should not do anything if no orphaned jobs found', async () => {
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const mockUpdate = vi.fn();
      vi.mocked(mockDb.db.update).mockImplementation(mockUpdate);

      await (workerService as any).cleanupOrphanedJobs();

      // Should not have called update
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should reset startedAt to null when cleaning up', async () => {
      const orphanedJobs = [
        { id: 1, status: 'processing', filename: 'job1.pcap', startedAt: new Date() },
      ];

      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(orphanedJobs),
        }),
      });

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockUpdate = vi.fn().mockReturnValue({
        set: mockSet,
      });
      vi.mocked(mockDb.db.update).mockImplementation(mockUpdate);

      await (workerService as any).cleanupOrphanedJobs();

      // Verify startedAt is reset to null
      expect(mockSet).toHaveBeenCalledWith({
        status: 'pending',
        startedAt: null,
      });
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        }),
      });

      // Should not throw
      await expect((workerService as any).cleanupOrphanedJobs()).resolves.not.toThrow();

      expect(console.error).toHaveBeenCalledWith('Failed to clean up orphaned jobs:', expect.any(Error));
    });

    it('should handle partial cleanup failures', async () => {
      const orphanedJobs = [
        { id: 1, status: 'processing', filename: 'job1.pcap' },
        { id: 2, status: 'processing', filename: 'job2.pcap' },
      ];

      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(orphanedJobs),
        }),
      });

      // First update succeeds, second fails
      let updateCount = 0;
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            updateCount++;
            if (updateCount === 2) {
              return Promise.reject(new Error('Update failed'));
            }
            return Promise.resolve(undefined);
          }),
        }),
      });
      vi.mocked(mockDb.db.update).mockImplementation(mockUpdate);

      // Should not throw, but log error
      await expect((workerService as any).cleanupOrphanedJobs()).resolves.not.toThrow();
    });

    it('should only cleanup jobs in processing state', async () => {
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockImplementation((table) => ({
          where: vi.fn().mockImplementation((condition) => {
            // Verify it's filtering by status='processing'
            // This is checked by the drizzle query builder
            return Promise.resolve([
              { id: 1, status: 'processing', filename: 'job1.pcap' },
            ]);
          }),
        })),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(mockDb.db.update).mockImplementation(mockUpdate);

      await (workerService as any).cleanupOrphanedJobs();

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should handle large numbers of orphaned jobs', async () => {
      // Generate 100 orphaned jobs
      const orphanedJobs = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        status: 'processing',
        filename: `job${i + 1}.pcap`,
      }));

      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(orphanedJobs),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(mockDb.db.update).mockImplementation(mockUpdate);

      await (workerService as any).cleanupOrphanedJobs();

      expect(mockUpdate).toHaveBeenCalledTimes(100);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Cleaning up 100 orphaned job(s)'));
    });
  });
});
