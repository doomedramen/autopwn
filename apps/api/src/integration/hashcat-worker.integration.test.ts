import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  runHashcatAttack,
  cleanupHashcatTemp,
  checkHashcatAvailability
} from '../../workers/hashcat'
import { testDb, createTestJob, createTestUser } from '@/test/utils/test-utils'
import { TestDataFactory } from '@/test/utils/test-data-factory'
import { eq } from 'drizzle-orm'

// Mock child_process for testing
vi.mock('child_process', () => ({
  exec: vi.fn()
}))

vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(true),
    readFile: vi.fn().mockResolvedValue('hash1:password1\nhash2:password2\n'),
    rm: vi.fn().mockResolvedValue(undefined)
  }
}))

describe('Hashcat Worker Integration Tests', () => {
  let testUser: any
  let testJob: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Create test data
    testUser = await createTestUser(TestDataFactory.createUser())
    testJob = await createTestJob(TestDataFactory.createJob({
      userId: testUser.id
    }))
  })

  afterEach(async () => {
    vi.clearAllMocks()
  })

  describe('Hashcat Attack Execution', () => {
    it('should successfully run PMKID attack and find passwords', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      // Mock successful hashcat execution
      mockExec.mockImplementation((command: string, callback: any) => {
        // Simulate async execution
        setTimeout(() => {
          callback(null, {
            stdout: 'hashcat (v6.2.6) starting...',
            stderr: ''
          })
        }, 100)
        return { kill: vi.fn() } as any
      })

      const result = await runHashcatAttack({
        jobId: testJob.id,
        networkId: 'test-network-1',
        dictionaryId: 'test-dict-1',
        handshakePath: '/tmp/test.pcap',
        dictionaryPath: '/tmp/dict.txt',
        attackMode: 'pmkid',
        userId: testUser.id
      })

      expect(result.success).toBe(true)
      expect(result.passwordsFound).toBeGreaterThan(0)

      // Verify job was updated
      const updatedJob = await testDb.query.jobs.findFirst({
        where: eq(jobs.id, testJob.id)
      })
      expect(updatedJob?.status).toBe('completed')
      expect(updatedJob?.passwordFound).toBe(true)
    })

    it('should successfully run handshake attack and find no passwords', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      // Mock successful execution with no results
      mockExec.mockImplementation((command: string, callback: any) => {
        setTimeout(() => {
          callback(null, {
            stdout: 'hashcat (v6.2.6) starting...\nExhausted',
            stderr: ''
          })
        }, 100)
        return { kill: vi.fn() } as any
      })

      // Mock empty output file
      const { promises: fs } = await import('fs')
      vi.mocked(fs.readFile).mockResolvedValue('')

      const result = await runHashcatAttack({
        jobId: testJob.id,
        networkId: 'test-network-2',
        dictionaryId: 'test-dict-2',
        handshakePath: '/tmp/test.pcap',
        dictionaryPath: '/tmp/dict.txt',
        attackMode: 'handshake',
        userId: testUser.id
      })

      expect(result.success).toBe(true)
      expect(result.passwordsFound).toBe(0)
      expect(result.message).toContain('No passwords found')
    })

    it('should handle hashcat execution errors gracefully', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      // Mock hashcat error
      mockExec.mockImplementation((command: string, callback: any) => {
        setTimeout(() => {
          callback(new Error('hashcat: command not found'), {
            stdout: '',
            stderr: 'hashcat: command not found'
          })
        }, 100)
        return { kill: vi.fn() } as any
      })

      await expect(runHashcatAttack({
        jobId: testJob.id,
        networkId: 'test-network-3',
        dictionaryId: 'test-dict-3',
        handshakePath: '/tmp/test.pcap',
        dictionaryPath: '/tmp/dict.txt',
        attackMode: 'handshake',
        userId: testUser.id
      })).rejects.toThrow()

      // Verify job was marked as failed
      const updatedJob = await testDb.query.jobs.findFirst({
        where: eq(jobs.id, testJob.id)
      })
      expect(updatedJob?.status).toBe('failed')
    })

    it('should handle timeout scenarios', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      // Mock timeout
      mockExec.mockImplementation((command: string, callback: any) => {
        setTimeout(() => {
          const error = new Error('Command timeout')
          error.name = 'TimeoutError'
          callback(error, { stdout: '', stderr: '' })
        }, 100)
        return { kill: vi.fn() } as any
      })

      await expect(runHashcatAttack({
        jobId: testJob.id,
        networkId: 'test-network-4',
        dictionaryId: 'test-dict-4',
        handshakePath: '/tmp/test.pcap',
        dictionaryPath: '/tmp/dict.txt',
        attackMode: 'handshake',
        userId: testUser.id
      })).rejects.toThrow()
    })
  })

  describe('Database Integration', () => {
    it('should save job results correctly', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      mockExec.mockImplementation((command: string, callback: any) => {
        setTimeout(() => {
          callback(null, {
            stdout: 'hashcat execution completed',
            stderr: ''
          })
        }, 100)
        return { kill: vi.fn() } as any
      })

      await runHashcatAttack({
        jobId: testJob.id,
        networkId: 'test-network-5',
        dictionaryId: 'test-dict-5',
        handshakePath: '/tmp/test.pcap',
        dictionaryPath: '/tmp/dict.txt',
        attackMode: 'handshake',
        userId: testUser.id
      })

      // Check job results were saved
      const results = await testDb.query.jobResults.findMany({
        where: eq(jobResults.jobId, testJob.id)
      })
      expect(results.length).toBe(2) // Based on our mock output
    })

    it('should update network status when passwords are found', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      mockExec.mockImplementation((command: string, callback: any) => {
        setTimeout(() => {
          callback(null, {
            stdout: 'hashcat execution completed',
            stderr: ''
          })
        }, 100)
        return { kill: vi.fn() } as any
      })

      await runHashcatAttack({
        jobId: testJob.id,
        networkId: 'test-network-6',
        dictionaryId: 'test-dict-6',
        handshakePath: '/tmp/test.pcap',
        dictionaryPath: '/tmp/dict.txt',
        attackMode: 'handshake',
        userId: testUser.id
      })

      // Check network was updated
      const network = await testDb.query.networks.findFirst({
        where: eq(networks.id, 'test-network-6')
      })
      expect(network?.status).toBe('cracked')
      expect(network?.crackedPassword).toBe('password1')
    })
  })

  describe('Command Building', () => {
    it('should build correct PMKID attack command', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      let capturedCommand = ''
      mockExec.mockImplementation((command: string, callback: any) => {
        capturedCommand = command
        setTimeout(() => {
          callback(null, { stdout: '', stderr: '' })
        }, 10)
        return { kill: vi.fn() } as any
      })

      await runHashcatAttack({
        jobId: 'test-job-pmkid',
        networkId: 'test-network',
        dictionaryId: 'test-dict',
        handshakePath: '/tmp/test.pcap',
        dictionaryPath: '/tmp/dict.txt',
        attackMode: 'pmkid',
        userId: testUser.id
      })

      expect(capturedCommand).toContain('-m 16800') // PMKID mode
      expect(capturedCommand).toContain('-a 0') // Dictionary attack
      expect(capturedCommand).toContain('/tmp/test.pcap')
      expect(capturedCommand).toContain('/tmp/dict.txt')
    })

    it('should build correct handshake attack command', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      let capturedCommand = ''
      mockExec.mockImplementation((command: string, callback: any) => {
        capturedCommand = command
        setTimeout(() => {
          callback(null, { stdout: '', stderr: '' })
        }, 10)
        return { kill: vi.fn() } as any
      })

      await runHashcatAttack({
        jobId: 'test-job-handshake',
        networkId: 'test-network',
        dictionaryId: 'test-dict',
        handshakePath: '/tmp/test.pcap',
        dictionaryPath: '/tmp/dict.txt',
        attackMode: 'handshake',
        userId: testUser.id
      })

      expect(capturedCommand).toContain('-m 22000') // Handshake mode
      expect(capturedCommand).toContain('-a 0') // Dictionary attack
      expect(capturedCommand).toContain('/tmp/test.pcap')
      expect(capturedCommand).toContain('/tmp/dict.txt')
    })
  })

  describe('File Management', () => {
    it('should clean up temporary files after job completion', async () => {
      const jobId = 'test-cleanup-job'

      await cleanupHashcatTemp(jobId)

      const { promises: fs } = await import('fs')
      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining(jobId),
        { recursive: true, force: true }
      )
    })

    it('should handle cleanup errors gracefully', async () => {
      const { promises: fs } = await import('fs')
      const mockRm = vi.mocked(fs.rm)

      mockRm.mockRejectedValue(new Error('Permission denied'))

      // Should not throw error
      await expect(cleanupHashcatTemp('test-job')).resolves.not.toThrow()
    })
  })

  describe('Hashcat Availability Check', () => {
    it('should return success when hashcat is available', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      mockExec.mockImplementation((command: string, callback: any) => {
        if (command.includes('--version')) {
          setTimeout(() => {
            callback(null, {
              stdout: 'hashcat v6.2.6',
              stderr: ''
            })
          }, 50)
        }
        return { kill: vi.fn() } as any
      })

      const result = await checkHashcatAvailability()

      expect(result.available).toBe(true)
      expect(result.version).toBe('hashcat v6.2.6')
    })

    it('should return failure when hashcat is not available', async () => {
      const { exec } = await import('child_process')
      const mockExec = vi.mocked(exec)

      mockExec.mockImplementation((command: string, callback: any) => {
        if (command.includes('--version')) {
          setTimeout(() => {
            callback(new Error('Command not found: hashcat'), {
              stdout: '',
              stderr: 'hashcat: not found'
            })
          }, 50)
        }
        return { kill: vi.fn() } as any
      })

      const result = await checkHashcatAvailability()

      expect(result.available).toBe(false)
      expect(result.error).toContain('not found')
    })
  })
})