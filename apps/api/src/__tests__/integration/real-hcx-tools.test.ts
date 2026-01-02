import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import path from 'path'
import { testRealTools } from '../../test/setup/integration-real-setup'
import {
  convertToHC22000,
  extractPMKID,
  convertToHashcat,
  validateConversion,
  checkHCXToolsAvailability
} from '../../lib/hcx-tools'

const execAsync = promisify(exec)

describe('Real HCX Tools Integration Tests', () => {
  let testDir = ''
  let testPCAP = ''
  let outputHC22000 = ''
  let outputPMKID = ''

  beforeAll(async () => {
    testDir = '/tmp/integration-test'
    testPCAP = await testRealTools.createTestPCAP(path.join(testDir, 'wpa-test.pcap'))
    outputHC22000 = path.join(testDir, 'test-output.hc22000')
    outputPMKID = path.join(testDir, 'test-output.pmkid')

    console.log('🧪 HCX test environment prepared')
    console.log(`📁 PCAP: ${testPCAP}`)
    console.log(`📄 Output HC22000: ${outputHC22000}`)
    console.log(`🔑 Output PMKID: ${outputPMKID}`)
  })

  afterAll(async () => {
    await Promise.all([
      fs.rm(testPCAP, { force: true }),
      fs.rm(outputHC22000, { force: true }),
      fs.rm(outputPMKID, { force: true })
    ])
    console.log('🧹 HCX test environment cleaned up')
  })

  describe('Real Tool Availability', () => {
    it('should detect actual hcxpcapngtool availability', async () => {
      const result = await checkHCXToolsAvailability()

      if (process.env.HCX_PCAPNGTOOL_PATH && process.env.HCX_PCAPNGTOOL_PATH !== 'mock') {
        expect(result.available).toBe(true)
        expect(result.version).toBeDefined()
      } else {
        expect(result).toBeDefined()
      }
    })

    it('should handle hcxpcapngtool not found gracefully', async () => {
      const originalPath = process.env.HCX_PCAPNGTOOL_PATH
      process.env.HCX_PCAPNGTOOL_PATH = '/nonexistent/hcxpcapngtool'

      const result = await checkHCXToolsAvailability()

      process.env.HCX_PCAPNGTOOL_PATH = originalPath

      expect(result.available).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('Real PCAP to HC22000 Conversion', () => {
    it('should convert WPA handshake using real hcxpcapngtool', async () => {
      // Fixed: hcxpcapngtool 7.0+ uses positional input, no -i or -O flags
      const command = `hcxpcapngtool -o "${outputHC22000}" "${testPCAP}"`

      // Execute real hcxpcapngtool command
      const { stdout, stderr } = await execAsync(command)

      expect(stderr).toBe('') // No errors expected

      // Verify output file was created
      const { access } = await import('fs/promises')
      expect(await access(outputHC22000)).toBeDefined()

      const outputContent = await fs.readFile(outputHC22000, 'utf-8')
      expect(outputContent).toContain('WPA*01') // HC22000 format
    }, 30000)

    it('should extract PMKID using real hcxpcapngtool', async () => {
      // Fixed: hcxpcapngtool 7.0+ uses positional input, no -i or -O flags
      const command = `hcxpcapngtool -o "${outputPMKID}" "${testPCAP}"`

      const { stdout, stderr } = await execAsync(command)

      expect(stderr).toBe('') // No errors expected

      // Verify output file was created
      const outputContent = await fs.readFile(outputPMKID, 'utf-8')
      expect(outputContent).toContain('WPA*01') // PMKID format
    }, 30000)

    it('should handle hcxpcapngtool execution errors gracefully', async () => {
      const invalidPCAP = path.join(testDir, 'invalid.pcap')
      await fs.writeFile(invalidPCAP, 'invalid pcap data')

      // Fixed: hcxpcapngtool 7.0+ uses positional input
      const command = `hcxpcapngtool -o "${outputHC22000}" "${invalidPCAP}"`

      await expect(execAsync(command)).rejects.toThrow()
    }, 15000)

    it('should handle corrupted PCAP files gracefully', async () => {
      const corruptedPCAP = path.join(testDir, 'corrupted.pcap')
      await fs.writeFile(corruptedPCAP, Buffer.from([0x00, 0x01])) // Invalid PCAP header

      // Fixed: hcxpcapngtool 7.0+ uses positional input
      const command = `hcxpcapngtool -o "${outputHC22000}" "${corruptedPCAP}"`

      const result = await convertToHC22000(corruptedPCAP, outputHC22000)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    }, 15000)
  })

  describe('Real Hashcat Format Conversion', () => {
    it('should convert HC22000 to hashcat format correctly', async () => {
      // Create test HC22000 file
      const hc22000Content = `WPA*01*TestNetwork*00*11:22:33:44:55*testpmkid123`
      await fs.writeFile(outputHC22000, hc22000Content, 'utf-8')

      const result = await convertToHashcat(outputHC22000, path.join(testDir, 'hashcat.txt'))

      expect(result.success).toBe(true)
      expect(result.hashesConverted).toBe(1)

      // Verify hashcat format
      const hashcatContent = await fs.readFile(path.join(testDir, 'hashcat.txt'), 'utf-8')
      expect(hashcatContent).toContain('TestNetwork')
      expect(hashcatContent).toContain('testpmkid123')
    })

    it('should handle invalid HC22000 format gracefully', async () => {
      const invalidHC22000 = 'invalid format data'
      await fs.writeFile(outputHC22000, invalidHC22000, 'utf-8')

      const result = await convertToHashcat(outputHC22000, path.join(testDir, 'hashcat.txt'))

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Real Format Validation', () => {
    it('should validate properly formatted HC22000 files', async () => {
      // Create valid HC22000 file
      const validHC22000Content = `WPA*01*TestNetwork*00*11:22:33:44:55*a1b2c3d4e5f6`
      await fs.writeFile(outputHC22000, validHC22000Content, 'utf-8')

      const result = await validateConversion(outputHC22000)

      expect(result.isValid).toBe(true)
      expect(result.format).toBe('HC22000')
      expect(result.networks).toBe(1)
      expect(result.errors).toEqual([])
    })

    it('should detect invalid HC22000 format issues', async () => {
      // Create invalid HC22000 file
      const invalidHC22000Content = `invalid format line`
      await fs.writeFile(outputHC22000, invalidHC22000Content, 'utf-8')

      const result = await validateConversion(outputHC22000)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle file not found gracefully', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.hc22000')

      const result = await validateConversion(nonExistentFile)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Real Performance Considerations', () => {
    it('should process large PCAP files efficiently', async () => {
      // Create 10MB test PCAP
      const largePCAP = Buffer.alloc(10 * 1024 * 1024)
      await fs.writeFile(testPCAP, largePCAP)

      const startTime = Date.now()
      const result = await convertToHC22000(testPCAP, outputHC22000)
      const processingTime = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(processingTime).toBeLessThan(30000) // Should complete within 30 seconds
    }, 60000)

    it('should track conversion metrics', async () => {
      const result = await convertToHC22000(testPCAP, outputHC22000)

      expect(result.success).toBe(true)
      expect(result.processingTime).toBeGreaterThan(0)

      if (result.metrics) {
        expect(result.metrics.packetsAnalyzed).toBeGreaterThan(0)
        expect(result.metrics.dataRate).toBeGreaterThan(0)
      }
    })
  })
})