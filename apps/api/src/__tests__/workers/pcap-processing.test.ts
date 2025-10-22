import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { processPCAP } from '../../workers/pcap-processing'
import { TestDataFactory } from '../test/utils/test-data-factory'
import { fsMock, dbMock } from '../test/setup/unit-setup'

describe('PCAP Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('PCAP File Analysis', () => {
    it('should process PCAP with valid WPA networks', async () => {
      
      // Mock successful PCAP processing
      fsMock.readFile = vi.fn().mockResolvedValue(Buffer.from('valid pcap data'))
      fsMock.access = vi.fn().mockResolvedValue(true)

      // Mock database operations
      const mockUpdate = vi.fn().mockResolvedValue(undefined)
      const mockInsert = vi.fn().mockResolvedValue([{ id: 'test-network-1' }])

      dbMock.update = mockUpdate
      dbMock.insert = mockInsert

      const result = await processPCAP({
        networkId: 'test-network-1',
        filePath: '/tmp/valid.pcap',
        originalFilename: 'valid.pcap',
        userId: 'test-user-1'
      })

      expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/valid.pcap')
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'processing' })
      )
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ssid: 'HomeNetwork_5G',
          bssid: '00:11:22:33:44:55',
          encryption: 'WPA2-PSK',
          status: 'ready',
          notes: expect.stringContaining('Processed from valid.pcap')
        })
      )
      expect(result.success).toBe(true)
      expect(result.networksFound).toBe(1)
    })

    it('should handle PCAP with no WiFi networks', async () => {
      
      fsMock.readFile = vi.fn().mockResolvedValue(Buffer.from('no wifi networks'))
      fsMock.access = vi.fn().mockResolvedValue(true)

      const mockUpdate = vi.fn().mockResolvedValue(undefined)

      dbMock.update = mockUpdate

      const result = await processPCAP({
        networkId: 'test-network-2',
        filePath: '/tmp/empty.pcap',
        originalFilename: 'empty.pcap',
        userId: 'test-user-2'
      })

      expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/empty.pcap')
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ready' })
      )
      expect(result.success).toBe(false)
      expect(result.networksFound).toBe(0)
      expect(result.error).toContain('No WiFi networks found')
    })

    it('should handle PCAP file access errors', async () => {
      
      fsMock.readFile = vi.fn()
      fsMock.access = vi.fn().mockRejectedValue(new Error('Permission denied'))

      const result = await processPCAP({
        networkId: 'test-network-3',
        filePath: '/tmp/protected.pcap',
        originalFilename: 'protected.pcap',
        userId: 'test-user-3'
      })

      expect(fsMock.access).toHaveBeenCalledWith('/tmp/protected.pcap')
      expect(fsMock.readFile).not.toHaveBeenCalled()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
    })

    it('should process multiple networks from single PCAP', async () => {
      
      fsMock.readFile = vi.fn().mockResolvedValue(Buffer.from('multi-network pcap data'))
      fsMock.access = vi.fn().mockResolvedValue(true)

      const mockUpdate = vi.fn().mockResolvedValue(undefined)
      const mockInsert = vi.fn()
        .mockResolvedValueOnce([{ id: 'test-network-4-1' }])
        .mockResolvedValueOnce([{ id: 'test-network-4-2' }])
        .mockResolvedValueOnce([{ id: 'test-network-4-3' }])

      dbMock.update = mockUpdate
      dbMock.insert = mockInsert

      const result = await processPCAP({
        networkId: 'test-network-4',
        filePath: '/tmp/multi.pcap',
        originalFilename: 'multi.pcap',
        userId: 'test-user-4'
      })

      expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/multi.pcap')
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'processing' })
      )
      expect(mockInsert).toHaveBeenCalledTimes(3) // Main network + 2 additional networks
      expect(result.success).toBe(true)
      expect(result.networksFound).toBe(3)
    })
  })

  describe('Network Data Extraction', () => {
    it('should extract WPA2 handshake information', async () => {
      
      // Mock PCAP with WPA2 handshake
      fsMock.readFile = vi.fn().mockResolvedValue(Buffer.from('wpa2 handshake pcap'))
      fsMock.access = vi.fn().mockResolvedValue(true)

      const result = await processPCAP({
        networkId: 'test-wpa2',
        filePath: '/tmp/wpa2.pcap',
        originalFilename: 'wpa2.pcap',
        userId: 'test-wpa2'
      })

      expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/wpa2.pcap')
      expect(result.success).toBe(true)
      expect(result.networks[0]).toMatchObject({
        ssid: expect.any(String),
        bssid: expect.any(String),
        encryption: 'WPA2-PSK',
        hasHandshake: true,
        channel: expect.any(Number),
        frequency: expect.any(Number),
        signalStrength: expect.any(Number)
      })
    })

    it('should extract WPA3 PMKID information', async () => {
      
      // Mock PCAP with WPA3 PMKID
      fsMock.readFile = vi.fn().mockResolvedValue(Buffer.from('wpa3 pmkid pcap'))
      fsMock.access = vi.fn().mockResolvedValue(true)

      const result = await processPCAP({
        networkId: 'test-wpa3',
        filePath: '/tmp/wpa3.pcap',
        originalFilename: 'wpa3.pcap',
        userId: 'test-wpa3'
      })

      expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/wpa3.pcap')
      expect(result.success).toBe(true)
      expect(result.networks[0]).toMatchObject({
        ssid: expect.any(String),
        bssid: expect.any(String),
        encryption: 'WPA3-PSK',
        hasHandshake: false,
        pmkid: expect.any(String)
      })
    })

    it('should extract mixed encryption types', async () => {
      
      // Mock PCAP with mixed networks
      fsMock.readFile = vi.fn().mockResolvedValue(Buffer.from('mixed encryption pcap'))
      fsMock.access = vi.fn().mockResolvedValue(true)

      const result = await processPCAP({
        networkId: 'test-mixed',
        filePath: '/tmp/mixed.pcap',
        originalFilename: 'mixed.pcap',
        userId: 'test-mixed'
      })

      expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/mixed.pcap')
      expect(result.networks.length).toBeGreaterThanOrEqual(2)

      // Should have both WPA2 and WPA3 networks
      const hasWPA2 = result.networks.some((n: any) => n.encryption === 'WPA2-PSK')
      const hasWPA3 = result.networks.some((n: any) => n.encryption === 'WPA3-PSK')

      expect(hasWPA2).toBe(true)
      expect(hasWPA3).toBe(true)
    })

    it('should handle signal strength calculations', async () => {
      
      // Mock PCAP with strong signal
      fsMock.readFile = vi.fn().mockResolvedValue(Buffer.from('strong signal pcap'))
      fsMock.access = vi.fn().mockResolvedValue(true)

      const result = await processPCAP({
        networkId: 'test-signal',
        filePath: '/tmp/strong.pcap',
        originalFilename: 'strong.pcap',
        userId: 'test-signal'
      })

      expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/strong.pcap')
      expect(result.networks[0]).toMatchObject({
        signalStrength: expect.any(Number)
      })

      // Signal strength should be in reasonable range
      expect(result.networks[0].signalStrength).toBeGreaterThanOrEqual(-100)
      expect(result.networks[0].signalStrength).toBeLessThanOrEqual(0)
    })
  })

  describe('File Type Validation', () => {
    it('should accept .pcap files', async () => {
      
      fsMock.access = vi.fn().mockResolvedValue(true)

      const result = await processPCAP({
        networkId: 'test-extension',
        filePath: '/tmp/test.pcap',
        originalFilename: 'test.pcap',
        userId: 'test-extension'
      })

      expect(fsMock.access).toHaveBeenCalledWith('/tmp/test.pcap')
      expect(result.success).toBe(true) // Mock would succeed
    })

    it('should accept .cap files', async () => {
      
      fsMock.access = vi.fn().mockResolvedValue(true)

      const result = await processPCAP({
        networkId: 'test-cap',
        filePath: '/tmp/test.cap',
        originalFilename: 'test.cap',
        userId: 'test-cap'
      })

      expect(fsMock.access).toHaveBeenCalledWith('/tmp/test.cap')
      expect(result.success).toBe(true) // Mock would succeed
    })

    it('should reject unsupported file types', async () => {
      
      fsMock.access = vi.fn().mockResolvedValue(false)

      const result = await processPCAP({
        networkId: 'test-unsupported',
        filePath: '/tmp/test.txt',
        originalFilename: 'test.txt',
        userId: 'test-unsupported'
      })

      expect(fsMock.access).toHaveBeenCalledWith('/tmp/test.txt')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unsupported file type')
    })
  })

  describe('Error Handling', () => {
    it('should handle corrupted PCAP files', async () => {
      
      fsMock.readFile = vi.fn().mockResolvedValue(Buffer.from('corrupted pcap data'))
      fsMock.access = vi.fn().mockResolvedValue(true)

            const mockUpdate = vi.fn().mockResolvedValue(undefined)

      dbMock.update = mockUpdate

      const result = await processPCAP({
        networkId: 'test-corrupt',
        filePath: '/tmp/corrupt.pcap',
        originalFilename: 'corrupt.pcap',
        userId: 'test-corrupt'
      })

      expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/corrupt.pcap')
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          notes: expect.stringContaining('Processing failed')
        })
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('Processing failed')
    })

    it('should handle database errors gracefully', async () => {
      
      fsMock.readFile = vi.fn().mockResolvedValue(Buffer.from('valid pcap'))
      fsMock.access = vi.fn().mockResolvedValue(true)

      const mockUpdate = vi.fn().mockRejectedValue(new Error('Database connection failed'))
      const mockInsert = vi.fn()

      dbMock.update = mockUpdate
      dbMock.insert = mockInsert

      const result = await processPCAP({
        networkId: 'test-db-error',
        filePath: '/tmp/db-error.pcap',
        originalFilename: 'db-error.pcap',
        userId: 'test-db-error'
      })

      expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/db-error.pcap')
      expect(mockUpdate).toHaveBeenCalled()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Database connection failed')
    })
  })

  describe('Performance Tests', () => {
    it('should process large PCAP files within time limits', async () => {
      
      // Mock large PCAP (50MB)
      const largePCAP = Buffer.alloc(50 * 1024 * 1024)
      fsMock.readFile = vi.fn().mockResolvedValue(largePCAP)
      fsMock.access = vi.fn().mockResolvedValue(true)

      const startTime = Date.now()

      // Mock database operations
      const mockUpdate = vi.fn().mockResolvedValue(undefined)
      const mockInsert = vi.fn().mockResolvedValue([{ id: 'test-perf' }])

            dbMock.update = mockUpdate
      dbMock.insert = mockInsert

      const result = await processPCAP({
        networkId: 'test-perf-large',
        filePath: '/tmp/large.pcap',
        originalFilename: 'large.pcap',
        userId: 'test-perf-large'
      })

      const endTime = Date.now()
      const processingTime = endTime - startTime

      expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/large.pcap')
      expect(result.success).toBe(true)
      expect(result.networksFound).toBeGreaterThan(0)
      expect(processingTime).toBeLessThan(30000) // Should process within 30 seconds
    })
  })
})