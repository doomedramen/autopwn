import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { runHashcatAttack, buildHashcatCommand } from '../../workers/hashcat'
import { processPCAP } from '../workers/pcap-processing'
import { testDb, createTestJob, createTestUser, createTestNetworkCapture } from '../test/utils/test-utils'
import { TestDataFactory } from '../test/utils/test-data-factory'
import * as fs from 'fs/promises'

// Mock external dependencies
vi.mock('child_process', () => ({
  exec: vi.fn()
}))

describe('Security Workflow Integration Tests', () => {
  let testUser: any
  let testNetwork: any
  let testJob: any
  let testJob2: any

  beforeAll(async () => {
    console.log('Setting up security workflow integration tests...')
    testUser = await createTestUser(TestDataFactory.createAdminUser())
    testNetwork = await createTestNetworkCapture(TestDataFactory.createNetworkCapture({
      networks: [{
        ssid: 'TestNetwork_WPA2',
        bssid: '00:11:22:33:44:55',
        encryption: 'WPA2-PSK',
        channel: 6,
        frequency: 2437,
        signalStrength: -45,
        hasHandshake: true,
        hasPmkid: false
      }]
    }))
    testJob = await createTestJob(TestDataFactory.createJob({
      userId: testUser.id,
      networkId: testNetwork.id,
      type: 'wordlist',
      status: 'pending'
    }))
    testJob2 = await createTestJob(TestDataFactory.createJob({
      userId: testUser.id,
      networkId: testNetwork.id,
      type: 'pmkid',
      status: 'pending'
    }))

    console.log('Security workflow test setup complete')
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Complete Password Cracking Workflow', () => {
    it('should complete WPA handshake attack successfully', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)
      const { promises: fsMock } = await import('fs/promises')

      // Mock PCAP processing
      const mockProcessedNetwork = {
        ssid: 'TestNetwork_WPA2',
        bssid: '00:11:22:33:44:55',
        encryption: 'WPA2-PSK',
        channel: 6,
        frequency: 2437,
        signalStrength: -45,
        hasHandshake: true,
        hasPmkid: false
      }

      fsMock.mkdir = vi.fn().mockResolvedValue(undefined)
      fsMock.access = vi.fn().mockResolvedValue(true)
      fsMock.readFile = vi.fn().mockResolvedValue(Buffer.from('wpa handshake pcap'))

      // Mock hashcat execution with success
      mockExec.mockImplementation((command, callback) => {
        setTimeout(() => {
          // Should build proper hashcat command
          expect(command).toContain('-m 22000') // WPA handshake mode
          expect(command).toContain('-a 0') // Dictionary attack
          expect(command).toContain('--runtime=3600')

          callback(null, {
            stdout: 'hashcat (v6.2.6) completed\nCracked: 1/1 hashes',
            stderr: ''
          })
        }, 200)
        return { kill: vi.fn() } as any
      })

      // Mock hashcat output parsing
      const mockHashcatOutput = 'WPA*01*TestNetwork_WPA2*00*00:11:22:33:44:55*discovered_password'
      fsMock.access = vi.fn().mockResolvedValue(true)
      fsMock.readFile = vi.fn().mockResolvedValue(mockHashcatOutput)

      // Mock database updates
      const mockDbUpdate = vi.fn().mockResolvedValue(undefined)
      const mockDbInsert = vi.fn().mockResolvedValue([{
        id: 'result-1',
        jobId: testJob.id,
        networkId: testNetwork.id,
        dictionaryId: 'test-dict-1',
        password: 'discovered_password',
        plaintext: 'discovered_password',
        attackMode: 'handshake',
        hashType: 'WPA-PBKDF2-PMKID+EAPOL',
        processingTime: 15000,
        createdAt: new Date(),
        updatedAt: new Date()
      }])

      // Mock database calls
      vi.mocked(testDb).update.mockImplementation((query, updates) => {
        if (updates.set) {
          if (updates.get('status') === 'completed') {
            updates.set('completedAt', new Date())
          }
        }
        return Promise.resolve([0])
      })
      vi.mocked(testDb).insert.mockImplementation((values) => {
        return Promise.resolve(values)
      })

      // Mock processPCAP with the existing network data
      vi.mock('processPCAP', () => ({
        processPCAP: vi.fn().mockResolvedValue({
          success: true,
          networksFound: 1,
          networks: [mockProcessedNetwork]
        })
      }))

      const result = await runHashcatAttack({
        jobId: testJob.id,
        networkId: testNetwork.id,
        dictionaryId: 'test-dict-1',
        handshakePath: '/tmp/test_wpa2.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        attackMode: 'handshake',
        userId: testUser.id
      })

      // Verify workflow steps
      expect(fsMock.mkdir).toHaveBeenCalled()
      expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/test_wpa2.hc22000')
      expect(mockExec).toHaveBeenCalled()
      expect(fsMock.access).toHaveBeenCalled()
      expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/test_wpa2_output.txt')
      expect(mockDbUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'running' })
      )
      expect(mockDbUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          success: true,
          passwordFound: true,
          completedAt: expect.any(Date)
        })
      )
      expect(mockDbInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            password: 'discovered_password',
            attackMode: 'handshake'
          })
        ])
      )
      expect(result.success).toBe(true)
      expect(result.passwordsFound).toBe(1)
      expect(result.passwords[0].password).toBe('discovered_password')
    })

    it('should handle PMKID attack successfully', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)
      const { promises: fsMock } = await import('fs/promises')

      // Mock PMKID extraction
      const mockPMKID = 'TestNetwork_PMKID*00*11:22:33:44:55*b4a5c8a6d9f2a5d8bb590056b2241c'

      fsMock.writeFile = vi.fn().mockResolvedValue(undefined)

      // Mock hashcat execution
      mockExec.mockImplementation((command, callback) => {
        setTimeout(() => {
          expect(command).toContain('-m 16800') // PMKID mode
          callback(null, {
            stdout: 'hashcat (v6.2.6) completed\nCracked: 1/1 hashes',
            stderr: ''
          })
        }, 200)
        return { kill: vi.fn() } as any
      })

      // Mock hashcat output parsing
      fsMock.access = vi.fn().mockResolvedValue(true)
      fsMock.readFile = vi.fn().mockResolvedValue(mockPMKID)

      // Create PMKID job
      const pmkidJob = TestDataFactory.createJob({
        userId: testUser.id,
        networkId: testNetwork.id,
        type: 'pmkid',
        status: 'pending'
      })

      // Mock PMKID workflow execution
      const result = await runHashcatAttack({
        jobId: pmkidJob.id,
        networkId: testNetwork.id,
        dictionaryId: 'test-dict-1',
        handshakePath: '/tmp/test_pmkid.16800',
        dictionaryPath: '/tmp/wordlist.txt',
        attackMode: 'pmkid',
        userId: testUser.id
      })

      expect(fsMock.writeFile).toHaveBeenCalledWith('/tmp/test_pmkid.16800', mockPMKID)
      expect(result.success).toBe(true)
      expect(result.passwordsFound).toBe(1)
    })

    it('should handle attack with no results', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)
      const { promises: fsMock } = await import('fs/promises')

      // Mock hashcat execution with no cracks
      mockExec.mockImplementation((command, callback) => {
        setTimeout(() => {
          callback(null, {
            stdout: 'hashcat (v6.2.6) completed\nExhausted',
            stderr: ''
          })
        }, 200)
        return { kill: vi.fn() } as any
      })

      // Mock empty hashcat output
      const mockEmptyOutput = ''
      fsMock.access = vi.fn().mockResolvedValue(false) // Output file doesn't exist
      fsMock.readFile = vi.fn().mockResolvedValue(mockEmptyOutput)

      const failedJob = TestDataFactory.createJob({
        userId: testUser.id,
        networkId: testNetwork.id,
        type: 'wordlist',
        status: 'pending'
      })

      const result = await runHashcatAttack({
        jobId: failedJob.id,
        networkId: testNetwork.id,
        dictionaryId: 'test-dict-failed',
        handshakePath: '/tmp/failed_attack.hc22000',
        dictionaryPath: '/tmp/wordlist_failed.txt',
        attackMode: 'handshake',
        userId: testUser.id
      })

      expect(result.success).toBe(true) // Job completes even with no cracks
      expect(result.passwordsFound).toBe(0)
      expect(result.message).toContain('No passwords found')
    })
  })

  describe('Attack Mode Variations', () => {
    it('should handle dictionary attack mode', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      mockExec.mockImplementation((command, callback) => {
        setTimeout(() => {
          expect(command).toContain('-a 0') // Dictionary attack
          callback(null, {
            stdout: 'hashcat (v6.2.6) completed',
            stderr: ''
          })
        }, 200)
        return { kill: vi.fn() } as any
      })

      const dictionaryJob = TestDataFactory.createJob({
        userId: testUser.id,
        networkId: testNetwork.id,
        type: 'dictionary',
        status: 'pending'
      })

      const result = await runHashcatAttack({
        jobId: dictionaryJob.id,
        networkId: testNetwork.id,
        dictionaryId: 'test-dict-1',
        handshakePath: '/tmp/dict_attack.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        attackMode: 'handshake', // Using handshake mode but expecting dict attack flags
        userId: testUser.id
      })

      expect(result.success).toBe(true)
    })

    it('should handle mask attack mode', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      mockExec.mockImplementation((command, callback) => {
        setTimeout(() => {
          expect(command).toContain('-a 3') // Mask attack
          expect(command).toContain('?d?d?d?d') // Example mask
          callback(null, {
            stdout: 'hashcat (v6.2.6) completed',
            stderr: ''
          })
        }, 200)
        return { kill: vi.fn() } as any
      })

      const maskJob = TestDataFactory.createJob({
        userId: testUser.id,
        networkId: testNetwork.id,
        type: 'mask',
        mask: '?d?d?d?d',
        status: 'pending'
      })

      const result = await runHashcatAttack({
        jobId: maskJob.id,
        networkId: testNetwork.id,
        dictionaryId: 'test-dict-1',
        handshakePath: '/tmp/mask_attack.hc22000',
        dictionaryPath: '/tmp/mask_wordlist.txt', // Used with mask attack
        attackMode: 'handshake', // Will be overridden by job type
        userId: testUser.id
      })

      expect(result.success).toBe(true)
    })

    it('should handle hybrid attack mode', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      mockExec.mockImplementation((command, callback) => {
        setTimeout(() => {
          expect(command).toContain('-a 1') // Hybrid attack
          expect(command).toContain('-r') // Rules file
          callback(null, {
            stdout: 'hashcat (v6.2.6) completed',
            stderr: ''
          })
        }, 200)
        return { kill: vi.fn() } as any
      })

      const hybridJob = TestDataFactory.createJob({
        userId: testUser.id,
        networkId: testNetwork.id,
        type: 'hybrid',
        rulesFile: '/tmp/best64.rule',
        mask: '?d?d?d?d?d?a?a?a',
        status: 'pending'
      })

      const result = await runHashcatAttack({
        jobId: hybridJob.id,
        networkId: testNetwork.id,
        dictionaryId: 'test-dict-1',
        handshakePath: '/tmp/hybrid_attack.hc22000',
        dictionaryPath: '/tmp/hybrid_wordlist.txt',
        attackMode: 'handshake', // Will be overridden by job type
        userId: testUser.id
      })

      expect(result.success).toBe(true)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle hashcat process interruption', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      mockExec.mockImplementation((command, callback) => {
        setTimeout(() => {
          // Simulate process interruption
          const error = new Error('Process killed')
          error.name = 'ProcessTerminatedError'
          callback(error, {
            stdout: 'hashcat (v6.2.6) interrupted',
            stderr: '',
            signal: 'SIGTERM'
          })
        }, 100)
        return { kill: vi.fn() } as any
      })

      const interruptedJob = TestDataFactory.createJob({
        userId: testUser.id,
        networkId: testNetwork.id,
        type: 'wordlist',
        status: 'pending'
      })

      const result = await runHashcatAttack({
        jobId: interruptedJob.id,
        networkId: testNetwork.id,
        dictionaryId: 'test-dict-1',
        handshakePath: '/tmp/interrupted_attack.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        attackMode: 'handshake',
        userId: testUser.id
      })

      expect(result.success).toBe(false) // Should fail due to interruption
      expect(result.error).toContain('Process killed')
    })

    it('should handle hashcat memory errors', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      mockExec.mockImplementation((command, callback) => {
        setTimeout(() => {
          const error = new Error('Process out of memory')
          error.name = 'OutOfMemoryError'
          callback(error, {
            stdout: '',
            stderr: 'hashcat: out of memory'
          })
        }, 100)
        return { kill: vi.fn() } as any
      })

      const memoryErrorJob = TestDataFactory.createJob({
        userId: testUser.id,
        networkId: testNetwork.id,
        type: 'wordlist',
        status: 'pending'
      })

      const result = await runHashcatAttack({
        jobId: memoryErrorJob.id,
        networkId: testNetwork.id,
        dictionaryId: 'test-dict-1',
        handshakePath: '/tmp/memory_error_attack.hc22000',
        dictionaryPath: '/tmp/large_wordlist.txt',
        attackMode: 'handshake',
        userId: testUser.id
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('out of memory')
    })
  })

  describe('Multiple Attack Scenarios', () => {
    it('should handle concurrent attacks on same network', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      // Track execution calls
      const executionCalls: any[] = []

      mockExec.mockImplementation((command, callback) => {
        executionCalls.push(command)
        setTimeout(() => {
          callback(null, {
            stdout: 'hashcat (v6.2.6) completed\nCracked: 1/1 hashes',
            stderr: ''
          })
        }, 200)
        return { kill: vi.fn() } as any
      })

      // Create multiple jobs for same network
      const jobs = []
      for (let i = 0; i < 3; i++) {
        jobs.push(await createTestJob({
          userId: testUser.id,
          networkId: testNetwork.id,
          type: 'wordlist',
          status: 'pending'
        }))
      }

      // Execute concurrent attacks
      const results = await Promise.all(
        jobs.map(job =>
          runHashcatAttack({
            jobId: job.id,
            networkId: testNetwork.id,
            dictionaryId: 'test-concurrent-dict',
            handshakePath: `/tmp/concurrent_${job.id}.hc22000`,
            dictionaryPath: '/tmp/concurrent_wordlist.txt',
            attackMode: 'handshake',
            userId: testUser.id
          })
        )
      )

      expect(executionCalls.length).toBe(3)
      expect(results.every(result => result.success)).toBe(true)
      expect(results.every(result => result.passwordsFound >= 0)).toBe(true)
    })

    it('should handle attacks on different encryption types', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      mockExec.mockImplementation((command, callback) => {
        setTimeout(() => {
          callback(null, {
            stdout: 'hashcat (v6.2.6) completed',
            stderr: ''
          })
        }, 200)
        return { kill: vi.fn() } as any
      })

      // Mock networks with different encryption
      const encryptedNetworks = [
        await createTestNetworkCapture(TestDataFactory.createNetworkCapture({
          networks: [{
            ssid: 'WPA2_Network',
            bssid: '00:11:22:33:44:55',
            encryption: 'WPA2-PSK',
            hasHandshake: true
          }]
        })),
        await createTestNetworkCapture(TestDataFactory.createNetworkCapture({
          networks: [{
            ssid: 'WPA3_Network',
            bssid: 'aa:bb:cc:dd:ee',
            encryption: 'WPA3-PSK',
            hasPmkid: true,
            pmkid: 'test_wpa3_pmkid'
          }]
        })),
        await createTestNetworkCapture(TestDataFactory.createNetworkCapture({
          networks: [{
            ssid: 'WEP_Network',
            bssid: 'cc:dd:ee:ff:aa:bb',
            encryption: 'WEP',
            hasHandshake: true
          }]
        }))
      ]

      // Create jobs for each network
      const jobs = []
      for (let i = 0; i < encryptedNetworks.length; i++) {
        jobs.push(await createTestJob({
          userId: testUser.id,
          networkId: encryptedNetworks[i].id,
          type: 'wordlist',
          status: 'pending'
        }))
      }

      // Execute attacks
      const results = await Promise.all(
        jobs.map((job, index) =>
          runHashcatAttack({
            jobId: job.id,
            networkId: job.networkId,
            dictionaryId: 'test-multi-enc-dict',
            handshakePath: `/tmp/multi_enc_${index}.hc22000`,
            dictionaryPath: '/tmp/multi_enc_wordlist.txt',
            attackMode: 'handshake',
            userId: testUser.id
          })
        )
      )

      expect(results.every(result => result.success)).toBe(true)

      // Verify different modes were used based on encryption
      expect(executionCalls[1]).toContain('-m 22000') // WPA2
      expect(executionCalls[2]).toContain('-m 16800') // WPA3
      expect(executionCalls[3]).toContain('-m 2500') // WEP (if supported)
    })
  })
})