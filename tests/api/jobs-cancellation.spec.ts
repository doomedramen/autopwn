import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '../../apps/api/src/db'
import { jobs, networks, dictionaries } from '../../apps/api/src/db/schema'
import { eq } from 'drizzle-orm'
import { addHashcatCrackingJob, getHashcatJob } from '../../apps/api/src/lib/queue'

// Test helper functions
async function createTestUser(userData?: { email?: string; password?: string }) {
  const { users } = await import('../../apps/api/src/db/schema')
  const defaultData = {
    email: userData?.email || 'testuser@example.com',
    password: userData?.password || 'testpassword',
    name: 'Test User',
    role: 'user' as const
  }

  const [user] = await db.insert(users).values({
    email: defaultData.email,
    password: defaultData.password, // In real implementation, this would be hashed
    name: defaultData.name,
    role: defaultData.role,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning()

  return user
}

async function createServer() {
  const { createApp } = await import('../../apps/api/src')
  return createApp()
}

async function makeRequest(server: any, path: string, options: RequestInit = {}) {
  const url = `http://localhost:3001${path}`
  return server.request(url, options)
}

describe('Job Cancellation', () => {
  let server: any
  let userId: string
  let testNetwork: any
  let testDictionary: any

  beforeAll(async () => {
    server = await createServer()
    const user = await createTestUser()
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
    }
  })

  it('should cancel a pending job', async () => {
    // Create a job
    const createResponse = await server.request('/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({
        name: 'Test Job for Cancellation',
        description: 'Testing job cancellation',
        type: 'wordlist',
        dictionaryId: testDictionary.id,
        options: {
          networkId: testNetwork.id
        }
      })
    })

    expect(createResponse.status).toBe(200)
    const createData = await createResponse.json()
    expect(createData.success).toBe(true)
    expect(createData.data.status).toBe('pending')

    const jobId = createData.data.id

    // Cancel the job
    const cancelResponse = await server.request(`/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': authCookie
      }
    })

    expect(cancelResponse.status).toBe(200)
    const cancelData = await cancelResponse.json()
    expect(cancelData.success).toBe(true)
    expect(cancelData.data.status).toBe('cancelled')
    expect(cancelData.meta.queueJobRemoved).toBeDefined()

    // Verify job is marked as cancelled in database
    const jobResponse = await server.request(`/api/jobs/${jobId}`, {
      headers: {
        'Cookie': authCookie
      }
    })

    expect(jobResponse.status).toBe(200)
    const jobData = await jobResponse.json()
    expect(jobData.data.status).toBe('cancelled')
  })

  it('should not allow cancellation of completed jobs', async () => {
    // Create and complete a job
    const [job] = await db.insert(jobs).values({
      name: 'Completed Job',
      description: 'This job is already completed',
      type: 'wordlist',
      userId,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      status: 'completed',
      progress: 100,
      startTime: new Date(),
      endTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    // Try to cancel the completed job
    const cancelResponse = await server.request(`/api/jobs/${job.id}`, {
      method: 'DELETE',
      headers: {
        'Cookie': authCookie
      }
    })

    expect(cancelResponse.status).toBe(400)
    const cancelData = await cancelResponse.json()
    expect(cancelData.success).toBe(false)
    expect(cancelData.error).toBe('Invalid job status')
    expect(cancelData.message).toContain('Only pending or running jobs can be cancelled')

    // Clean up
    await db.delete(jobs).where(eq(jobs.id, job.id))
  })

  it('should not allow cancellation of jobs owned by other users', async () => {
    // Create another user
    const otherUser = await createTestUser({
      email: 'otheruser@example.com',
      password: 'otherpassword'
    })

    // Create a job for the other user
    const [otherJob] = await db.insert(jobs).values({
      name: 'Other User Job',
      description: 'This job belongs to another user',
      type: 'wordlist',
      userId: otherUser.id,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    // Try to cancel the other user's job
    const cancelResponse = await server.request(`/api/jobs/${otherJob.id}`, {
      method: 'DELETE',
      headers: {
        'Cookie': authCookie
      }
    })

    expect(cancelResponse.status).toBe(403)
    const cancelData = await cancelResponse.json()
    expect(cancelData.success).toBe(false)
    expect(cancelData.error).toBe('Permission denied')

    // Clean up
    await db.delete(jobs).where(eq(jobs.id, otherJob.id))
    await db.delete(jobs).where(eq(jobs.userId, otherUser.id))
  })

  it('should reset network status when cancelling a running job', async () => {
    // Update network to processing status (simulating a running job)
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
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    // Cancel the running job
    const cancelResponse = await server.request(`/api/jobs/${runningJob.id}`, {
      method: 'DELETE',
      headers: {
        'Cookie': authCookie
      }
    })

    expect(cancelResponse.status).toBe(200)
    const cancelData = await cancelResponse.json()
    expect(cancelData.success).toBe(true)
    expect(cancelData.meta.wasRunning).toBe(true)

    // Verify network status was reset to ready
    const networkResponse = await server.request(`/api/networks/${testNetwork.id}`, {
      headers: {
        'Cookie': authCookie
      }
    })

    expect(networkResponse.status).toBe(200)
    const networkData = await networkResponse.json()
    expect(networkData.data.status).toBe('ready')

    // Clean up
    await db.delete(jobs).where(eq(jobs.id, runningJob.id))
  })

  it('should handle queue job removal gracefully', async () => {
    // Create a job
    const createResponse = await server.request('/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({
        name: 'Test Job for Queue Removal',
        description: 'Testing queue job removal',
        type: 'wordlist',
        dictionaryId: testDictionary.id,
        options: {
          networkId: testNetwork.id
        }
      })
    })

    expect(createResponse.status).toBe(200)
    const createData = await createResponse.json()
    const jobId = createData.data.id

    // Add job to queue manually to test removal
    const queueJob = await addHashcatCrackingJob({
      jobId,
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      handshakePath: '/tmp/test-handshake.hc22000',
      dictionaryPath: testDictionary.path,
      attackMode: 'handshake',
      userId
    })

    expect(queueJob).toBeDefined()

    // Cancel the job - this should remove it from both database and queue
    const cancelResponse = await server.request(`/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': authCookie
      }
    })

    expect(cancelResponse.status).toBe(200)
    const cancelData = await cancelResponse.json()
    expect(cancelData.success).toBe(true)
    expect(cancelData.meta.queueJobRemoved).toBe(true)

    // Verify job no longer exists in queue
    const queueJobAfterRemoval = await getHashcatJob(jobId)
    expect(queueJobAfterRemoval).toBeNull()
  })
})