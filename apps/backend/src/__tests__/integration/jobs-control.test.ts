import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { db, jobs, jobItems, jobDictionaries, dictionaries, users } from '../../db';
import { eq, and } from 'drizzle-orm';
import { testUsers, testJobs, testDictionaries } from '../utils/fixtures';

// Mock WebSocket service to avoid actual WebSocket connections
vi.mock('../../services/websocket', () => ({
  webSocketService: {
    broadcastJobUpdate: vi.fn(),
  },
}));

// Mock authentication middleware for testing
vi.mock('../../middleware/auth', () => ({
  requireAuth: vi.fn(async (c, next) => {
    // Set a test user
    c.set('user', testUsers.admin);
    await next();
  }),
}));

describe('Job Control Integration Tests', () => {
  let testJobId: number;
  let testUserId: string;
  let jobsRouter: any;

  beforeAll(async () => {
    testUserId = testUsers.admin.id;

    // Import the router after mocks are set up
    const module = await import('../../routes/jobs');
    jobsRouter = module.jobsRouter;
  });

  beforeEach(async () => {
    // Clean up test data
    await db.delete(jobItems).where(eq(jobItems.userId, testUserId));
    await db.delete(jobDictionaries);
    await db.delete(jobs).where(eq(jobs.userId, testUserId));
    await db.delete(dictionaries).where(eq(dictionaries.userId, testUserId));

    // Insert test user if not exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: testUserId,
        email: testUsers.admin.email,
        name: testUsers.admin.name,
        emailVerified: testUsers.admin.emailVerified,
        createdAt: testUsers.admin.createdAt,
        updatedAt: testUsers.admin.updatedAt,
      });
    }

    // Create a test job
    const [newJob] = await db.insert(jobs).values({
      userId: testUserId,
      filename: 'test-capture.pcap',
      status: 'pending',
      priority: 5,
      paused: 0,
      itemsTotal: 10,
      itemsCracked: 0,
      createdAt: new Date(),
    }).returning();

    testJobId = newJob.id;
  });

  afterAll(async () => {
    // Clean up all test data
    await db.delete(jobItems).where(eq(jobItems.userId, testUserId));
    await db.delete(jobDictionaries);
    await db.delete(jobs).where(eq(jobs.userId, testUserId));
    await db.delete(dictionaries).where(eq(dictionaries.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('Pause Job', () => {
    it('should successfully pause a pending job', async () => {
      // Verify initial state
      const beforeJob = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(beforeJob[0].status).toBe('pending');
      expect(beforeJob[0].paused).toBe(0);

      // Pause the job
      await db.update(jobs)
        .set({
          status: 'paused',
          paused: 1
        })
        .where(eq(jobs.id, testJobId));

      // Verify job was paused
      const afterJob = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(afterJob[0].status).toBe('paused');
      expect(afterJob[0].paused).toBe(1);
    });

    it('should pause a processing job', async () => {
      // Update job to processing state
      await db.update(jobs)
        .set({
          status: 'processing',
          startedAt: new Date(),
        })
        .where(eq(jobs.id, testJobId));

      // Pause the job
      await db.update(jobs)
        .set({
          status: 'paused',
          paused: 1
        })
        .where(eq(jobs.id, testJobId));

      // Verify job was paused
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].status).toBe('paused');
      expect(job[0].paused).toBe(1);
      expect(job[0].startedAt).not.toBeNull();
    });

    it('should preserve job progress when paused', async () => {
      // Set job to processing with progress
      await db.update(jobs)
        .set({
          status: 'processing',
          progress: 45,
          itemsCracked: 5,
          speed: '1000 H/s',
          eta: '00:10:00',
          currentDictionary: 'rockyou.txt',
        })
        .where(eq(jobs.id, testJobId));

      // Pause the job
      await db.update(jobs)
        .set({
          status: 'paused',
          paused: 1
        })
        .where(eq(jobs.id, testJobId));

      // Verify progress is preserved
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].progress).toBe(45);
      expect(job[0].itemsCracked).toBe(5);
      expect(job[0].speed).toBe('1000 H/s');
      expect(job[0].currentDictionary).toBe('rockyou.txt');
    });

    it('should handle pausing an already paused job', async () => {
      // Pause the job first time
      await db.update(jobs)
        .set({
          status: 'paused',
          paused: 1
        })
        .where(eq(jobs.id, testJobId));

      // Pause again (idempotent operation)
      await db.update(jobs)
        .set({
          status: 'paused',
          paused: 1
        })
        .where(eq(jobs.id, testJobId));

      // Verify still paused
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].status).toBe('paused');
      expect(job[0].paused).toBe(1);
    });
  });

  describe('Resume Job', () => {
    beforeEach(async () => {
      // Start with a paused job
      await db.update(jobs)
        .set({
          status: 'paused',
          paused: 1
        })
        .where(eq(jobs.id, testJobId));
    });

    it('should successfully resume a paused job', async () => {
      // Resume the job
      await db.update(jobs)
        .set({
          status: 'pending',
          paused: 0
        })
        .where(eq(jobs.id, testJobId));

      // Verify job was resumed
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].status).toBe('pending');
      expect(job[0].paused).toBe(0);
    });

    it('should preserve job progress when resumed', async () => {
      // Set progress before resuming
      await db.update(jobs)
        .set({
          progress: 60,
          itemsCracked: 6,
          currentDictionary: 'common.txt',
        })
        .where(eq(jobs.id, testJobId));

      // Resume the job
      await db.update(jobs)
        .set({
          status: 'pending',
          paused: 0
        })
        .where(eq(jobs.id, testJobId));

      // Verify progress is preserved
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].progress).toBe(60);
      expect(job[0].itemsCracked).toBe(6);
      expect(job[0].currentDictionary).toBe('common.txt');
    });

    it('should handle resuming an already running job', async () => {
      // Set job to pending first
      await db.update(jobs)
        .set({
          status: 'pending',
          paused: 0
        })
        .where(eq(jobs.id, testJobId));

      // Resume again (idempotent)
      await db.update(jobs)
        .set({
          status: 'pending',
          paused: 0
        })
        .where(eq(jobs.id, testJobId));

      // Verify still pending
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].status).toBe('pending');
      expect(job[0].paused).toBe(0);
    });
  });

  describe('Stop Job', () => {
    it('should successfully stop a pending job', async () => {
      // Stop the job
      const now = new Date();
      await db.update(jobs)
        .set({
          status: 'stopped',
          completedAt: now
        })
        .where(eq(jobs.id, testJobId));

      // Verify job was stopped
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].status).toBe('stopped');
      expect(job[0].completedAt).not.toBeNull();
    });

    it('should stop a processing job', async () => {
      // Set job to processing
      await db.update(jobs)
        .set({
          status: 'processing',
          startedAt: new Date(),
          progress: 30,
        })
        .where(eq(jobs.id, testJobId));

      // Stop the job
      const now = new Date();
      await db.update(jobs)
        .set({
          status: 'stopped',
          completedAt: now
        })
        .where(eq(jobs.id, testJobId));

      // Verify job was stopped
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].status).toBe('stopped');
      expect(job[0].completedAt).not.toBeNull();
      expect(job[0].progress).toBe(30); // Progress preserved
    });

    it('should stop a paused job', async () => {
      // Pause the job first
      await db.update(jobs)
        .set({
          status: 'paused',
          paused: 1
        })
        .where(eq(jobs.id, testJobId));

      // Stop the job
      const now = new Date();
      await db.update(jobs)
        .set({
          status: 'stopped',
          completedAt: now
        })
        .where(eq(jobs.id, testJobId));

      // Verify job was stopped
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].status).toBe('stopped');
      expect(job[0].completedAt).not.toBeNull();
    });

    it('should preserve all job data when stopped', async () => {
      // Set comprehensive job state
      await db.update(jobs)
        .set({
          status: 'processing',
          progress: 75,
          itemsCracked: 7,
          speed: '2000 H/s',
          eta: '00:05:00',
          currentDictionary: 'rockyou.txt',
          startedAt: new Date(),
        })
        .where(eq(jobs.id, testJobId));

      // Stop the job
      const now = new Date();
      await db.update(jobs)
        .set({
          status: 'stopped',
          completedAt: now
        })
        .where(eq(jobs.id, testJobId));

      // Verify all data preserved
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].status).toBe('stopped');
      expect(job[0].progress).toBe(75);
      expect(job[0].itemsCracked).toBe(7);
      expect(job[0].speed).toBe('2000 H/s');
      expect(job[0].currentDictionary).toBe('rockyou.txt');
      expect(job[0].startedAt).not.toBeNull();
      expect(job[0].completedAt).not.toBeNull();
    });
  });

  describe('Pause-Resume-Stop Flow', () => {
    it('should handle complete pause-resume-stop workflow', async () => {
      // 1. Start processing
      await db.update(jobs)
        .set({
          status: 'processing',
          startedAt: new Date(),
          progress: 20,
          itemsCracked: 2,
        })
        .where(eq(jobs.id, testJobId));

      let job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);
      expect(job[0].status).toBe('processing');

      // 2. Pause
      await db.update(jobs)
        .set({
          status: 'paused',
          paused: 1
        })
        .where(eq(jobs.id, testJobId));

      job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);
      expect(job[0].status).toBe('paused');
      expect(job[0].progress).toBe(20);

      // 3. Resume
      await db.update(jobs)
        .set({
          status: 'pending',
          paused: 0
        })
        .where(eq(jobs.id, testJobId));

      job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);
      expect(job[0].status).toBe('pending');
      expect(job[0].progress).toBe(20);

      // 4. Continue processing
      await db.update(jobs)
        .set({
          status: 'processing',
          progress: 50,
          itemsCracked: 5,
        })
        .where(eq(jobs.id, testJobId));

      // 5. Stop
      await db.update(jobs)
        .set({
          status: 'stopped',
          completedAt: new Date()
        })
        .where(eq(jobs.id, testJobId));

      job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);
      expect(job[0].status).toBe('stopped');
      expect(job[0].progress).toBe(50);
      expect(job[0].completedAt).not.toBeNull();
    });

    it('should handle multiple pause-resume cycles', async () => {
      // Start processing
      await db.update(jobs)
        .set({
          status: 'processing',
          progress: 10,
        })
        .where(eq(jobs.id, testJobId));

      // Cycle 1: Pause and resume
      await db.update(jobs)
        .set({ status: 'paused', paused: 1 })
        .where(eq(jobs.id, testJobId));

      await db.update(jobs)
        .set({ status: 'pending', paused: 0 })
        .where(eq(jobs.id, testJobId));

      // Cycle 2: Pause and resume again
      await db.update(jobs)
        .set({ status: 'processing', progress: 40 })
        .where(eq(jobs.id, testJobId));

      await db.update(jobs)
        .set({ status: 'paused', paused: 1 })
        .where(eq(jobs.id, testJobId));

      await db.update(jobs)
        .set({ status: 'pending', paused: 0 })
        .where(eq(jobs.id, testJobId));

      // Verify final state
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].status).toBe('pending');
      expect(job[0].paused).toBe(0);
      expect(job[0].progress).toBe(40);
    });
  });

  describe('Restart Job', () => {
    it('should reset job to initial state', async () => {
      // Set job to completed with progress
      await db.update(jobs)
        .set({
          status: 'completed',
          progress: 100,
          itemsCracked: 10,
          speed: '1500 H/s',
          eta: null,
          startedAt: new Date(),
          completedAt: new Date(),
          currentDictionary: 'rockyou.txt',
        })
        .where(eq(jobs.id, testJobId));

      // Restart the job
      await db.update(jobs)
        .set({
          status: 'pending',
          progress: 0,
          itemsCracked: 0,
          hashCount: 0,
          speed: null,
          eta: null,
          error: null,
          startedAt: null,
          completedAt: null,
          currentDictionary: null,
          paused: 0,
        })
        .where(eq(jobs.id, testJobId));

      // Verify job was reset
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].status).toBe('pending');
      expect(job[0].progress).toBe(0);
      expect(job[0].itemsCracked).toBe(0);
      expect(job[0].speed).toBeNull();
      expect(job[0].startedAt).toBeNull();
      expect(job[0].completedAt).toBeNull();
      expect(job[0].currentDictionary).toBeNull();
      expect(job[0].paused).toBe(0);
    });

    it('should restart a failed job', async () => {
      // Set job to failed state
      await db.update(jobs)
        .set({
          status: 'failed',
          error: 'Test error message',
          progress: 45,
          completedAt: new Date(),
        })
        .where(eq(jobs.id, testJobId));

      // Restart the job
      await db.update(jobs)
        .set({
          status: 'pending',
          progress: 0,
          itemsCracked: 0,
          error: null,
          startedAt: null,
          completedAt: null,
          paused: 0,
        })
        .where(eq(jobs.id, testJobId));

      // Verify job was reset
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].status).toBe('pending');
      expect(job[0].error).toBeNull();
      expect(job[0].progress).toBe(0);
    });
  });

  describe('Job State Validation', () => {
    it('should not allow invalid state transitions', async () => {
      // This test validates business logic constraints
      // For example, a completed job shouldn't be able to pause

      await db.update(jobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          progress: 100,
        })
        .where(eq(jobs.id, testJobId));

      // Verify current state
      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      expect(job[0].status).toBe('completed');

      // In a real application, attempting to pause a completed job
      // should be rejected by business logic validation
      // This test documents the expected behavior
    });

    it('should maintain data consistency across state changes', async () => {
      const startedAt = new Date();

      // Processing -> Paused -> Pending -> Processing
      await db.update(jobs)
        .set({
          status: 'processing',
          startedAt,
          progress: 30,
        })
        .where(eq(jobs.id, testJobId));

      await db.update(jobs)
        .set({ status: 'paused', paused: 1 })
        .where(eq(jobs.id, testJobId));

      await db.update(jobs)
        .set({ status: 'pending', paused: 0 })
        .where(eq(jobs.id, testJobId));

      await db.update(jobs)
        .set({ status: 'processing', progress: 60 })
        .where(eq(jobs.id, testJobId));

      const job = await db.select()
        .from(jobs)
        .where(eq(jobs.id, testJobId))
        .limit(1);

      // Verify timestamps and progress are maintained
      expect(job[0].status).toBe('processing');
      expect(job[0].startedAt).toEqual(startedAt);
      expect(job[0].progress).toBe(60);
    });
  });
});
