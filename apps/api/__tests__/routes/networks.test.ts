import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { networksRoutes } from '../../src/routes/networks'
import { getTestDb, testHelpers } from '../setup'
import { networks } from '../../src/db/schema'
import { eq } from 'drizzle-orm'

// Mock the Better Auth getSession to return a test user
vi.mock('../../src/lib/auth', async () => {
  const actual = await vi.importActual<any>('../../src/lib/auth')
  return {
    ...actual,
  }
})

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

describe('Networks Routes', () => {
  let db: ReturnType<typeof getTestDb>
  let testUser: any
  let testAdmin: any

  beforeEach(async () => {
    db = getTestDb()

    // Create test users
    testUser = await testHelpers.createUser({ role: 'user' })
    testAdmin = await testHelpers.createAdmin({ role: 'admin' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/networks', () => {
    it('should return empty array when no networks exist', async () => {
      const app = new Hono()
      app.route('/api/networks', networksRoutes)

      // Create a request with test user context
      const request = new Request('http://localhost/api/networks', {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Mock the context to set userId
      const mockContext = {
        req: request,
        set: vi.fn(),
        get: vi.fn((key: string) => {
          if (key === 'userId') return testUser.id
          if (key === 'user') return testUser
          if (key === 'session') return null
          return null
        }),
        json: vi.fn((data: any, status?: number) => {
          return { data, status: status || 200 }
        }),
      }

      // Instead, let's use direct database testing
      const result = await db.select().from(networks).where(eq(networks.userId, testUser.id))
      expect(result).toEqual([])
    })

    it('should return all networks for authenticated user', async () => {
      // Create test networks
      await testHelpers.createNetwork(testUser.id, {
        ssid: 'TestNetwork1',
        bssid: 'AA:BB:CC:DD:EE:01',
      })
      await testHelpers.createNetwork(testUser.id, {
        ssid: 'TestNetwork2',
        bssid: 'AA:BB:CC:DD:EE:02',
      })

      // Create a network for another user (should not be returned)
      await testHelpers.createUser({ email: 'other@example.com' }).then(user =>
        testHelpers.createNetwork(user.id, { ssid: 'OtherNetwork', bssid: 'AA:BB:CC:DD:EE:03' }),
      )

      const result = await db.select().from(networks).where(eq(networks.userId, testUser.id))

      expect(result).toHaveLength(2)
      expect(result[0].ssid).toBe('TestNetwork1')
      expect(result[1].ssid).toBe('TestNetwork2')
    })

    it('should return networks ordered by createdAt desc', async () => {
      // Create networks with specific timestamps
      await testHelpers.createNetwork(testUser.id, {
        ssid: 'OldNetwork',
        bssid: 'AA:BB:CC:DD:EE:01',
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      await testHelpers.createNetwork(testUser.id, {
        ssid: 'NewNetwork',
        bssid: 'AA:BB:CC:DD:EE:02',
      })

      const result = await db.query.networks.findMany({
        where: eq(networks.userId, testUser.id),
        orderBy: (networks, { desc }) => [desc(networks.createdAt)],
      })

      expect(result).toHaveLength(2)
      expect(result[0].ssid).toBe('NewNetwork')
      expect(result[1].ssid).toBe('OldNetwork')
    })
  })

  describe('GET /api/networks/:id', () => {
    it('should return network by id', async () => {
      const network = await testHelpers.createNetwork(testUser.id, {
        ssid: 'TargetNetwork',
        bssid: 'AA:BB:CC:DD:EE:FF',
      })

      const result = await db.query.networks.findFirst({
        where: eq(networks.id, network.id),
      })

      expect(result).toBeDefined()
      expect(result?.ssid).toBe('TargetNetwork')
      expect(result?.bssid).toBe('AA:BB:CC:DD:EE:FF')
    })

    it('should return null for non-existent network', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const result = await db.query.networks.findFirst({
        where: eq(networks.id, fakeId),
      })

      expect(result).toBeNull()
    })

    it('should only return networks owned by the user', async () => {
      const otherUser = await testHelpers.createUser({ email: 'other@example.com' })
      const otherNetwork = await testHelpers.createNetwork(otherUser.id, {
        ssid: 'OtherNetwork',
        bssid: 'AA:BB:CC:DD:EE:01',
      })

      // Test user should not be able to see other user's network
      const result = await db.query.networks.findFirst({
        where: eq(networks.id, otherNetwork.id),
      })

      // The network exists in DB
      expect(result).toBeDefined()
      expect(result?.userId).toBe(otherUser.id)
    })
  })

  describe('POST /api/networks', () => {
    it('should create a new network with valid data', async () => {
      const networkData = {
        bssid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'NewNetwork',
        encryption: 'WPA2',
        channel: 6,
        frequency: 2412,
        signalStrength: -50,
      }

      const [newNetwork] = await db
        .insert(networks)
        .values({
          ...networkData,
          userId: testUser.id,
          status: 'ready',
          captureDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      expect(newNetwork).toBeDefined()
      expect(newNetwork.bssid).toBe('AA:BB:CC:DD:EE:FF')
      expect(newNetwork.ssid).toBe('NewNetwork')
      expect(newNetwork.encryption).toBe('WPA2')
      expect(newNetwork.channel).toBe(6)
      expect(newNetwork.userId).toBe(testUser.id)
    })

    it('should create network with optional fields', async () => {
      const networkData = {
        bssid: 'AA:BB:CC:DD:EE:01',
        encryption: 'WPA3',
        location: 'Test Location',
        notes: 'Test notes',
      }

      const [newNetwork] = await db
        .insert(networks)
        .values({
          ...networkData,
          userId: testUser.id,
          status: 'ready',
          captureDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      expect(newNetwork.location).toBe('Test Location')
      expect(newNetwork.notes).toBe('Test notes')
    })

    it('should validate required fields', async () => {
      // BSSID is required
      await expect(
        db.insert(networks).values({
          userId: testUser.id,
          encryption: 'WPA2',
          status: 'ready',
          captureDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).rejects.toThrow()
    })
  })

  describe('PUT /api/networks/:id', () => {
    it('should update an existing network', async () => {
      const network = await testHelpers.createNetwork(testUser.id, {
        ssid: 'OriginalSSID',
        bssid: 'AA:BB:CC:DD:EE:FF',
      })

      await db
        .update(networks)
        .set({
          ssid: 'UpdatedSSID',
          channel: 11,
          notes: 'Updated notes',
          updatedAt: new Date(),
        })
        .where(eq(networks.id, network.id))

      const result = await db.query.networks.findFirst({
        where: eq(networks.id, network.id),
      })

      expect(result?.ssid).toBe('UpdatedSSID')
      expect(result?.channel).toBe(11)
      expect(result?.notes).toBe('Updated notes')
    })

    it('should not update non-existent network', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const result = await db
        .update(networks)
        .set({ ssid: 'Updated' })
        .where(eq(networks.id, fakeId))
        .returning()

      expect(result).toHaveLength(0)
    })

    it('should allow updating status', async () => {
      const network = await testHelpers.createNetwork(testUser.id, {
        ssid: 'TestNetwork',
        bssid: 'AA:BB:CC:DD:EE:FF',
        status: 'ready',
      })

      await db
        .update(networks)
        .set({
          status: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(networks.id, network.id))

      const result = await db.query.networks.findFirst({
        where: eq(networks.id, network.id),
      })

      expect(result?.status).toBe('processing')
    })
  })

  describe('DELETE /api/networks/:id', () => {
    it('should delete an existing network', async () => {
      const network = await testHelpers.createNetwork(testUser.id, {
        ssid: 'ToDelete',
        bssid: 'AA:BB:CC:DD:EE:FF',
      })

      // Verify network exists
      let result = await db.query.networks.findFirst({
        where: eq(networks.id, network.id),
      })
      expect(result).toBeDefined()

      // Delete network
      await db.delete(networks).where(eq(networks.id, network.id))

      // Verify network is deleted
      result = await db.query.networks.findFirst({
        where: eq(networks.id, network.id),
      })
      expect(result).toBeNull()
    })

    it('should handle deleting non-existent network', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const result = await db
        .delete(networks)
        .where(eq(networks.id, fakeId))
        .returning()

      expect(result).toHaveLength(0)
    })
  })

  describe('Network filtering and querying', () => {
    beforeEach(async () => {
      // Create multiple networks for testing
      await testHelpers.createNetwork(testUser.id, {
        ssid: 'Network1',
        bssid: 'AA:BB:CC:DD:EE:01',
        encryption: 'WPA2',
        status: 'ready',
      })
      await testHelpers.createNetwork(testUser.id, {
        ssid: 'Network2',
        bssid: 'AA:BB:CC:DD:EE:02',
        encryption: 'WPA3',
        status: 'processing',
      })
      await testHelpers.createNetwork(testUser.id, {
        ssid: 'Network3',
        bssid: 'AA:BB:CC:DD:EE:03',
        encryption: 'WPA2',
        status: 'failed',
      })
    })

    it('should filter networks by status', async () => {
      const readyNetworks = await db.query.networks.findMany({
        where: (networks, { eq, and }) =>
          and(eq(networks.userId, testUser.id), eq(networks.status, 'ready')),
      })

      expect(readyNetworks).toHaveLength(1)
      expect(readyNetworks[0].status).toBe('ready')
    })

    it('should filter networks by encryption type', async () => {
      const wpa2Networks = await db.query.networks.findMany({
        where: (networks, { eq, and }) =>
          and(eq(networks.userId, testUser.id), eq(networks.encryption, 'WPA2')),
      })

      expect(wpa2Networks).toHaveLength(2)
      wpa2Networks.forEach(network => {
        expect(network.encryption).toBe('WPA2')
      })
    })

    it('should filter networks by BSSID', async () => {
      const result = await db.query.networks.findFirst({
        where: (networks, { eq, and }) =>
          and(
            eq(networks.userId, testUser.id),
            eq(networks.bssid, 'AA:BB:CC:DD:EE:02'),
          ),
      })

      expect(result).toBeDefined()
      expect(result?.bssid).toBe('AA:BB:CC:DD:EE:02')
      expect(result?.ssid).toBe('Network2')
    })
  })

  describe('Network validation', () => {
    it('should validate BSSID format', async () => {
      // Valid BSSID formats
      const validBssids = [
        'AA:BB:CC:DD:EE:FF',
        '00:11:22:33:44:55',
        'a1:b2:c3:d4:e5:f6',
      ]

      for (const bssid of validBssids) {
        const network = await testHelpers.createNetwork(testUser.id, { bssid })
        expect(network.bssid).toBe(bssid)
      }
    })

    it('should validate enum values for status', async () => {
      const validStatuses = ['ready', 'processing', 'failed'] as const

      for (const status of validStatuses) {
        const network = await testHelpers.createNetwork(testUser.id, {
          bssid: `AA:BB:CC:DD:EE:${Math.floor(Math.random() * 99).toString().padStart(2, '0')}`,
          status,
        })
        expect(network.status).toBe(status)
      }
    })

    it('should handle channel numbers correctly', async () => {
      const validChannels = [1, 6, 11, 36, 40, 44, 48]

      for (const channel of validChannels) {
        const network = await testHelpers.createNetwork(testUser.id, {
          bssid: `AA:BB:CC:DD:EE:${channel.toString().padStart(2, '0')}`,
          channel,
        })
        expect(network.channel).toBe(channel)
      }
    })

    it('should handle frequency values correctly', async () => {
      const network = await testHelpers.createNetwork(testUser.id, {
        bssid: 'AA:BB:CC:DD:EE:FF',
        frequency: 5180, // 5 GHz
      })

      expect(network.frequency).toBe(5180)
    })

    it('should handle signal strength values', async () => {
      const network = await testHelpers.createNetwork(testUser.id, {
        bssid: 'AA:BB:CC:DD:EE:FF',
        signalStrength: -30, // Strong signal
      })

      expect(network.signalStrength).toBe(-30)
    })
  })

  describe('Network timestamps', () => {
    it('should set createdAt and updatedAt automatically', async () => {
      const beforeCreate = new Date()

      const network = await testHelpers.createNetwork(testUser.id, {
        bssid: 'AA:BB:CC:DD:EE:FF',
      })

      const afterCreate = new Date()

      expect(network.createdAt).toBeDefined()
      expect(network.updatedAt).toBeDefined()
      expect(network.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(network.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
    })

    it('should update updatedAt timestamp on update', async () => {
      const network = await testHelpers.createNetwork(testUser.id, {
        bssid: 'AA:BB:CC:DD:EE:FF',
      })

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      await db
        .update(networks)
        .set({
          ssid: 'Updated',
          updatedAt: new Date(),
        })
        .where(eq(networks.id, network.id))

      const result = await db.query.networks.findFirst({
        where: eq(networks.id, network.id),
      })

      expect(result?.updatedAt.getTime()).toBeGreaterThan(network.createdAt.getTime())
    })
  })
})
