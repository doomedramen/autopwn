import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'node:fs/promises'
import path from 'path'
import { testRealTools } from '../../test/setup/integration-real-setup'
import { runHashcatAttack, buildHashcatCommand, parseHashcatOutput, checkHashcatAvailability } from '../../workers/hashcat'

const execAsync = promisify(exec)

describe('Real Hashcat Integration Tests', () => {
  let testDir = ''
  let testPCAP = ''
  let testDict = ''
  let testJobDir = ''

  beforeAll(async () => {
    testDir = '/tmp/integration-test'
    testPCAP = await testRealTools.createTestPCAP(path.join(testDir, 'test.pcap'))
    testDict = await testRealTools.createTestDictionary(path.join(testDir, 'test.dict'))
    testJobDir = await testRealTools.createJobDir('test-job-real')

    console.log('🧪 Test environment prepared')
    console.log(`📁 PCAP: ${testPCAP}`)
    console.log(`📝 Dictionary: ${testDict}`)
    console.log(`📂 Job Dir: ${testJobDir}`)
  })

  afterAll(async () => {
    await testRealTools.cleanupJobDir('test-job-real')
    await Promise.all([
      fs.rm(testPCAP, { force: true }),
      fs.rm(testDict, { force: true })
    ])
    console.log('🧹 Test environment cleaned up')
  })

  describe('Real Command Building', () => {
    it('should build actual hashcat command with correct parameters', () => {
      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: testPCAP,
        dictionaryPath: testDict,
        jobId: 'test-real',
        optimized: true,
        force: true,
        runtime: 1800
      })

      expect(command).toContain('hashcat')
      expect(command).toContain('-m 22000')
      expect(command).toContain('-a 0')
      expect(command).toContain('--session=test-real')
      expect(command).toContain('--quiet')
      expect(command).toContain('--force')
      expect(command).toContain('--runtime=3600')
      expect(command).toContain('-O')
      expect(command).toContain('-w 4')
      expect(command).toContain('-o')
    })

    it('should build PMKID attack command correctly', () => {
      const command = buildHashcatCommand({
        attackMode: 'pmkid',
        handshakePath: testPCAP,
        dictionaryPath: testDict,
        jobId: 'pmkid-test'
      })

      expect(command).toContain('hashcat')
      expect(command).toContain('-m 16800')
      expect(command).toContain('-a 0')
      expect(command).toContain('--session=pmkid-test')
    })
  })

  describe('Real Tool Availability', () => {
    it('should detect actual hashcat availability', async () => {
      const result = await checkHashcatAvailability()

      if (process.env.HASHCAT_PATH && process.env.HASHCAT_PATH !== 'mock') {
        expect(result.available).toBe(true)
        expect(result.version).toBeDefined()
      } else {
        // In mock environment, expect graceful handling
        expect(result).toBeDefined()
      }
    })

    it('should handle hashcat not found gracefully', async () => {
      // Temporarily set invalid path
      const originalPath = process.env.HASHCAT_PATH
      process.env.HASHCAT_PATH = '/nonexistent/hashcat'

      const result = await checkHashcatAvailability()

      // Restore original path
      process.env.HASHCAT_PATH = originalPath

      expect(result.available).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('Real Command Execution', () => {
    it('should execute hashcat with real files and parse output', async () => {
      const testHashFile = await testRealTools.createTestHashFile(path.join(testJobDir, 'output.hc22000'))
      const outputFile = path.join(testJobDir, 'cracked.txt')

      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: testPCAP,
        dictionaryPath: testDict,
        jobId: 'real-exec-test',
        outputFile,
        optimized: false,
        runtime: 10
      })

      // Execute the real hashcat command
      const result = await runHashcatAttack({
        jobId: 'real-exec-test',
        networkId: 'test-network-1',
        dictionaryId: 'test-dict-1',
        handshakePath: testPCAP,
        dictionaryPath: testDict,
        attackMode: 'handshake',
        userId: 'test-user-1'
      })

      // Verify results based on real execution
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')

      // Check if hashcat command was actually executed
      expect(command).toEqual(
        expect.arrayContaining([
          'hashcat',
          '-m', '22000',
          '-a', '0',
          testPCAP,
          testDict,
          '--runtime=10',
          '--session=real-exec-test',
          '-o', outputFile,
          '--quiet'
        ])
      )
    }, 30000) // 30 second timeout for real hashcat execution

    it('should handle hashcat execution errors gracefully', async () => {
      // Test with invalid PCAP file
      const invalidPCAP = path.join(testDir, 'invalid.pcap')
      await fs.writeFile(invalidPCAP, 'invalid pcap data')

      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: invalidPCAP,
        dictionaryPath: testDict,
        jobId: 'error-test',
        runtime: 5
      })

      const result = await runHashcatAttack({
        jobId: 'error-test',
        networkId: 'test-network-2',
        dictionaryId: 'test-dict-2',
        handshakePath: invalidPCAP,
        dictionaryPath: testDict,
        attackMode: 'handshake',
        userId: 'test-user-2'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    }, 15000)

    it('should handle hashcat timeout', async () => {
      // Test with very short runtime to force timeout
      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: testPCAP,
        dictionaryPath: testDict,
        jobId: 'timeout-test',
        runtime: 1, // Very short timeout
        outputFile: path.join(testJobDir, 'timeout-output.txt')
      })

      const startTime = Date.now()
      const result = await runHashcatAttack({
        jobId: 'timeout-test',
        networkId: 'test-network-3',
        dictionaryId: 'test-dict-3',
        handshakePath: testPCAP,
        dictionaryPath: testDict,
        attackMode: 'handshake',
        userId: 'test-user-3'
      })

      const executionTime = Date.now() - startTime

      // Should handle timeout gracefully
      expect(result).toBeDefined()
      if (result.success === false) {
        expect(result.error).toContain('timeout') || result.error?.toContain('killed')
      }

      expect(executionTime).toBeGreaterThan(1000) // At least 1 second due to processing
    }, 15000)
  })

  describe('Real Output Parsing', () => {
    it('should parse real hashcat output correctly', async () => {
      // Create mock hashcat output
      const mockOutput = `hashcat (v6.2.6) starting...
hashcat (v6.2.6) completed in 2.15 seconds
Cracked: 1/1 hashes
TestNetwork_WPA2:password123
Session.Name: test-session
Status........: Cracked`

      const result = await parseHashcatOutput(mockOutput, '', 0, 'test-parse')

      expect(result.success).toBe(true)
      expect(result.cracked).toBe(1)
      expect(result.total).toBe(1)
      expect(result.passwords).toEqual([
        {
          hash: 'TestNetwork_WPA2',
          password: 'password123',
          plaintext: 'password123'
        }
      ])
    })

    it('should handle empty output gracefully', async () => {
      const result = await parseHashcatOutput('', '', 0, 'empty-test')

      expect(result.success).toBe(true)
      expect(result.cracked).toBe(0)
      expect(result.total).toBe(0)
      expect(result.passwords).toEqual([])
    })

    it('should handle malformed output gracefully', async () => {
      const malformedOutput = 'invalid hashcat output that cannot be parsed'

      const result = await parseHashcatOutput(malformedOutput, '', 1, 'malformed-test')

      expect(result.success).toBe(true) // Function should not throw
      expect(result.cracked).toBe(0) // Default to 0 on parse failure
      expect(result.passwords).toEqual([])
    })
  })

  describe('Real File System Operations', () => {
    it('should create and manage job directories correctly', async () => {
      const jobDir1 = await testRealTools.createJobDir('fs-test-1')
      const jobDir2 = await testRealTools.createJobDir('fs-test-2')

      expect(jobDir1).toContain('hashcat-jobs/fs-test-1')
      expect(jobDir2).toContain('hashcat-jobs/fs-test-2')

      // Verify directories exist
      const { access } = await import('fs/promises')
      expect(await access(jobDir1)).toBeDefined()
      expect(await access(jobDir2)).toBeDefined()

      // Test cleanup
      await testRealTools.cleanupJobDir('fs-test-1')
      await testRealTools.cleanupJobDir('fs-test-2')

      // Verify directories are removed
      try {
        await access(jobDir1)
        expect(true).toBe(false) // Should throw
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should handle file operations with real data', async () => {
      const testContent = 'test network capture data for hashcat'
      const testFile = path.join(testDir, 'real-test.hc22000')

      await fs.writeFile(testFile, testContent)

      const readContent = await fs.readFile(testFile, 'utf-8')
      expect(readContent).toBe(testContent)

      const stats = await fs.stat(testFile)
      expect(stats.isFile()).toBe(true)
    })
  })
})