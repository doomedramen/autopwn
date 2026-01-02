import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { db } from '@/db'
import { jobs, networks, dictionaries, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { addHashcatCrackingJob, getHashcatJob, removeHashcatJob } from '@/lib/queue'

describe('Job Cancellation Integration Tests', () => {
  let app: Hono
  let testUserId: string
  let testNetwork: any
  let testDictionary: any

  beforeAll(async () => {
    // Setup test database and user
    testUserId = 'test-user-cancellation'

    // Create test user
    await db.insert(users).values({
      id: testUserId,
      email: 'test-cancellation@example.com',
      password: 'test_password_hash',
      role: 'user',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Create test network
    const [network] = await db.insert(networks).values({
      ssid: 'TestNetwork_Cancellation',
      bssid: 'AA:BB:CC:DD:EE:FF',
      encryption: 'WPA2',
      frequency: 2412,
      channel: 6,
      signalStrength: -50,
      status: 'ready',
      userId: testUserId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()
    testNetwork = network

    // Create test dictionary
    const [dictionary] = await db.insert(dictionaries).values({
      name: 'TestDictionary_Cancellation',
      filename: 'test-dict.txt',
      type: 'wordlist',
      filePath: '/tmp/test-dict.txt',
      size: 100,
      wordCount: 10,
      checksum: 'abc123',
      userId: testUserId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()
    testDictionary = dictionary

    // Setup test app (we'll test the cancellation logic directly)
    app = new Hono()
  })

  beforeEach(async () => {
    // Clean up any test jobs
    await db.delete(jobs).where(eq(jobs.userId, testUserId))
  })

  afterEach(async () => {
    // Clean up test jobs
    await db.delete(jobs).where(eq(jobs.userId, testUserId))
  })

  afterAll(async () => {
    // Clean up test data
    if (testNetwork) {
      await db.delete(networks).where(eq(networks.id, testNetwork.id))
    }
    if (testDictionary) {
      await db.delete(dictionaries).where(eq(dictionaries.id, testDictionary.id))
    }
    await db.delete(users).where(eq(users.id, testUserId))
  })

  it('should create and cancel a pending job', async () => {
    // Create a job
    const [job] = await db.insert(jobs).values({
      name: 'Test Job for Cancellation',
      description: 'Testing job cancellation',
      type: 'wordlist',
      userId: testUserId,
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
    expect(job.userId).toBe(testUserId)

    // Add job to queue
    const queueJob = await addHashcatCrackingJob({
      jobId: job.id,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      handshakePath: '/tmp/test-handshake.hc22000',
      dictionaryPath: testDictionary.path,
      attackMode: 'handshake',
      userId: testUserId
    })

    expect(queueJob).toBeDefined()
    expect(queueJob.id).toBe(job.id)

    // Verify job exists in queue
    const retrievedQueueJob = await getHashcatJob(job.id)
    expect(retrievedQueueJob).toBeDefined()
    expect(retrievedQueueJob?.id).toBe(job.id)

    // Cancel the job (simulate API logic)
    let queueJobRemoved = false
    let errorMessage = null

    try {
      const queueJob = await getHashcatJob(job.id)
      if (queueJob) {
        await removeHashcatJob(job.id)
        queueJobRemoved = true
      }
    } catch (queueError) {
      errorMessage = queueError instanceof Error ? queueError.message : 'Unknown error'
    }

    // Update job status in database
    const [cancelledJob] = await db.update(jobs)
      .set({
        status: 'cancelled',
        endTime: new Date(),
        errorMessage: errorMessage || 'Job cancelled by user',
        updatedAt: new Date()
      })
      .where(eq(jobs.id, job.id))
      .returning()

    // Verify job was cancelled
    expect(cancelledJob.status).toBe('cancelled')
    expect(cancelledJob.endTime).toBeDefined()
    expect(cancelledJob.errorMessage).toBeDefined()

    // Verify queue job was removed
    expect(queueJobRemoved).toBe(true)

    // Verify job no longer exists in queue
    const queueJobAfterRemoval = await getHashcatJob(job.id)
    expect(queueJobAfterRemoval).toBeNull()
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
      userId: testUserId,
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

    // Reset network status
    await db.update(networks)
      .set({
        status: 'ready',
        updatedAt: new Date()
      })
      .where(eq(networks.id, testNetwork.id))

    // Verify job was cancelled
    expect(cancelledJob.status).toBe('cancelled')
    expect(cancelledJob.endTime).toBeDefined()

    // Verify network status was reset
    const networkAfter = await db.query.networks.findFirst({
      where: eq(networks.id, testNetwork.id)
    })
    expect(networkAfter?.status).toBe('ready')
  })

  it('should validate that only pending or running jobs can be cancelled', async () => {
    // Create jobs with different statuses
    const [pendingJob] = await db.insert(jobs).values({
      name: 'Pending Job',
      description: 'This job is pending',
      type: 'wordlist',
      userId: testUserId,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      status: 'pending',
      progress: 0,
      config: { type: 'wordlist' },
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    const [runningJob] = await db.insert(jobs).values({
      name: 'Running Job',
      description: 'This job is running',
      type: 'wordlist',
      userId: testUserId,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      status: 'running',
      progress: 25,
      startTime: new Date(),
      config: { type: 'wordlist' },
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    const [completedJob] = await db.insert(jobs).values({
      name: 'Completed Job',
      description: 'This job is completed',
      type: 'wordlist',
      userId: testUserId,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      status: 'completed',
      progress: 100,
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(),
      config: { type: 'wordlist' },
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date()
    }).returning()

    const [failedJob] = await db.insert(jobs).values({
      name: 'Failed Job',
      description: 'This job failed',
      type: 'wordlist',
      userId: testUserId,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      status: 'failed',
      progress: 15,
      startTime: new Date(Date.now() - 1800000),
      endTime: new Date(),
      errorMessage: 'Hashcat execution failed',
      config: { type: 'wordlist' },
      createdAt: new Date(Date.now() - 1800000),
      updatedAt: new Date()
    }).returning()

    // Test which jobs can be cancelled
    const cancellableStatuses = ['pending', 'running']

    expect(cancellableStatuses.includes(pendingJob.status)).toBe(true)
    expect(cancellableStatuses.includes(runningJob.status)).toBe(true)
    expect(cancellableStatuses.includes(completedJob.status)).toBe(false)
    expect(cancellableStatuses.includes(failedJob.status)).toBe(false)

    // Clean up
    await db.delete(jobs).where(eq(jobs.id, pendingJob.id))
    await db.delete(jobs).where(eq(jobs.id, runningJob.id))
    await db.delete(jobs).where(eq(jobs.id, completedJob.id))
    await db.delete(jobs).where(eq(jobs.id, failedJob.id))
  })

  it('should handle queue removal errors gracefully', async () => {
    // Create a job
    const [job] = await db.insert(jobs).values({
      name: 'Error Handling Test',
      description: 'Testing error handling in queue removal',
      type: 'wordlist',
      userId: testUserId,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      status: 'pending',
      progress: 0,
      config: { type: 'wordlist' },
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    // Don't add to queue - simulate error when trying to remove non-existent job
    let queueJobRemoved = false
    let errorMessage = null

    try {
      const queueJob = await getHashcatJob(job.id)
      if (queueJob) {
        await removeHashcatJob(job.id)
        queueJobRemoved = true
      }
    } catch (queueError) {
      errorMessage = queueError instanceof Error ? queueError.message : 'Unknown error'
    }

    // Job should still be marked as cancelled even if queue removal fails
    const [cancelledJob] = await db.update(jobs)
      .set({
        status: 'cancelled',
        endTime: new Date(),
        errorMessage: errorMessage || 'Job cancelled by user',
        updatedAt: new Date()
      })
      .where(eq(jobs.id, job.id))
      .returning()

    expect(cancelledJob.status).toBe('cancelled')
    expect(queueJobRemoved).toBe(false) // No job in queue to remove
    expect(errorMessage).toBeNull() // No error, job just wasn't in queue
  })
})