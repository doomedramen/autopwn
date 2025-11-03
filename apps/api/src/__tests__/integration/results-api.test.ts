import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { resultsRoutes } from '@/routes/results'
import { db } from '@/db'
import { jobs, networks, dictionaries, jobResults, users, accounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// Mock auth middleware
vi.mock('@/middleware/auth', () => ({
  authenticate: async (c: any, next: any) => {
    const userId = c.get('userId') || 'test-user-id'
    c.set('userId', userId)
    c.set('userRole', 'user')
    await next()
  },
  getUserId: (c: any) => c.get('userId') || 'test-user-id'
}))

describe('Results API', () => {
  let app: Hono
  let testUserId: string

  beforeAll(async () => {
    // Setup test user
    testUserId = crypto.randomUUID()
    const hashedPassword = await bcrypt.hash('password123', 10)

    const [user] = await db.insert(users).values({
      id: testUserId,
      email: 'test-results@example.com',
      name: 'Test Results User',
      role: 'user',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      userId: testUserId,
      accountId: testUserId,
      providerId: 'credential',
      provider: 'credential',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Setup test app
    app = new Hono()
    app.route('/api/results', resultsRoutes)
  })

  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(jobResults).where(eq(jobResults.jobId, sql`job_id LIKE 'test-%'`))
    await db.delete(jobs).where(eq(jobs.userId, testUserId))
    await db.delete(dictionaries).where(eq(dictionaries.userId, testUserId))
    await db.delete(networks).where(eq(networks.userId, testUserId))
  })

  afterAll(async () => {
    // Clean up all test data
    await db.delete(jobResults)
    await db.delete(jobs).where(eq(jobs.userId, testUserId))
    await db.delete(dictionaries).where(eq(dictionaries.userId, testUserId))
    await db.delete(networks).where(eq(networks.userId, testUserId))
    await db.delete(accounts).where(eq(accounts.userId, testUserId))
    await db.delete(users).where(eq(users.id, testUserId))
  })

describe('Results API', () => {
  let adminAuth: Record<string, string>
  let userAuth: Record<string, string>
  let user2Auth: Record<string, string>
  let adminUser: any
  let regularUser: any
  let user2: any

  let testNetwork: any
  let testDictionary: any
  let testJob: any
  let testJob2: any
  let passwordResult: any
  let handshakeResult: any

  beforeAll(async () => {
    await setupTestDB()

    // Create test users
    adminUser = await createTestUser({ role: 'admin' })
    regularUser = await createTestUser({ role: 'user' })
    user2 = await createTestUser({ role: 'user' })

    adminAuth = await getAuthHeaders(adminUser.email, 'password123')
    userAuth = await getAuthHeaders(regularUser.email, 'password123')
    user2Auth = await getAuthHeaders(user2.email, 'password123')

    // Create test network
    const [network] = await db.insert(networks).values({
      id: crypto.randomUUID(),
      ssid: 'TestNetwork',
      bssid: 'AA:BB:CC:DD:EE:FF',
      encryption: 'WPA2-PSK',
      status: 'ready',
      userId: regularUser.id,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()
    testNetwork = network

    // Create test dictionary
    const [dictionary] = await db.insert(dictionaries).values({
      id: crypto.randomUUID(),
      name: 'TestDictionary',
      filename: 'test-dict.txt',
      type: 'uploaded',
      status: 'ready',
      size: 100,
      wordCount: 10,
      encoding: 'utf-8',
      checksum: 'abc123',
      filePath: '/tmp/test-dict.txt',
      userId: regularUser.id,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()
    testDictionary = dictionary

    // Create test jobs
    const [job1] = await db.insert(jobs).values({
      id: crypto.randomUUID(),
      userId: regularUser.id,
      name: 'Test Job 1',
      description: 'First test job',
      status: 'completed',
      config: { mode: 22000 },
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      progress: 100,
      createdAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      updatedAt: new Date()
    }).returning()
    testJob = job1

    const [job2] = await db.insert(jobs).values({
      id: crypto.randomUUID(),
      userId: regularUser.id,
      name: 'Test Job 2',
      description: 'Second test job',
      status: 'failed',
      config: { mode: 22000 },
      networkId: testNetwork.id,
      dictionaryId: testDictionary.id,
      progress: 50,
      createdAt: new Date(Date.now() - 1000 * 60 * 10), // 10 minutes ago
      updatedAt: new Date()
    }).returning()
    testJob2 = job2

    // Create test results
    const [result1] = await db.insert(jobResults).values({
      id: crypto.randomUUID(),
      jobId: testJob.id,
      type: 'password',
      data: {
        password: 'cracked123',
        bssid: testNetwork.bssid,
        ssid: testNetwork.ssid,
        dictionary: testDictionary.name,
        crackTime: 1234
      },
      createdAt: new Date(Date.now() - 1000 * 60 * 2) // 2 minutes ago
    }).returning()
    passwordResult = result1

    const [result2] = await db.insert(jobResults).values({
      id: crypto.randomUUID(),
      jobId: testJob2.id,
      type: 'handshake',
      data: {
        bssid: testNetwork.bssid,
        ssid: testNetwork.ssid,
        handshakeData: 'WPA*01*AA*BB*CC*...',
        hasPMKID: false,
        hasHandshake: true
      },
      createdAt: new Date(Date.now() - 1000 * 60 * 8) // 8 minutes ago
    }).returning()
    handshakeResult = result2
  })

  afterAll(async () => {
    await cleanupTestDB()
  })

  describe('GET /api/results', () => {
    test('should return all results for authenticated user', async () => {
      const response = await app.request('/api/results', {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.count).toBe(2)
      expect(data.pagination).toBeDefined()

      // Verify results include job and network information
      const result = data.data[0]
      expect(result.job).toBeDefined()
      expect(result.network).toBeDefined()
      expect(result.network.id).toBe(testNetwork.id)
      expect(result.job.id).toBe(testJob.id)
    })

    test('should filter results by jobId', async () => {
      const response = await app.request(`/api/results?jobId=${testJob.id}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].jobId).toBe(testJob.id)
      expect(data.data[0].type).toBe('password')
    })

    test('should filter results by networkId', async () => {
      const response = await app.request(`/api/results?networkId=${testNetwork.id}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.data.every((result: any) => result.network.id === testNetwork.id)).toBe(true)
    })

    test('should filter results by type', async () => {
      const response = await app.request('/api/results?type=password', {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].type).toBe('password')
    })

    test('should paginate results', async () => {
      const response = await app.request('/api/results?limit=1&offset=0', {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.pagination.limit).toBe(1)
      expect(data.pagination.offset).toBe(0)
      expect(data.pagination.total).toBe(2)
      expect(data.pagination.hasMore).toBe(true)
    })

    test('should enforce user isolation', async () => {
      // Create results for user2
      const [user2Network] = await db.insert(networks).values({
        id: crypto.randomUUID(),
        ssid: 'User2Network',
        bssid: '11:22:33:44:55:66',
        encryption: 'WPA2-PSK',
        status: 'ready',
        userId: user2.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const [user2Job] = await db.insert(jobs).values({
        id: crypto.randomUUID(),
        userId: user2.id,
        name: 'User2 Job',
        status: 'completed',
        networkId: user2Network.id,
        dictionaryId: crypto.randomUUID(),
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      await db.insert(jobResults).values({
        id: crypto.randomUUID(),
        jobId: user2Job.id,
        type: 'password',
        data: { password: 'user2pass' },
        createdAt: new Date()
      })

      // User1 should not see User2's results
      const response = await app.request('/api/results', {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2) // Only user1's results
      expect(data.data.every((result: any) => result.job.userId === regularUser.id)).toBe(true)
    })

    test('should require authentication', async () => {
      const response = await app.request('/api/results')

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/results/by-job/:jobId', () => {
    test('should return results for specific job', async () => {
      const response = await app.request(`/api/results/by-job/${testJob.id}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].jobId).toBe(testJob.id)
      expect(data.data[0].type).toBe('password')
      expect(data.data[0].data.password).toBe('cracked123')
    })

    test('should return 404 for non-existent job', async () => {
      const fakeJobId = crypto.randomUUID()

      const response = await app.request(`/api/results/by-job/${fakeJobId}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(404)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Job not found')
    })

    test('should prevent access to others job results', async () => {
      // Create job for user2
      const [user2Network] = await db.insert(networks).values({
        id: crypto.randomUUID(),
        ssid: 'User2Network',
        bssid: '11:22:33:44:55:66',
        encryption: 'WPA2-PSK',
        status: 'ready',
        userId: user2.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const [user2Job] = await db.insert(jobs).values({
        id: crypto.randomUUID(),
        userId: user2.id,
        name: 'User2 Private Job',
        status: 'completed',
        networkId: user2Network.id,
        dictionaryId: crypto.randomUUID(),
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // User1 tries to access user2's job results
      const response = await app.request(`/api/results/by-job/${user2Job.id}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(404) // Returns 404, not 403, for security
    })
  })

  describe('GET /api/results/by-network/:networkId', () => {
    test('should return results for specific network', async () => {
      const response = await app.request(`/api/results/by-network/${testNetwork.id}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2) // Both results are for the same network
      expect(data.data.every((result: any) => result.network.id === testNetwork.id)).toBe(true)
      expect(data.network.id).toBe(testNetwork.id)
      expect(data.network.ssid).toBe('TestNetwork')
    })

    test('should return 404 for non-existent network', async () => {
      const fakeNetworkId = crypto.randomUUID()

      const response = await app.request(`/api/results/by-network/${fakeNetworkId}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(404)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Network not found')
    })

    test('should prevent access to others network results', async () => {
      // Create network for user2
      const [user2Network] = await db.insert(networks).values({
        id: crypto.randomUUID(),
        ssid: 'User2Network',
        bssid: '11:22:33:44:55:66',
        encryption: 'WPA2-PSK',
        status: 'ready',
        userId: user2.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // User1 tries to access user2's network results
      const response = await app.request(`/api/results/by-network/${user2Network.id}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(404) // Returns 404 for security
    })
  })

  describe('GET /api/results/:id', () => {
    test('should return specific result with full details', async () => {
      const response = await app.request(`/api/results/${passwordResult.id}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.id).toBe(passwordResult.id)
      expect(data.data.jobId).toBe(testJob.id)
      expect(data.data.type).toBe('password')
      expect(data.data.job).toBeDefined()
      expect(data.data.network).toBeDefined()
      expect(data.data.job.id).toBe(testJob.id)
      expect(data.data.network.id).toBe(testNetwork.id)
      expect(data.data.data.password).toBe('cracked123')
    })

    test('should return 404 for non-existent result', async () => {
      const fakeResultId = crypto.randomUUID()

      const response = await app.request(`/api/results/${fakeResultId}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(404)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Result not found')
    })

    test('should prevent access to others results', async () => {
      // Create result for user2
      const [user2Network] = await db.insert(networks).values({
        id: crypto.randomUUID(),
        ssid: 'User2Network',
        bssid: '11:22:33:44:55:66',
        encryption: 'WPA2-PSK',
        status: 'ready',
        userId: user2.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const [user2Job] = await db.insert(jobs).values({
        id: crypto.randomUUID(),
        userId: user2.id,
        name: 'User2 Private Job',
        status: 'completed',
        networkId: user2Network.id,
        dictionaryId: crypto.randomUUID(),
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const [user2Result] = await db.insert(jobResults).values({
        id: crypto.randomUUID(),
        jobId: user2Job.id,
        type: 'password',
        data: { password: 'user2pass' },
        createdAt: new Date()
      }).returning()

      // User1 tries to access user2's result
      const response = await app.request(`/api/results/${user2Result.id}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(404) // Returns 404 for security
    })
  })

  describe('GET /api/results/passwords/cracked', () => {
    test('should return only cracked password results', async () => {
      const response = await app.request('/api/results/passwords/cracked', {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].type).toBe('password')
      expect(data.data[0].data.password).toBe('cracked123')
      expect(data.data[0].network).toBeDefined()
      expect(data.data[0].job).toBeDefined()
    })

    test('should return empty when no cracked passwords', async () => {
      // Create user2 with no cracked passwords
      const [user2Auth] = await getAuthHeaders(user2.email, 'password123')

      const response = await app.request('/api/results/passwords/cracked', {
        headers: {
          ...user2Auth,
          'Authorization': user2Auth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(0)
    })
  })

  describe('GET /api/results/stats', () => {
    test('should return results statistics', async () => {
      const response = await app.request('/api/results/stats', {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()

      // Should have counts by type
      expect(data.data.byType).toBeDefined()
      expect(data.data.byType.password).toBe(1)
      expect(data.data.byType.handshake).toBe(1)

      // Should have network counts
      expect(data.data.crackedNetworks).toBe(1) // One network has cracked password
      expect(data.data.totalNetworks).toBe(1) // User has one network

      // Should have crack rate
      expect(data.data.crackRate).toBe(100) // 1/1 networks cracked
    })

    test('should calculate crack rate correctly', async () => {
      // Add another network without cracked password
      const [uncrackedNetwork] = await db.insert(networks).values({
        id: crypto.randomUUID(),
        ssid: 'UncrackedNetwork',
        bssid: '22:33:44:55:66:77',
        encryption: 'WPA2-PSK',
        status: 'ready',
        userId: regularUser.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const response = await app.request('/api/results/stats', {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.totalNetworks).toBe(2)
      expect(data.data.crackedNetworks).toBe(1)
      expect(data.data.crackRate).toBe(50) // 1/2 networks cracked
    })
  })
})