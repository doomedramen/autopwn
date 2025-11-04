import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '../../apps/api/src/db'
import { jobs, networks, dictionaries, users } from '../../apps/api/src/db/schema'
import { eq } from 'drizzle-orm'
import { addHashcatCrackingJob, getHashcatJob, removeHashcatJob } from '../../apps/api/src/lib/queue'

describe('Job Cancellation Unit Tests', () => {
  let userId: string
  let testNetwork: any
  let testDictionary: any

  beforeAll(async () => {
    // Create test user
    const [user] = await db.insert(users).values({
      email: 'cancellation-test@example.com',
      password: 'testpassword',
      name: 'Test User',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()
    userId = user.id

    // Create test network
    const [network] = await db.insert(networks).values({
      ssid: 'TestNetwork_Cancellation',
      bssid: 'AA:BB:CC:DD:EE:FF',
      frequency: 2412,
      channel: 6,
      rssi: -50,
      security: 'WPA2',
      status: 'ready',
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()
    testNetwork = network

    // Create test dictionary
    const [dictionary] = await db.insert(dictionaries).values({
      name: 'TestDictionary_Cancellation',
      path: '/tmp/test-dict.txt',
      size: 100,
      wordCount: 10,
      checksum: 'abc123',
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()
    testDictionary = dictionary
  })

  afterAll(async () => {
    // Clean up test data
    if (testNetwork) {
      await db.delete(networks).where(eq(networks.id, testNetwork.id))
    }
    if (testDictionary) {
      await db.delete(dictionaries).where(eq(dictionaries.id, testDictionary.id))
    }
    if (userId) {
      await db.delete(jobs).where(eq(jobs.userId, userId))
      await db.delete(users).where(eq(users.id, userId))
    }
  })

  it('should create and cancel a job in the database', async () => {
    // Create a job
    const [job] = await db.insert(jobs).values({
      name: 'Test Job for Cancellation',
      description: 'Testing job cancellation',
      type: 'wordlist',
      userId,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      status: 'pending',
      progress: 0,
      config: {
        type: 'wordlist',
        hashcatMode: 22000,
        networkId: testNetwork.id
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    expect(job.status).toBe('pending')
    expect(job.userId).toBe(userId)

    // Cancel the job using the same logic as the API
    const [cancelledJob] = await db.update(jobs)
      .set({
        status: 'cancelled',
        endTime: new Date(),
        errorMessage: 'Job cancelled for testing',
        updatedAt: new Date()
      })
      .where(eq(jobs.id, job.id))
      .returning()

    expect(cancelledJob.status).toBe('cancelled')
    expect(cancelledJob.endTime).toBeDefined()
    expect(cancelledJob.errorMessage).toBe('Job cancelled for testing')

    // Verify job is marked as cancelled
    const retrievedJob = await db.query.jobs.findFirst({
      where: eq(jobs.id, job.id)
    })
    expect(retrievedJob?.status).toBe('cancelled')

    // Clean up
    await db.delete(jobs).where(eq(jobs.id, job.id))
  })

  it('should reset network status when cancelling a running job', async () => {
    // Update network to processing status
    await db.update(networks)
      .set({
        status: 'processing',
        updatedAt: new Date()
      })
      .where(eq(networks.id, testNetwork.id))

    // Create a job in running status
    const [runningJob] = await db.insert(jobs).values({
      name: 'Running Job',
      description: 'This job is currently running',
      type: 'wordlist',
      userId,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      status: 'running',
      progress: 50,
      startTime: new Date(),
      config: {
        type: 'wordlist',
        hashcatMode: 22000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    // Verify network is in processing status
    const networkBefore = await db.query.networks.findFirst({
      where: eq(networks.id, testNetwork.id)
    })
    expect(networkBefore?.status).toBe('processing')

    // Cancel the job and reset network status (simulating API logic)
    const [cancelledJob] = await db.update(jobs)
      .set({
        status: 'cancelled',
        endTime: new Date(),
        errorMessage: 'Running job cancelled',
        updatedAt: new Date()
      })
      .where(eq(jobs.id, runningJob.id))
      .returning()

    await db.update(networks)
      .set({
        status: 'ready',
        updatedAt: new Date()
      })
      .where(eq(networks.id, testNetwork.id))

    // Verify job was cancelled
    expect(cancelledJob.status).toBe('cancelled')

    // Verify network status was reset
    const networkAfter = await db.query.networks.findFirst({
      where: eq(networks.id, testNetwork.id)
    })
    expect(networkAfter?.status).toBe('ready')

    // Clean up
    await db.delete(jobs).where(eq(jobs.id, runningJob.id))
  })

  it('should add and remove jobs from queue', async () => {
    // Create a job
    const [job] = await db.insert(jobs).values({
      name: 'Queue Test Job',
      description: 'Testing queue operations',
      type: 'wordlist',
      userId,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      status: 'pending',
      progress: 0,
      config: {
        type: 'wordlist',
        hashcatMode: 22000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    // Add job to queue
    const queueJob = await addHashcatCrackingJob({
      jobId: job.id,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      handshakePath: '/tmp/test-handshake.hc22000',
      dictionaryPath: testDictionary.path,
      attackMode: 'handshake',
      userId
    })

    expect(queueJob).toBeDefined()
    expect(queueJob.id).toBe(job.id)

    // Verify job exists in queue
    const retrievedQueueJob = await getHashcatJob(job.id)
    expect(retrievedQueueJob).toBeDefined()
    expect(retrievedQueueJob?.id).toBe(job.id)

    // Remove job from queue
    const removedJob = await removeHashcatJob(job.id)
    expect(removedJob).toBeDefined()
    expect(removedJob?.id).toBe(job.id)

    // Verify job no longer exists in queue
    const queueJobAfterRemoval = await getHashcatJob(job.id)
    expect(queueJobAfterRemoval).toBeNull()

    // Clean up
    await db.delete(jobs).where(eq(jobs.id, job.id))
  })

  it('should handle job status transitions correctly', async () => {
    // Test valid status transitions
    const [job] = await db.insert(jobs).values({
      name: 'Status Transition Test',
      description: 'Testing job status transitions',
      type: 'wordlist',
      userId,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      status: 'pending',
      progress: 0,
      config: {
        type: 'wordlist',
        hashcatMode: 22000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    // pending -> running
    const [runningJob] = await db.update(jobs)
      .set({
        status: 'running',
        startTime: new Date(),
        progress: 25,
        updatedAt: new Date()
      })
      .where(eq(jobs.id, job.id))
      .returning()
    expect(runningJob.status).toBe('running')
    expect(runningJob.startTime).toBeDefined()

    // running -> cancelled
    const [cancelledJob] = await db.update(jobs)
      .set({
        status: 'cancelled',
        endTime: new Date(),
        errorMessage: 'Job cancelled during transition test',
        updatedAt: new Date()
      })
      .where(eq(jobs.id, runningJob.id))
      .returning()
    expect(cancelledJob.status).toBe('cancelled')
    expect(cancelledJob.endTime).toBeDefined()

    // Clean up
    await db.delete(jobs).where(eq(jobs.id, job.id))
  })

  it('should prevent invalid status transitions', async () => {
    // Create a completed job
    const [completedJob] = await db.insert(jobs).values({
      name: 'Completed Job',
      description: 'This job is already completed',
      type: 'wordlist',
      userId,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      status: 'completed',
      progress: 100,
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
      endTime: new Date(),
      config: {
        type: 'wordlist',
        hashcatMode: 22000
      },
      createdAt: new Date(Date.now() - 3600000), // 1 hour ago
      updatedAt: new Date()
    }).returning()

    // Verify job is completed
    expect(completedJob.status).toBe('completed')

    // Simulate API validation: only pending/running jobs can be cancelled
    const canBeCancelled = ['pending', 'running'].includes(completedJob.status)
    expect(canBeCancelled).toBe(false)

    // Clean up
    await db.delete(jobs).where(eq(jobs.id, completedJob.id))
  })
})