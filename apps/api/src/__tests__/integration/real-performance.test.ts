import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import path from 'path'
import * as fs from 'fs/promises'
import { testRealTools } from '../../test/setup/integration-real-setup'
import { runHashcatAttack, checkHashcatAvailability } from '../../workers/hashcat'
import { TestDataFactory } from '../../test/utils/test-data-factory'

describe('Real Performance Tests', () => {
  let testDir = ''

  beforeAll(async () => {
    testDir = '/tmp/performance-test'
    await Promise.all([
      testRealTools.createTestDictionary(path.join(testDir, 'performance.dict'), [
        'password123', 'password456', 'password789', 'password000', 'password111',
        'password222', 'password333', 'password444', 'password555', 'password666',
        'password777', 'password888', 'password999', 'password1000', 'password1001',
        'password1002', 'password1003', 'password1004', 'password1005', 'password1006',
        'password1007', 'password1008', 'password1009', 'password2000', 'password2001'
      ]),
      testRealTools.createTestPCAP(path.join(testDir, 'small.pcap'), 'small test data'),
      testRealTools.createTestPCAP(path.join(testDir, 'medium.pcap'), Buffer.alloc(5 * 1024 * 1024)), // 5MB
      testRealTools.createTestPCAP(path.join(testDir, 'large.pcap'), Buffer.alloc(25 * 1024 * 1024)) // 25MB
    ])

    console.log('🚀 Performance test environment prepared')
    console.log(`📖 Dictionary: ${path.join(testDir, 'performance.dict')} (${25} passwords)`)
    console.log(`📁 Small PCAP: ${path.join(testDir, 'small.pcap')}`)
    console.log(`📁 Medium PCAP: ${path.join(testDir, 'medium.pcap')} (5MB)`)
    console.log(`📁 Large PCAP: ${path.join(testDir, 'large.pcap')} (25MB)`)
  })

  afterAll(async () => {
    await Promise.all([
      fs.rm(path.join(testDir, 'small.pcap'), { force: true }),
      fs.rm(path.join(testDir, 'medium.pcap'), { force: true }),
      fs.rm(path.join(testDir, 'large.pcap'), { force: true }),
      fs.rm(path.join(testDir, 'performance.dict'), { force: true })
    ])

    console.log('🧹 Performance test environment cleaned up')
  })

  describe('Hashcat Performance Benchmarks', () => {
    it('should process small dictionary attack quickly', async () => {
      const startTime = performance.now()

      const result = await runHashcatAttack({
        jobId: 'perf-small',
        networkId: 'perf-network-1',
        dictionaryId: 'perf-dict-1',
        handshakePath: path.join(testDir, 'small.hc22000'),
        attackMode: 'handshake',
        userId: 'test-user-perf'
      }, 30000)

      const processingTime = performance.now() - startTime
      const passwordsPerSecond = 25 / (processingTime / 1000)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(processingTime).toBeLessThan(10000) // Should complete within 10 seconds
      expect(passwordsPerSecond).toBeGreaterThan(2) // Should process at least 2 passwords/second
    }, 60000)

    it('should handle medium dataset efficiently', async () => {
      const startTime = performance.now()

      // Create medium HC22000 file
      const mediumHC22000 = path.join(testDir, 'medium.hc22000')
      await fs.writeFile(mediumHC22000,
        Array(100).fill(0).map((_, i) =>
          `WPA*01*PerfNetwork${i.toString().padStart(2, '0')}*00*11:22:33:44:55*00:11:22:33:44:55*a:b:c:d:e:f:password${i.toString().padStart(4, '0')}`
        ).join('\n')
      )

      const result = await runHashcatAttack({
        jobId: 'perf-medium',
        networkId: 'perf-network-2',
        dictionaryId: 'perf-dict-2',
        handshakePath: mediumHC22000,
        attackMode: 'handshake',
        userId: 'test-user-perf'
      }, 45000) // 45 second timeout

      const processingTime = performance.now() - startTime
      const hashesPerSecond = 100 / (processingTime / 1000)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(processingTime).toBeLessThan(40000) // Should complete within 40 seconds
      expect(hashesPerSecond).toBeGreaterThan(2.5) // Should process at least 2.5 hashes/second
    }, 90000)

    it('should process large dataset within reasonable time', async () => {
      const startTime = performance.now()

      // Create large HC22000 file (100 hashes)
      const largeHC22000 = path.join(testDir, 'large.hc22000')
      await fs.writeFile(largeHC22000,
        Array(100).fill(0).map((_, i) =>
          `WPA*01*PerfNetwork${i.toString().padStart(2, '0')}*00*11:22:33:44:55*00:11:22:33:44:55*a:b:c:d:e:f:password${i.toString().padStart(4, '0')}`
        ).join('\n')
      )

      const result = await runHashcatAttack({
        jobId: 'perf-large',
        networkId: 'perf-network-3',
        dictionaryId: 'perf-dict-3',
        handshakePath: largeHC22000,
        attackMode: 'handshake',
        userId: 'test-user-perf'
      }, 120000) // 2 minute timeout for large dataset

      const processingTime = performance.now() - startTime
      const hashesPerSecond = 100 / (processingTime / 1000)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(processingTime).toBeLessThan(120000) // Should complete within 2 minutes
      expect(hashesPerSecond).toBeGreaterThan(1.5) // Should process at least 1.5 hashes/second
    }, 180000)

    it('should handle concurrent attacks efficiently', async () => {
      const startTime = performance.now()

      // Prepare multiple attack jobs
      const smallHC22000_1 = path.join(testDir, 'concurrent1.hc22000')
      const smallHC22000_2 = path.join(testDir, 'concurrent2.hc22000')

      await fs.writeFile(smallHC22000_1,
        Array(10).fill(0).map((_, i) =>
          `WPA*01*Concurrent${i}*00*11:22:33:44:55*00:11:22:33:44:55*a:b:c:d:e:f:password${i.toString().padStart(4, '0')}`
        ).join('\n')
      )

      await fs.writeFile(smallHC22000_2,
        Array(10).fill(0).map((_, i) =>
          `WPA*01*Concurrent${i}*00*11:22:33:44:55*00:11:22:33:44:55*a:b:c:d:e:f:password${i.toString().padStart(4, '0')}`
        ).join('\n')
      )

      // Run concurrent attacks
      const results = await Promise.all([
        runHashcatAttack({
          jobId: 'concurrent-job-1',
          networkId: 'concurrent-network-1',
          dictionaryId: 'perf-dict-concurrent',
          handshakePath: smallHC22000_1,
          attackMode: 'handshake',
          userId: 'test-user-concurrent'
        }, 60000),
        runHashcatAttack({
          jobId: 'concurrent-job-2',
          networkId: 'concurrent-network-2',
          dictionaryId: 'perf-dict-concurrent',
          handshakePath: smallHC22000_2,
          attackMode: 'handshake',
          userId: 'test-user-concurrent'
        }, 60000),
        runHashcatAttack({
          jobId: 'concurrent-job-3',
          networkId: 'concurrent-network-3',
          dictionaryId: 'perf-dict-concurrent',
          handshakePath: smallHC22000_1, // Reuse first file
          attackMode: 'handshake',
          userId: 'test-user-concurrent'
        }, 60000)
      ])

      const totalProcessingTime = performance.now() - startTime
      const totalHashesProcessed = results.reduce((total, result) =>
        total + (result.passwordsFound || 0), 0
      )

      expect(results.every(result => result?.success !== false)).toBe(true)
      expect(totalProcessingTime).toBeLessThan(90000) // Should complete all within 1.5 minutes
      expect(totalHashesProcessed).toBe(30) // 10 hashes × 3 jobs
    }, 180000)
  })

  describe('Memory Usage', () => {
    it('should not exceed memory limits with large datasets', async () => {
      const startTime = performance.now()
      const startMemory = process.memoryUsage()

      // Very large dataset (500 hashes)
      const veryLargeHC22000 = path.join(testDir, 'very-large.hc22000')
      await fs.writeFile(veryLargeHC22000,
        Array(500).fill(0).map((_, i) =>
          `WPA*01*MemTest${i}*00*11:22:33:44:55*a:b:c:d:e:f:password${i.toString().padStart(6, '0')}`
        ).join('\n')
      )

      const result = await runHashcatAttack({
        jobId: 'memory-test',
        networkId: 'memory-network',
        dictionaryId: 'memory-dict',
        handshakePath: veryLargeHC22000,
        attackMode: 'handshake',
        userId: 'test-user-memory'
      }, 180000)

      const endMemory = process.memoryUsage()
      const processingTime = performance.now() - startTime
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(processingTime).toBeLessThan(120000) // Should complete within 2 minutes
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Should not exceed 100MB additional memory
    }, 180000)

    it('should clean up resources properly', async () => {
      const startMemory = process.memoryUsage()

      const result = await runHashcatAttack({
        jobId: 'cleanup-test',
        networkId: 'cleanup-network',
        dictionaryId: 'cleanup-dict',
        handshakePath: path.join(testDir, 'cleanup-test.hc22000'),
        attackMode: 'handshake',
        userId: 'test-user-cleanup'
      }, 60000)

      // Allow some time for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000))

      const endMemory = process.memoryUsage()
      const memoryLeak = endMemory.heapUsed - startMemory.heapUsed

      expect(result).toBeDefined()
      expect(memoryLeak).toBeLessThan(10 * 1024 * 1024) // Should not leak more than 10MB
    }, 30000)
  })
})