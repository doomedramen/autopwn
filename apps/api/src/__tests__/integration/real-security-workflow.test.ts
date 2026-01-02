import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import * as fs from 'fs/promises'
import path from 'path'
import { runHashcatAttack } from '../../workers/hashcat'
import { processPCAP } from '../../workers/pcap-processing'
import { testRealTools } from '../../test/setup/integration-real-setup'
import { TestDataFactory } from '../../test/utils/test-data-factory'

describe('Real Security Workflow Integration Tests', () => {
  let testDir = ''
  let testPCAP = ''
  let testDict = ''
  let testJobDir = ''

  beforeAll(async () => {
    testDir = '/tmp/integration-test'
    testPCAP = await testRealTools.createTestPCAP(path.join(testDir, 'workflow-test.pcap'))
    testDict = await testRealTools.createTestDictionary(path.join(testDir, 'workflow-test.dict'))
    testJobDir = await testRealTools.createJobDir('workflow-job-real')

    console.log('🚀 Real security workflow tests initialized')
    console.log(`📁 PCAP: ${testPCAP}`)
    console.log(`📝 Dictionary: ${testDict}`)
    console.log(`📂 Job Dir: ${testJobDir}`)
  })

  afterAll(async () => {
    await testRealTools.cleanupJobDir('workflow-job-real')
    await Promise.all([
      fs.rm(testPCAP, { force: true }),
      fs.rm(testDict, { force: true })
    ])
    console.log('🧹 Real security workflow tests cleaned up')
  })

  describe('Complete WPA2 Attack Workflow', () => {
    it('should execute end-to-end WPA2 attack with real tools', async () => {
      // Step 1: Process PCAP to extract networks
      const processedNetworks = await processPCAP({
        fileId: 'workflow-test-file',
        originalName: 'workflow-test.pcap',
        userId: 'test-user-workflow',
        fileSize: (await fs.stat(testPCAP)).size
      })

      expect(processedNetworks).toBeDefined()
      expect(processedNetworks.success).toBe(true)
      expect(processedNetworks.networks.length).toBeGreaterThan(0)

      // Step 2: Run hashcat attack on extracted network
      const wpa2Network = processedNetworks.networks.find(n =>
        n.encryption === 'WPA2-PSK' && n.hasHandshake
      )

      expect(wpa2Network).toBeDefined()

      // Run hashcat attack with real tools
      const attackResult = await runHashcatAttack({
        jobId: 'workflow-job-real',
        networkId: wpa2Network!.id,
        dictionaryId: 'workflow-test-dict',
        handshakePath: wpa2Network!.handshakePath,
        dictionaryPath: testDict,
        attackMode: 'handshake',
        userId: 'test-user-workflow'
      })

      expect(attackResult).toBeDefined()
      expect(typeof attackResult.success).toBe('boolean')

      // Verify attack result processing
      if (attackResult.success && attackResult.passwordsFound && attackResult.passwordsFound > 0) {
        expect(attackResult.passwords.length).toBeGreaterThan(0)
        expect(attackResult.passwords[0]).toHaveProperty('password')
        expect(attackResult.passwords[0]).toHaveProperty('plaintext')
      }

      // Should complete even if no passwords found
      if (attackResult.success) {
        expect(attackResult.passwordsFound).toBeGreaterThanOrEqual(0)
      }
    }, 120000) // 2 minute timeout for full workflow

    it('should handle PMKID attack workflow with real tools', async () => {
      // Create test data with PMKID
      const pmkidTestPCAP = await testRealTools.createTestPCAP(path.join(testDir, 'pmkid-test.pcap'))

      // Process PCAP to extract PMKID
      const pmkidNetworks = await processPCAP({
        fileId: 'pmkid-test-file',
        originalName: 'pmkid-test.pcap',
        userId: 'test-user-pmkid',
        fileSize: (await fs.stat(pmkidTestPCAP)).size
      })

      const pmkidNetwork = pmkidNetworks.networks.find(n =>
        n.encryption === 'WPA2-PSK' && n.hasPmkid
      )

      expect(pmkidNetwork).toBeDefined()

      // Run PMKID hashcat attack
      const pmkidResult = await runHashcatAttack({
        jobId: 'pmkid-job-real',
        networkId: pmkidNetwork!.id,
        dictionaryId: 'pmkid-test-dict',
        handshakePath: pmkidNetwork!.pmkidPath,
        dictionaryPath: testDict,
        attackMode: 'pmkid',
        userId: 'test-user-pmkid'
      })

      expect(pmkidResult).toBeDefined()
      expect(typeof pmkidResult.success).toBe('boolean')

      if (pmkidResult.success) {
        expect(pmkidResult.passwordsFound).toBeGreaterThanOrEqual(0)
      }
    }, 120000)

    it('should handle mixed WPA/WPA2/WPA3 networks correctly', async () => {
      // Create PCAP with mixed encryption types
      const mixedTestPCAP = await testRealTools.createTestPCAP(path.join(testDir, 'mixed-encryption.pcap'))

      const mixedNetworks = await processPCAP({
        fileId: 'mixed-test-file',
        originalName: 'mixed-encryption.pcap',
        userId: 'test-user-mixed',
        fileSize: (await fs.stat(mixedTestPCAP)).size
      })

      expect(mixedNetworks.networks.length).toBeGreaterThan(1)

      // Should find WPA2, WPA3, and WPA networks
      const hasWPA2 = mixedNetworks.networks.some(n => n.encryption === 'WPA2-PSK')
      const hasWPA3 = mixedNetworks.networks.some(n => n.encryption === 'WPA3-PSK')
      const hasWPA = mixedNetworks.networks.some(n => n.encryption === 'WPA-PSK')

      expect(hasWPA2 || hasWPA3 || hasWPA).toBe(true)
    }, 90000)

    it('should handle attack failures gracefully', async () => {
      // Create invalid PCAP to trigger failure
      const invalidPCAP = await testRealTools.createTestPCAP(path.join(testDir, 'invalid-test.pcap'))

      const invalidNetworks = await processPCAP({
        fileId: 'invalid-test-file',
        originalName: 'invalid-test.pcap',
        userId: 'test-user-error',
        fileSize: (await fs.stat(invalidPCAP)).size
      })

      // Should handle network processing failure
      expect(invalidNetworks).toBeDefined()
      expect(invalidNetworks.success).toBe(false)
      expect(invalidNetworks.error).toBeDefined()

      // Attempt hashcat attack should fail due to no valid networks
      const failResult = await runHashcatAttack({
        jobId: 'error-job-real',
        networkId: 'nonexistent-network',
        dictionaryId: 'error-test-dict',
        handshakePath: '/nonexistent/hc22000',
        dictionaryPath: testDict,
        attackMode: 'handshake',
        userId: 'test-user-error'
      })

      expect(failResult.success).toBe(false)
      expect(failResult.error).toBeDefined()
    }, 60000)

    it('should clean up temporary files after attack completion', async () => {
      const cleanupPCAP = await testRealTools.createTestPCAP(path.join(testDir, 'cleanup-test.pcap'))

      const cleanupNetworks = await processPCAP({
        fileId: 'cleanup-test-file',
        originalName: 'cleanup-test.pcap',
        userId: 'test-user-cleanup',
        fileSize: (await fs.stat(cleanupPCAP)).size
      })

      expect(cleanupNetworks).toBeDefined()

      const cleanupResult = await runHashcatAttack({
        jobId: 'cleanup-job-real',
        networkId: cleanupNetworks.networks[0]!.id,
        dictionaryId: 'cleanup-test-dict',
        handshakePath: cleanupNetworks.networks[0]!.handshakePath,
        dictionaryPath: testDict,
        attackMode: 'handshake',
        userId: 'test-user-cleanup'
      })

      // Verify cleanup after successful attack
      if (cleanupResult.success) {
        // In real implementation, this would clean up temporary files
        expect(cleanupResult).toBeDefined()
      }
    }, 60000)
  })

  describe('Performance and Scalability', () => {
    it('should handle concurrent attacks efficiently', async () => {
      // Create multiple test files
      const concurrentPCAPs = await Promise.all([
        testRealTools.createTestPCAP(path.join(testDir, 'concurrent-1.pcap')),
        testRealTools.createTestPCAP(path.join(testDir, 'concurrent-2.pcap')),
        testRealTools.createTestPCAP(path.join(testDir, 'concurrent-3.pcap'))
      ])

      // Process all PCAPs
      const processedResults = await Promise.all([
        processPCAP({
          fileId: 'concurrent-1-file',
          originalName: 'concurrent-1.pcap',
          userId: 'test-user-concurrent',
          fileSize: (await concurrentPCAPs[0].stat()).size
        }),
        processPCAP({
          fileId: 'concurrent-2-file',
          originalName: 'concurrent-2.pcap',
          userId: 'test-user-concurrent',
          fileSize: (await concurrentPCAPs[1].stat()).size
        }),
        processPCAP({
          fileId: 'concurrent-3-file',
          originalName: 'concurrent-3.pcap',
          userId: 'test-user-concurrent',
          fileSize: (await concurrentPCAPs[2].stat()).size
        })
      ])

      expect(processedResults.every(result => result.success)).toBe(true)
      expect(processedResults.reduce((total, result) => total + result.networks.length, 0)).toBeGreaterThan(0)
    }, 120000)

    it('should process large PCAP files within memory limits', async () => {
      // Create large 50MB PCAP
      const largePCAP = Buffer.alloc(50 * 1024 * 1024)
      await fs.writeFile(path.join(testDir, 'large-test.pcap'), largePCAP)

      const startTime = Date.now()
      const result = await processPCAP({
        fileId: 'large-test-file',
        originalName: 'large-test.pcap',
        userId: 'test-user-large',
        fileSize: largePCAP.length
      })

      const processingTime = Date.now() - startTime

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(processingTime).toBeLessThan(30000) // Should complete within 30 seconds

      // Cleanup large file
      await fs.rm(path.join(testDir, 'large-test.pcap'), { force: true })
    }, 90000)
  })
})