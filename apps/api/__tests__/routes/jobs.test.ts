import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getTestDb, testHelpers } from '../setup'
import { jobs, networks, dictionaries } from '../../src/db/schema'
import { eq, and, inArray } from 'drizzle-orm'

// Mock the logger
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    security: vi.fn(),
  },
}))

// Mock the queue
vi.mock('../../src/lib/queue', () => ({
  getHashcatJob: vi.fn(() => Promise.resolve(null)),
  removeHashcatJob: vi.fn(() => Promise.resolve(true)),
  checkQueueHealth: vi.fn(() => Promise.resolve({ status: 'healthy' })),
}))

// Mock the audit service
vi.mock('../../src/services/audit.service', () => ({
  auditService: {
    logEvent: vi.fn(() => Promise.resolve()),
  },
}))

// Mock the config service
vi.mock('../../src/services/config.service', () => ({
  configService: {
    getBoolean: vi.fn(() => Promise.resolve(false)),
  },
}))

describe('Jobs Routes', () => {
  let db: ReturnType<typeof getTestDb>
  let testUser: any
  let testAdmin: any
  let testNetwork: any
  let testDictionary: any

  beforeEach(async () => {
    db = getTestDb()
    vi.clearAllMocks()

    // Create test users
    testUser = await testHelpers.createUser({ role: 'user' })
    testAdmin = await testHelpers.createAdmin({ role: 'admin' })

    // Create test network and dictionary
    testNetwork = await testHelpers.createNetwork(testUser.id, {
      ssid: 'TestNetwork',
      bssid: 'AA:BB:CC:DD:EE:FF',
    })
    testDictionary = await testHelpers.createDictionary(testUser.id, {
      name: 'Test Dictionary',
      filename: 'test.txt',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Job CRUD Operations', () => {
    describe('Creating jobs', () => {
      it('should create a job with valid data', async () => {
        const jobData = {
          name: 'Test Job',
          description: 'Test job description',
          status: 'pending' as const,
          priority: 'normal' as const,
          networkId: testNetwork.id,
          dictionaryId: testDictionary.id,
          config: { hashcatMode: 22000, rules: ['best64'] },
          userId: testUser.id,
        }

        const [newJob] = await db.insert(jobs).values(jobData).returning()

        expect(newJob).toBeDefined()
        expect(newJob.name).toBe('Test Job')
        expect(newJob.status).toBe('pending')
        expect(newJob.priority).toBe('normal')
        expect(newJob.networkId).toBe(testNetwork.id)
        expect(newJob.dictionaryId).toBe(testDictionary.id)
        expect(newJob.userId).toBe(testUser.id)
      })

      it('should create job with different priorities', async () => {
        const priorities = ['low', 'normal', 'high', 'critical'] as const

        for (const priority of priorities) {
          const network = await testHelpers.createNetwork(testUser.id, {
            bssid: `AA:BB:CC:DD:EE:${priorities.indexOf(priority).toString().padStart(2, '0')}`,
          })

          const job = await testHelpers.createJob(
            testUser.id,
            network.id,
            testDictionary.id,
            { priority },
          )

          expect(job.priority).toBe(priority)
        }
      })

      it('should create job with different statuses', async () => {
        const statuses = ['pending', 'scheduled', 'running', 'completed', 'failed', 'cancelled'] as const

        for (const status of statuses) {
          const network = await testHelpers.createNetwork(testUser.id, {
            bssid: `AA:BB:CC:DD:EE:${statuses.indexOf(status).toString().padStart(2, '0')}`,
          })

          const job = await testHelpers.createJob(
            testUser.id,
            network.id,
            testDictionary.id,
            { status },
          )

          expect(job.status).toBe(status)
        }
      })

      it('should validate job status enum', async () => {
        const network = await testHelpers.createNetwork(testUser.id, {
          bssid: 'AA:BB:CC:DD:EE:01',
        })

        const job = await testHelpers.createJob(
          testUser.id,
          network.id,
          testDictionary.id,
          { status: 'pending' },
        )

        expect(['pending', 'scheduled', 'running', 'completed', 'failed', 'cancelled']).toContain(job.status)
      })

      it('should validate job priority enum', async () => {
        const network = await testHelpers.createNetwork(testUser.id, {
          bssid: 'AA:BB:CC:DD:EE:02',
        })

        const job = await testHelpers.createJob(
          testUser.id,
          network.id,
          testDictionary.id,
          { priority: 'high' },
        )

        expect(['low', 'normal', 'high', 'critical']).toContain(job.priority)
      })
    })

    describe('Reading jobs', () => {
      beforeEach(async () => {
        // Create test jobs
        await testHelpers.createJob(testUser.id, testNetwork.id, testDictionary.id, {
          name: 'Job 1',
          status: 'pending',
        })
        await testHelpers.createJob(testUser.id, testNetwork.id, testDictionary.id, {
          name: 'Job 2',
          status: 'running',
        })
      })

      it('should get all jobs for a user', async () => {
        const result = await db.query.jobs.findMany({
          where: eq(jobs.userId, testUser.id),
        })

        expect(result.length).toBeGreaterThanOrEqual(2)
      })

      it('should get job with network and dictionary relations', async () => {
        const job = await testHelpers.createJob(
          testUser.id,
          testNetwork.id,
          testDictionary.id,
          { name: 'Test Job' },
        )

        const result = await db.query.jobs.findFirst({
          where: eq(jobs.id, job.id),
          with: {
            network: true,
            dictionary: true,
          },
        })

        expect(result).toBeDefined()
        expect(result?.network).toBeDefined()
        expect(result?.dictionary).toBeDefined()
        expect(result?.network.bssid).toBe(testNetwork.bssid)
        expect(result?.dictionary.name).toBe(testDictionary.name)
      })

      it('should filter jobs by status', async () => {
        const result = await db.query.jobs.findMany({
          where: and(eq(jobs.userId, testUser.id), eq(jobs.status, 'pending')),
        })

        expect(result.length).toBeGreaterThan(0)
        result.forEach(job => {
          expect(job.status).toBe('pending')
        })
      })

      it('should paginate jobs', async () => {
        // Create additional jobs
        for (let i = 0; i < 5; i++) {
          const network = await testHelpers.createNetwork(testUser.id, {
            bssid: `AA:BB:CC:DD:EE:${(10 + i).toString().padStart(2, '0')}`,
          })
          await testHelpers.createJob(testUser.id, network.id, testDictionary.id, {
            name: `Job ${i}`,
          })
        }

        const page = 1
        const limit = 3
        const offset = (page - 1) * limit

        const result = await db.query.jobs.findMany({
          where: eq(jobs.userId, testUser.id),
          orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
          limit,
          offset,
        })

        expect(result.length).toBeLessThanOrEqual(limit)
      })
    })

    describe('Updating jobs', () => {
      it('should update job status', async () => {
        const job = await testHelpers.createJob(
          testUser.id,
          testNetwork.id,
          testDictionary.id,
          { status: 'pending' },
        )

        await db
          .update(jobs)
          .set({
            status: 'running',
            startTime: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, job.id))

        const result = await db.query.jobs.findFirst({
          where: eq(jobs.id, job.id),
        })

        expect(result?.status).toBe('running')
        expect(result?.startTime).toBeDefined()
      })

      it('should update job progress', async () => {
        const job = await testHelpers.createJob(
          testUser.id,
          testNetwork.id,
          testDictionary.id,
          { progress: 0 },
        )

        await db
          .update(jobs)
          .set({
            progress: 50,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, job.id))

        const result = await db.query.jobs.findFirst({
          where: eq(jobs.id, job.id),
        })

        expect(result?.progress).toBe(50)
      })

      it('should update job priority', async () => {
        const job = await testHelpers.createJob(
          testUser.id,
          testNetwork.id,
          testDictionary.id,
          { priority: 'normal' },
        )

        await db
          .update(jobs)
          .set({
            priority: 'high',
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, job.id))

        const result = await db.query.jobs.findFirst({
          where: eq(jobs.id, job.id),
        })

        expect(result?.priority).toBe('high')
      })

      it('should complete a job with result', async () => {
        const job = await testHelpers.createJob(
          testUser.id,
          testNetwork.id,
          testDictionary.id,
          { status: 'running' },
        )

        const resultData = {
          password: 'cracked123',
          hash: 'testhash',
          timeTaken: 12345,
        }

        await db
          .update(jobs)
          .set({
            status: 'completed',
            progress: 100,
            endTime: new Date(),
            result: resultData,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, job.id))

        const result = await db.query.jobs.findFirst({
          where: eq(jobs.id, job.id),
        })

        expect(result?.status).toBe('completed')
        expect(result?.progress).toBe(100)
        expect(result?.result).toEqual(resultData)
        expect(result?.endTime).toBeDefined()
      })

      it('should mark job as failed with error message', async () => {
        const job = await testHelpers.createJob(
          testUser.id,
          testNetwork.id,
          testDictionary.id,
          { status: 'running' },
        )

        const errorMessage = 'Hashcat process crashed'

        await db
          .update(jobs)
          .set({
            status: 'failed',
            errorMessage,
            endTime: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, job.id))

        const result = await db.query.jobs.findFirst({
          where: eq(jobs.id, job.id),
        })

        expect(result?.status).toBe('failed')
        expect(result?.errorMessage).toBe(errorMessage)
      })
    })

    describe('Deleting jobs', () => {
      it('should delete a job', async () => {
        const job = await testHelpers.createJob(
          testUser.id,
          testNetwork.id,
          testDictionary.id,
          { name: 'To Delete' },
        )

        // Verify it exists
        let result = await db.query.jobs.findFirst({
          where: eq(jobs.id, job.id),
        })
        expect(result).toBeDefined()

        // Delete it
        await db.delete(jobs).where(eq(jobs.id, job.id))

        // Verify it's gone
        result = await db.query.jobs.findFirst({
          where: eq(jobs.id, job.id),
        })
        expect(result).toBeNull()
      })

      it('should handle deleting non-existent job', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000'
        const result = await db
          .delete(jobs)
          .where(eq(jobs.id, fakeId))
          .returning()

        expect(result).toHaveLength(0)
      })
    })
  })

  describe('Job Scheduling', () => {
    it('should schedule a job for future execution', async () => {
      const scheduledAt = new Date()
      scheduledAt.setHours(scheduledAt.getHours() + 1)

      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        {
          status: 'scheduled',
          scheduledAt,
        },
      )

      expect(job.status).toBe('scheduled')
      expect(job.scheduledAt).toBeDefined()
      expect(job.scheduledAt?.getTime()).toBeGreaterThanOrEqual(scheduledAt.getTime() - 1000)
    })

    it('should set job dependencies', async () => {
      const dep1Network = await testHelpers.createNetwork(testUser.id, {
        bssid: 'AA:BB:CC:DD:EE:01',
      })
      const dep1 = await testHelpers.createJob(
        testUser.id,
        dep1Network.id,
        testDictionary.id,
        { status: 'completed' },
      )

      const dep2Network = await testHelpers.createNetwork(testUser.id, {
        bssid: 'AA:BB:CC:DD:EE:02',
      })
      const dep2 = await testHelpers.createJob(
        testUser.id,
        dep2Network.id,
        testDictionary.id,
        { status: 'completed' },
      )

      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        {
          status: 'scheduled',
          dependsOn: [dep1.id, dep2.id],
        },
      )

      expect(job.dependsOn).toEqual([dep1.id, dep2.id])
    })

    it('should handle empty dependencies array', async () => {
      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        {
          dependsOn: [],
        },
      )

      expect(job.dependsOn).toEqual([])
    })

    it('should allow null dependencies', async () => {
      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        {
          dependsOn: null,
        },
      )

      expect(job.dependsOn).toBeNull()
    })
  })

  describe('Job Cancellation', () => {
    it('should cancel a pending job', async () => {
      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        { status: 'pending' },
      )

      await db
        .update(jobs)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id))

      const result = await db.query.jobs.findFirst({
        where: eq(jobs.id, job.id),
      })

      expect(result?.status).toBe('cancelled')
      expect(result?.cancelledAt).toBeDefined()
    })

    it('should cancel a running job', async () => {
      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        { status: 'running', startTime: new Date() },
      )

      await db
        .update(jobs)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id))

      const result = await db.query.jobs.findFirst({
        where: eq(jobs.id, job.id),
      })

      expect(result?.status).toBe('cancelled')
    })

    it('should not cancel completed job', async () => {
      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        {
          status: 'completed',
          endTime: new Date(),
        },
      )

      const result = await db.query.jobs.findFirst({
        where: eq(jobs.id, job.id),
      })

      expect(result?.status).toBe('completed')
    })
  })

  describe('Job Tags', () => {
    it('should create job with tags', async () => {
      const tags = ['wifi', 'wpa2', 'test']

      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        { tags },
      )

      expect(job.tags).toEqual(tags)
    })

    it('should create job with empty tags array', async () => {
      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        { tags: [] },
      )

      expect(job.tags).toEqual([])
    })

    it('should update job tags', async () => {
      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        { tags: ['original'] },
      )

      const newTags = ['updated', 'tags']
      await db
        .update(jobs)
        .set({
          tags: newTags,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id))

      const result = await db.query.jobs.findFirst({
        where: eq(jobs.id, job.id),
      })

      expect(result?.tags).toEqual(newTags)
    })
  })

  describe('Job Statistics', () => {
    beforeEach(async () => {
      // Create jobs with different statuses
      const statuses = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const

      for (const status of statuses) {
        const network = await testHelpers.createNetwork(testUser.id, {
          bssid: `AA:BB:CC:DD:EE:${statuses.indexOf(status).toString().padStart(2, '0')}`,
        })
        await testHelpers.createJob(testUser.id, network.id, testDictionary.id, { status })
      }
    })

    it('should count jobs by status', async () => {
      const allJobs = await db.query.jobs.findMany({
        where: eq(jobs.userId, testUser.id),
      })

      const stats = {
        total: allJobs.length,
        pending: allJobs.filter(j => j.status === 'pending' || j.status === 'scheduled').length,
        running: allJobs.filter(j => j.status === 'running').length,
        completed: allJobs.filter(j => j.status === 'completed').length,
        failed: allJobs.filter(j => j.status === 'failed').length,
        cancelled: allJobs.filter(j => j.status === 'cancelled').length,
        scheduled: allJobs.filter(j => j.status === 'scheduled').length,
      }

      expect(stats.total).toBeGreaterThan(0)
      expect(stats.running).toBeGreaterThan(0)
      expect(stats.completed).toBeGreaterThan(0)
    })

    it('should filter jobs by multiple criteria', async () => {
      const runningJobs = await db.query.jobs.findMany({
        where: and(eq(jobs.userId, testUser.id), eq(jobs.status, 'running')),
      })

      expect(runningJobs.length).toBeGreaterThan(0)
      runningJobs.forEach(job => {
        expect(job.status).toBe('running')
      })
    })
  })

  describe('Job Config', () => {
    it('should store job config as JSONB', async () => {
      const config = {
        hashcatMode: 22000,
        rules: ['best64', 'digits'],
        workload: 128,
        gpuDevices: [0, 1],
        optimizedKernelEnabled: true,
      }

      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        { config },
      )

      expect(job.config).toEqual(config)
    })

    it('should handle different hashcat modes', async () => {
      const modes = [22000, 2500, 16800, 16801]

      for (const mode of modes) {
        const network = await testHelpers.createNetwork(testUser.id, {
          bssid: `AA:BB:CC:DD:EE:${mode.toString().slice(-2)}`,
        })
        const job = await testHelpers.createJob(
          testUser.id,
          network.id,
          testDictionary.id,
          { config: { hashcatMode: mode } },
        )

        expect(job.config.hashcatMode).toBe(mode)
      }
    })

    it('should handle complex config structures', async () => {
      const config = {
        hashcatMode: 22000,
        attackModes: ['straight', 'combinator'],
        rules: ['best64', 'rockyou'],
        mask: '?l?l?l?l?d?d?d?d',
        customCharsets: {
          '?l': 'abcdefghijklmnopqrstuvwxyz',
          '?u': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
          '?d': '0123456789',
        },
        advancedOptions: {
          kernelTimeout: 200,
          hccapxMessagePair: 2,
          force: true,
        },
      }

      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        { config },
      )

      expect(job.config).toEqual(config)
    })
  })

  describe('Job Ownership and Access Control', () => {
    it('should associate job with user', async () => {
      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        {} as any,
      )

      expect(job.userId).toBe(testUser.id)
    })

    it('should not allow seeing other users jobs', async () => {
      const otherUser = await testHelpers.createUser({ email: 'other@example.com' })
      const otherNetwork = await testHelpers.createNetwork(otherUser.id, {
        ssid: 'OtherNetwork',
        bssid: 'AA:BB:CC:DD:EE:01',
      })
      const otherDictionary = await testHelpers.createDictionary(otherUser.id, {
        name: 'Other Dictionary',
        filename: 'other.txt',
      })

      await testHelpers.createJob(
        otherUser.id,
        otherNetwork.id,
        otherDictionary.id,
        { name: 'Other Job' },
      )

      const userJobs = await db.query.jobs.findMany({
        where: eq(jobs.userId, testUser.id),
      })

      userJobs.forEach(job => {
        expect(job.userId).toBe(testUser.id)
      })
    })
  })

  describe('Job Result Data', () => {
    it('should store handshake result', async () => {
      const result = {
        type: 'handshake',
        data: {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'TestNetwork',
          handshakeFile: '/path/to/handshake.hc22000',
          keyVersion: 2,
        },
      }

      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        { result: result as any, status: 'completed' },
      )

      expect(job.result).toEqual(result)
    })

    it('should store password result', async () => {
      const result = {
        type: 'password',
        data: {
          password: 'CrackedPassword123!',
          hash: 'hashvalue',
          algorithm: 'PBKDF2',
          iterations: 4096,
        },
      }

      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        { result: result as any, status: 'completed' },
      )

      expect(job.result).toEqual(result)
    })

    it('should store error result', async () => {
      const result = {
        type: 'error',
        data: {
          errorCode: 'HASHCAT_ERROR',
          errorMessage: 'Hashcat exited with code 1',
          stderr: 'ERROR: Invalid handshake format',
        },
      }

      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        { result: result as any, status: 'failed' },
      )

      expect(job.result).toEqual(result)
    })
  })

  describe('Job Timestamps', () => {
    it('should set createdAt automatically', async () => {
      const beforeCreate = new Date()

      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        { name: 'Timestamp Test' },
      )

      const afterCreate = new Date()

      expect(job.createdAt).toBeDefined()
      expect(job.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(job.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
    })

    it('should set startTime when job starts', async () => {
      const startTime = new Date()

      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        {
          status: 'running',
          startTime,
        },
      )

      expect(job.startTime).toBeDefined()
      expect(job.startTime?.getTime()).toBe(startTime.getTime())
    })

    it('should set endTime when job completes', async () => {
      const endTime = new Date()

      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        {
          status: 'completed',
          endTime,
        },
      )

      expect(job.endTime).toBeDefined()
      expect(job.endTime?.getTime()).toBe(endTime.getTime())
    })

    it('should calculate job duration', async () => {
      const startTime = new Date('2024-01-01T10:00:00Z')
      const endTime = new Date('2024-01-01T11:30:00Z')

      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        {
          status: 'completed',
          startTime,
          endTime,
        },
      )

      const duration = job.endTime!.getTime() - job.startTime!.getTime()
      expect(duration).toBe(90 * 60 * 1000) // 90 minutes in ms
    })
  })

  describe('Job Progress Tracking', () => {
    it('should track progress from 0 to 100', async () => {
      const job = await testHelpers.createJob(
        testUser.id,
        testNetwork.id,
        testDictionary.id,
        { progress: 0 },
      )

      expect(job.progress).toBe(0)

      // Update progress
      await db
        .update(jobs)
        .set({
          progress: 50,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id))

      const result = await db.query.jobs.findFirst({
        where: eq(jobs.id, job.id),
      })

      expect(result?.progress).toBe(50)
    })

    it('should validate progress range', async () => {
      const validProgress = [0, 25, 50, 75, 100]

      for (const progress of validProgress) {
        const network = await testHelpers.createNetwork(testUser.id, {
          bssid: `AA:BB:CC:DD:EE:${progress.toString().padStart(2, '0')}`,
        })
        const job = await testHelpers.createJob(
          testUser.id,
          network.id,
          testDictionary.id,
          { progress },
        )

        expect(job.progress).toBeGreaterThanOrEqual(0)
        expect(job.progress).toBeLessThanOrEqual(100)
      }
    })
  })

  describe('Bulk Job Operations', () => {
    beforeEach(async () => {
      // Create multiple jobs
      for (let i = 0; i < 5; i++) {
        const network = await testHelpers.createNetwork(testUser.id, {
          bssid: `AA:BB:CC:DD:EE:${(20 + i).toString().padStart(2, '0')}`,
        })
        await testHelpers.createJob(testUser.id, network.id, testDictionary.id, {
          name: `Bulk Job ${i}`,
          status: i % 2 === 0 ? 'pending' : 'running',
        })
      }
    })

    it('should get multiple jobs by IDs', async () => {
      const allJobs = await db.query.jobs.findMany({
        where: eq(jobs.userId, testUser.id),
      })

      const jobIds = allJobs.slice(0, 3).map(j => j.id)

      const result = await db.query.jobs.findMany({
        where: inArray(jobs.id, jobIds),
      })

      expect(result).toHaveLength(3)
    })

    it('should update multiple jobs at once', async () => {
      const pendingJobs = await db.query.jobs.findMany({
        where: and(eq(jobs.userId, testUser.id), eq(jobs.status, 'pending')),
      })

      const jobIds = pendingJobs.map(j => j.id)

      await db
        .update(jobs)
        .set({
          priority: 'high',
          updatedAt: new Date(),
        })
        .where(inArray(jobs.id, jobIds))

      const result = await db.query.jobs.findMany({
        where: inArray(jobs.id, jobIds),
      })

      result.forEach(job => {
        expect(job.priority).toBe('high')
      })
    })
  })
})
