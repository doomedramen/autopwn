import { describe, it, expect, benchmark, beforeAll, afterAll } from 'vitest'
import { runHashcatAttack, buildHashcatCommand, parseHashcatOutput } from '../../workers/hashcat'
import { TestDataFactory } from '../../test/utils/test-data-factory'
import { SecurityTestData } from '@/test/utils/test-data-factory'

describe('Hashcat Performance Tests', () => {
  const testResults = new Map<string, any[]>()

  beforeAll(async () => {
    console.log('Setting up hashcat performance tests...')
    // Any global setup needed
  })

  afterAll(() => {
    console.log('Hashcat performance tests completed')
    // Report summary
    console.log('Performance Test Results Summary:')
    for (const [testName, results] of testResults.entries()) {
      const stats = calculateStats(results)
      console.log(`  ${testName}:`)
      console.log(`    Count: ${results.length}`)
      console.log(`    Avg: ${stats.avg.toFixed(2)}ms`)
      console.log(`    Min: ${stats.min.toFixed(2)}ms`)
      console.log(`    Max: ${stats.max.toFixed(2)}ms`)
      console.log(`    P95: ${stats.p95.toFixed(2)}ms`)
    }
  })

  function calculateStats(results: number[]) {
    if (results.length === 0) return { avg: 0, min: 0, max: 0, p95: 0 }

    const sorted = [...results].sort((a, b) => a - b)
    const sum = results.reduce((a, b) => a + b, 0)
    const avg = sum / results.length
    const p95Index = Math.floor(results.length * 0.95)
    const p95 = sorted[p95Index] || sorted[sorted.length - 1]

    return {
      avg,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95
    }
  }

  describe('Command Building Performance', () => {
    it('should build hashcat commands efficiently', async () => {
      const iterations = 100
      const commandTimes: number[] = []

      const results = await benchmark('hashcat-command-building', async () => {
        const start = performance.now()

        buildHashcatCommand({
          attackMode: 'handshake',
          handshakePath: `/tmp/test-${Date.now()}.hc22000`,
          dictionaryPath: `/tmp/wordlist-${Date.now()}.txt`,
          jobId: `perf-test-${Date.now()}`
        })

        const end = performance.now()
        return end - start
      }, { iterations })

      for (let i = 0; i < iterations; i++) {
        commandTimes.push(results[i])
      }

      const stats = calculateStats(commandTimes)

      expect(stats.avg).toBeLessThan(5) // Average should be under 5ms
      expect(stats.p95).toBeLessThan(10) // P95 should be under 10ms
      expect(stats.max).toBeLessThan(20) // Max should be under 20ms

      // Verify command structure correctness
      const lastCommand = commandTimes[commandTimes.length - 1]
      const command = buildHashcatCommand({
        attackMode: 'pmkid',
        handshakePath: '/tmp/perf-test.hc22000',
        dictionaryPath: '/tmp/perf-wordlist.txt',
        jobId: 'perf-last-test'
      })

      expect(command).toContain('hashcat')
      expect(command).toContain('-m 16800') // PMKID mode
      expect(command).toContain('-a 0') // Dictionary attack
      expect(command).toContain('--runtime=3600')
    })

    it('should handle complex command building efficiently', async () => {
      const iterations = 50
      const complexCommandTimes: number[] = []

      const results = await benchmark('complex-hashcat-commands', async () => {
        const start = performance.now()

        buildHashcatCommand({
          attackMode: 'handshake',
          handshakePath: '/very/long/path/to/network/capture/file/with/many/directories/test.hc22000',
          dictionaryPath: '/very/long/path/to/wordlist/file/with/many/directories/wordlist.txt',
          jobId: `complex-perf-test-${Date.now()}`
        })

        const end = performance.now()
        return end - start
      }, { iterations })

      for (let i = 0; i < iterations; i++) {
        complexCommandTimes.push(results[i])
      }

      const stats = calculateStats(complexCommandTimes)

      expect(stats.avg).toBeLessThan(10) // Average should be under 10ms
      expect(stats.p95).toBeLessThan(20) // P95 should be under 20ms
      expect(stats.max).toBeLessThan(30) // Max should be under 30ms
    })
  })

  describe('Hashcat Output Parsing Performance', () => {
    it('should parse hashcat output efficiently', async () => {
      const iterations = 100
      const parsingTimes: number[] = []

      // Mock different output sizes
      const outputs = [
        'hashcat output with 1 crack\nhash1:password1',
        'hashcat output with 10 cracks\n' + 'hash1:pass1\n'.repeat(10),
        'hashcat output with 100 cracks\n' + 'hash1:pass1\n'.repeat(100),
        'hashcat output with 1000 cracks\n' + 'hash1:pass1\n'.repeat(1000)
      ]

      const results = await benchmark('hashcat-output-parsing', async () => {
        const start = performance.now()

        // Simulate parsing (fast operation)
        for (let i = 0; i < 100; i++) {
          parseHashcatOutput({
            stdout: outputs[i % outputs.length],
            stderr: '',
            processingTime: Math.random() * 1000,
            exitCode: 0
          }, 'perf-test')
        }

        const end = performance.now()
        return end - start
      }, { iterations })

      for (let i = 0; i < iterations; i++) {
        parsingTimes.push(results[i])
      }

      const stats = calculateStats(parsingTimes)

      expect(stats.avg).toBeLessThan(2) // Average should be under 2ms
      expect(stats.p95).toBeLessThan(5) // P95 should be under 5ms
      expect(stats.max).toBeLessThan(10) // Max should be under 10ms
    })

    it('should handle large output parsing efficiently', async () => {
      const iterations = 10
      const largeParsingTimes: number[] = []

      const largeOutput = 'hashcat output with 10000 cracks\n' + 'hash1:pass1\n'.repeat(10000)

      const results = await benchmark('large-hashcat-output-parsing', async () => {
        const start = performance.now()

        parseHashcatOutput({
          stdout: largeOutput,
          stderr: '',
          processingTime: 5000,
          exitCode: 0
        }, 'large-perf-test')

        const end = performance.now()
        return end - start
      }, { iterations })

      for (let i = 0; i < iterations; i++) {
        largeParsingTimes.push(results[i])
      }

      const stats = calculateStats(largeParsingTimes)

      expect(stats.avg).toBeLessThan(20) // Average should be under 20ms for large output
      expect(stats.p95).toBeLessThan(50) // P95 should be under 50ms
      expect(stats.max).toBeLessThan(100) // Max should be under 100ms
    })
  })

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage during operations', async () => {
      const initialMemory = process.memoryUsage()
      const initialHeapUsed = Math.round(initialMemory.heapUsed / 1024 / 1024 * 100) / 100

      // Perform memory-intensive operations
      const operations = []
      for (let i = 0; i < 50; i++) {
        operations.push(
          buildHashcatCommand({
            attackMode: 'handshake',
            handshakePath: `/tmp/memory-test-${i}.hc22000`,
            dictionaryPath: `/tmp/memory-test-wordlist-${i}.txt`,
            jobId: `memory-test-${i}`
          })
        )
      }

      await Promise.all(operations)

      const finalMemory = process.memoryUsage()
      const finalHeapUsed = Math.round(finalMemory.heapUsed / 1024 / 1024 * 100) / 100
      const memoryIncrease = finalHeapUsed - initialHeapUsed

      // Memory increase should be reasonable (less than 10MB for 50 operations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // 10MB
    })
  })

  describe('End-to-End Performance', () => {
    it('should complete hashcat attack workflow efficiently', async () => {
      const iterations = 10
      const workflowTimes: number[] = []
      testResults.set('end-to-end-workflow', [])

      const results = await benchmark('complete-hashcat-workflow', async () => {
        const start = performance.now()

        // Simulate complete workflow
        const jobData = TestDataFactory.createJob({
          type: 'wordlist',
          hashcatMode: 22000,
          status: 'pending'
        })

        // Mock the entire workflow (command building + execution + parsing)
        await buildHashcatCommand({
          attackMode: 'handshake',
          handshakePath: '/tmp/e2e-test.hc22000',
          dictionaryPath: '/tmp/e2e-wordlist.txt',
          jobId: jobData.id
        })

        // Simulate hashcat execution
        parseHashcatOutput({
          stdout: 'hash1:password1\nhash2:password2\nhash3:password3',
          stderr: '',
          processingTime: 2000,
          exitCode: 0
        }, jobData.id)

        const end = performance.now()
        return end - start
      }, { iterations })

      for (let i = 0; i < iterations; i++) {
        workflowTimes.push(results[i])
        testResults.get('end-to-end-workflow')!.push(results[i])
      }

      const stats = calculateStats(workflowTimes)

      expect(stats.avg).toBeLessThan(100) // Average should be under 100ms
      expect(stats.p95).toBeLessThan(200) // P95 should be under 200ms
      expect(stats.max).toBeLessThan(500) // Max should be under 500ms
    })
  })

  describe('Resource Limit Performance', () => {
    it('should handle concurrent hashcat operations efficiently', async () => {
      const concurrentOperations = 20
      const concurrentTimes: number[] = []

      const results = await benchmark('concurrent-hashcat-operations', async () => {
        const start = performance.now()

        const operations = Array.from({ length: concurrentOperations }, (_, index) =>
          buildHashcatCommand({
            attackMode: 'pmkid',
            handshakePath: `/tmp/concurrent-test-${index}.hc22000`,
            dictionaryPath: `/tmp/concurrent-wordlist-${index}.txt`,
            jobId: `concurrent-test-${index}`
          })
        )

        await Promise.all(operations)

        const end = performance.now()
        return end - start
      }, { iterations: 10 })

      for (let i = 0; i < iterations; i++) {
        concurrentTimes.push(results[i])
      }

      const stats = calculateStats(concurrentTimes)

      expect(stats.avg).toBeLessThan(50) // Average should be under 50ms for concurrent
      expect(stats.p95).toBeLessThan(100) // P95 should be under 100ms
      expect(stats.max).toBeLessThan(200) // Max should be under 200ms
    })
  })
})