import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runHashcatAttack, parseHashcatOutput, checkHashcatAvailability } from '../../workers/hashcat'
import { TestDataFactory } from '../../test/utils/test-data-factory'

describe('Hashcat Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Hashcat Availability Check', () => {
    it('should detect hashcat availability', async () => {
            const mockExecInstanceInstance = mockExecInstance

      // Mock successful hashcat check
      mockExecInstance.mockImplementationOnce((command, callback) => {
        if (command.includes('--version')) {
          setTimeout(() => callback(null, { stdout: 'hashcat v6.2.6' }), 0)
        }
        return { kill: vi.fn() } as any
      })

      const result = await checkHashcatAvailability()

      expect(result.available).toBe(true)
      expect(result.version).toBe('hashcat v6.2.6')
    })

    it('should handle hashcat not available', async () => {
            const mockExecInstanceInstance = mockExecInstance

      // Mock hashcat not found
      mockExecInstance.mockImplementationOnce((command, callback) => {
        if (command.includes('--version')) {
          const error = new Error('Command not found: hashcat')
          callback(error, { stdout: '', stderr: 'hashcat: not found' })
        }
        return { kill: vi.fn() } as any
      })

      const result = await checkHashcatAvailability()

      expect(result.available).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('Hashcat Attack Execution', () => {
    it('should execute successful hashcat attack', async () => {
            const mockExecInstanceInstance = mockExecInstance
      
      // Mock file operations
      fsMock.mkdir = vi.fn().mockResolvedValue(undefined)
      fsMock.access = vi.fn().mockResolvedValue(true)
      fsMock.readFile = vi.fn().mockResolvedValue('hash1:password1\nhash2:password2\n')

      // Mock successful hashcat execution
      mockExecInstance.mockImplementationOnce((command, callback) => {
        setTimeout(() => {
          callback(null, {
            stdout: 'hashcat (v6.2.6) starting...\nRecovered: 1/1 hashes',
            stderr: ''
          })
        }, 100)
        return { kill: vi.fn() } as any
      })

      const jobData = TestDataFactory.createJob()
      const result = await runHashcatAttack({
        jobId: jobData.id,
        networkId: 'test-network-1',
        dictionaryId: 'test-dict-1',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        attackMode: 'handshake',
        userId: 'test-user-1'
      })

      expect(result.success).toBe(true)
      expect(result.passwordsFound).toBe(2)
      expect(result.passwords).toEqual([
        { password: 'hash1', plaintext: 'password1' },
        { password: 'hash2', plaintext: 'password2' }
      ])
    })

    it('should handle hashcat execution with no results', async () => {
            const mockExecInstanceInstance = mockExecInstance
      
      fsMock.mkdir = vi.fn().mockResolvedValue(undefined)
      fsMock.access = vi.fn().mockResolvedValue(false) // Output file doesn't exist

      mockExecInstance.mockImplementationOnce((command, callback) => {
        setTimeout(() => {
          callback(null, {
            stdout: 'hashcat (v6.2.6) starting...\nExhausted',
            stderr: ''
          })
        }, 100)
        return { kill: vi.fn() } as any
      })

      const jobData = TestDataFactory.createJob()
      const result = await runHashcatAttack({
        jobId: jobData.id,
        networkId: 'test-network-2',
        dictionaryId: 'test-dict-2',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        attackMode: 'handshake',
        userId: 'test-user-2'
      })

      expect(result.success).toBe(true)
      expect(result.passwordsFound).toBe(0)
      expect(result.message).toContain('No passwords found')
    })

    it('should handle hashcat execution errors', async () => {
            const mockExecInstanceInstance = mockExecInstance

      mockExecInstance.mockImplementationOnce((command, callback) => {
        setTimeout(() => {
          callback(new Error('hashcat: invalid option'), {
            stdout: '',
            stderr: 'hashcat: invalid option --invalid-flag'
          })
        }, 100)
        return { kill: vi.fn() } as any
      })

      const jobData = TestDataFactory.createJob()

      await expect(runHashcatAttack({
        jobId: jobData.id,
        networkId: 'test-network-3',
        dictionaryId: 'test-dict-3',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        attackMode: 'handshake',
        userId: 'test-user-3'
      })).rejects.toThrow()
    })

    it('should handle hashcat timeout', async () => {
            const mockExecInstanceInstance = mockExecInstance

      mockExecInstance.mockImplementationOnce((command, callback) => {
        const error = new Error('Command timeout')
        error.name = 'TimeoutError'
        setTimeout(() => callback(error), 100)
        return { kill: vi.fn() } as any
      })

      const jobData = TestDataFactory.createJob()

      await expect(runHashcatAttack({
        jobId: jobData.id,
        networkId: 'test-network-4',
        dictionaryId: 'test-dict-4',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        attackMode: 'handshake',
        userId: 'test-user-4'
      })).rejects.toThrow('Command timeout')
    })
  })

  describe('Hashcat Output Parsing', () => {
    it('should parse successful hashcat output', async () => {
      
      // Mock successful output file
      fsMock.access = vi.fn().mockResolvedValue(true)
      fsMock.readFile = vi.fn().mockResolvedValue('WPA*01*test_ssid*00:11:22:33:44:55*password1\nWPA*02*another_ssid*00:aa:bb:cc:dd:ee*password2\n')

      const result = await parseHashcatOutput({
        stdout: 'hashcat (v6.2.6) completed',
        stderr: '',
        processingTime: 5000,
        exitCode: 0
      }, 'test-job-output')

      expect(result.success).toBe(true)
      expect(result.cracked).toBe(2)
      expect(result.total).toBe(2)
      expect(result.passwords).toEqual([
        {
          ssid: 'test_ssid',
          bssid: '00:11:22:33:44:55',
          password: 'password1'
        },
        {
          ssid: 'another_ssid',
          bssid: 'aa:bb:cc:dd:ee',
          password: 'password2'
        }
      ])
    })

    it('should parse hashcat output with no cracks', async () => {
      
      fsMock.access = vi.fn().mockResolvedValue(true)
      fsMock.readFile = vi.fn().mockResolvedValue('')

      const result = await parseHashcatOutput({
        stdout: 'hashcat (v6.2.6) completed\nExhausted',
        stderr: '',
        processingTime: 30000,
        exitCode: 1
      }, 'test-job-no-cracks')

      expect(result.success).toBe(true)
      expect(result.cracked).toBe(0)
      expect(result.passwords).toEqual([])
    })

    it('should handle corrupted output file', async () => {
      
      fsMock.access = vi.fn().mockResolvedValue(true)
      fsMock.readFile = vi.fn().mockResolvedValue('invalid output data\nmore invalid')

      const result = await parseHashcatOutput({
        stdout: 'hashcat (v6.2.6) completed',
        stderr: '',
        processingTime: 1000,
        exitCode: 0
      }, 'test-job-corrupt')

      expect(result.success).toBe(true)
      expect(result.cracked).toBe(0) // Should default to 0 on parse errors
      expect(result.passwords).toEqual([])
    })

    it('should handle missing output file', async () => {
      
      fsMock.access = vi.fn().mockRejectedValue(new Error('ENOENT'))
      fsMock.readFile = vi.fn()

      const result = await parseHashcatOutput({
        stdout: 'hashcat (v6.2.6) completed',
        stderr: '',
        processingTime: 1000,
        exitCode: 0
      }, 'test-job-missing-file')

      expect(result.success).toBe(true)
      expect(result.cracked).toBe(0)
      expect(result.passwords).toEqual([])
    })
  })

  describe('Working Directory Management', () => {
    it('should create job-specific working directory', async () => {
      
      fsMock.mkdir = vi.fn().mockResolvedValue(undefined)

      const jobData = TestDataFactory.createJob({ id: 'job-123' })

      await runHashcatAttack({
        jobId: jobData.id,
        networkId: 'test-network-1',
        dictionaryId: 'test-dict-1',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        attackMode: 'handshake',
        userId: 'test-user-1'
      })

      expect(fsMock.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('temp/hashcat/job-123'),
        { recursive: true }
      )
    })

    it('should handle directory creation errors', async () => {
      
      fsMock.mkdir = vi.fn().mockRejectedValue(new Error('Permission denied'))

      const jobData = TestDataFactory.createJob({ id: 'job-456' })

      await expect(runHashcatAttack({
        jobId: jobData.id,
        networkId: 'test-network-1',
        dictionaryId: 'test-dict-1',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        attackMode: 'handshake',
        userId: 'test-user-1'
      })).rejects.toThrow('Permission denied')
    })
  })
})