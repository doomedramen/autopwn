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

describe('Worker Service - Timeout Mechanism', () => {
  let workerService: WorkerService;

  beforeEach(() => {
    vi.clearAllMocks();
    workerService = new WorkerService();
  });

  describe('hasJobTimedOut', () => {
    it('should return false for jobs within timeout', () => {
      const startTime = Date.now() - (1000 * 60 * 60); // 1 hour ago
      const hasTimedOut = (workerService as any).hasJobTimedOut(startTime);
      expect(hasTimedOut).toBe(false);
    });

    it('should return false for jobs at exact timeout threshold', () => {
      const startTime = Date.now() - (24 * 60 * 60 * 1000); // Exactly 24 hours ago
      const hasTimedOut = (workerService as any).hasJobTimedOut(startTime);
      expect(hasTimedOut).toBe(false);
    });

    it('should return true for jobs exceeding timeout', () => {
      const startTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const hasTimedOut = (workerService as any).hasJobTimedOut(startTime);
      expect(hasTimedOut).toBe(true);
    });

    it('should return true for jobs significantly exceeding timeout', () => {
      const startTime = Date.now() - (48 * 60 * 60 * 1000); // 48 hours ago
      const hasTimedOut = (workerService as any).hasJobTimedOut(startTime);
      expect(hasTimedOut).toBe(true);
    });

    it('should handle edge case of just-started jobs', () => {
      const startTime = Date.now(); // Just now
      const hasTimedOut = (workerService as any).hasJobTimedOut(startTime);
      expect(hasTimedOut).toBe(false);
    });

    it('should handle edge case of jobs started in future (clock skew)', () => {
      const startTime = Date.now() + (1000 * 60 * 60); // 1 hour in future
      const hasTimedOut = (workerService as any).hasJobTimedOut(startTime);
      expect(hasTimedOut).toBe(false);
    });
  });

  describe('checkJobStatus', () => {
    it('should return job status from database', async () => {
      const mockDb = await import('../../../db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ status: 'processing' }]),
          }),
        }),
      } as any);

      const status = await (workerService as any).checkJobStatus(123);
      expect(status).toBe('processing');
    });

    it('should return null if job not found', async () => {
      const mockDb = await import('../../../db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const status = await (workerService as any).checkJobStatus(123);
      expect(status).toBeNull();
    });

    it('should return null on database error', async () => {
      const mockDb = await import('../../../db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      } as any);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const status = await (workerService as any).checkJobStatus(123);

      expect(status).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to check job status:', expect.any(Error));
    });

    it('should detect paused status', async () => {
      const mockDb = await import('../../../db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ status: 'paused' }]),
          }),
        }),
      } as any);

      const status = await (workerService as any).checkJobStatus(123);
      expect(status).toBe('paused');
    });

    it('should detect stopped status', async () => {
      const mockDb = await import('../../../db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ status: 'stopped' }]),
          }),
        }),
      } as any);

      const status = await (workerService as any).checkJobStatus(123);
      expect(status).toBe('stopped');
    });
  });

  describe('killCurrentProcess', () => {
    it('should kill process with SIGTERM first', () => {
      const mockProcess = {
        pid: 12345,
        kill: vi.fn().mockReturnValue(true),
        killed: false,
      };

      (workerService as any).currentProcess = mockProcess;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      (workerService as any).killCurrentProcess();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Killing current process'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('12345'));
    });

    it('should force kill with SIGKILL after timeout', (done: any) => {
      const mockProcess = {
        pid: 12345,
        kill: vi.fn().mockReturnValue(true),
        killed: false,
      };

      (workerService as any).currentProcess = mockProcess;
      (workerService as any).killCurrentProcess();

      // Wait for force kill timeout
      setTimeout(() => {
        // Should have attempted both SIGTERM and SIGKILL
        expect(mockProcess.kill).toHaveBeenCalledTimes(2);
        expect(mockProcess.kill).toHaveBeenNthCalledWith(1, 'SIGTERM');
        expect(mockProcess.kill).toHaveBeenNthCalledWith(2, 'SIGKILL');
        done();
      }, 1100);
    });

    it('should not force kill if process already killed', (done: any) => {
      const mockProcess = {
        pid: 12345,
        kill: vi.fn((signal) => {
          mockProcess.killed = true;
          return true;
        }),
        killed: false,
      };

      (workerService as any).currentProcess = mockProcess;
      (workerService as any).killCurrentProcess();

      // Wait for potential force kill timeout
      setTimeout(() => {
        // Should only have SIGTERM, not SIGKILL since already killed
        expect(mockProcess.kill).toHaveBeenCalledTimes(1);
        done();
      }, 1100);
    });

    it('should handle kill errors gracefully', () => {
      const mockProcess = {
        pid: 12345,
        kill: vi.fn().mockImplementation(() => {
          throw new Error('Process kill failed');
        }),
        killed: false,
      };

      (workerService as any).currentProcess = mockProcess;

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      (workerService as any).killCurrentProcess();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Killing current process'));
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to kill process:', expect.any(Error));
    });

    it('should do nothing if no current process', () => {
      (workerService as any).currentProcess = null;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      (workerService as any).killCurrentProcess();

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
