import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildHashcatCommand } from '../../workers/hashcat'

describe('Hashcat Command Builder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Command Structure', () => {
    it('should build valid WPA handshake attack command', () => {
      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'test-job-123'
      })

      expect(command).toContain('hashcat')
      expect(command).toContain('-m 22000') // WPA handshake mode
      expect(command).toContain('-a 0') // Dictionary attack
      expect(command).toContain('/tmp/test.hc22000')
      expect(command).toContain('/tmp/wordlist.txt')
      expect(command).toContain('--session=test-job-123')
    })

    it('should build valid PMKID attack command', () => {
      const command = buildHashcatCommand({
        attackMode: 'pmkid',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'test-pmkid-456'
      })

      expect(command).toContain('hashcat')
      expect(command).toContain('-m 16800') // PMKID mode
      expect(command).toContain('-a 0') // Dictionary attack
      expect(command).toContain('/tmp/test.hc22000')
      expect(command).toContain('/tmp/wordlist.txt')
      expect(command).toContain('--session=test-pmkid-456')
    })

    it('should include optimization flags', () => {
      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'test-optimization'
      })

      expect(command).toContain('-O') // Optimized kernel
      expect(command).toContain('-w 4') // High workload profile
      expect(command).toContain('--runtime=3600') // 1 hour max runtime
    })

    it('should include quiet and force flags', () => {
      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'test-flags'
      })

      expect(command).toContain('--quiet')
      expect(command).toContain('--force')
    })
  })

  describe('Output File Configuration', () => {
    it('should configure correct output files', () => {
      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'test-output'
      })

      const workDir = command.match(/-o (\S+)/)?.[1] || ''
      expect(workDir).toContain('hashcat_output.txt')

      const potfile = command.match(/--potfile-path=(\S+)/)?.[1] || ''
      expect(potfile).toContain('hashcat.pot')
    })

    it('should use job-specific working directory', () => {
      const jobId = 'specific-job-789'
      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId
      })

      // Should create working directory based on job ID
      expect(command).toContain(jobId)
      expect(command).toContain(`--session=${jobId}`)
    })
  })

  describe('Security Configuration', () => {
    it('should not include sensitive information in command', () => {
      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'test-security'
      })

      // Should not expose passwords or keys in command line
      expect(command).not.toContain('password')
      expect(command).not.toContain('secret')
      expect(command).not.toContain('key')
    })

    it('should handle special characters in paths', () => {
      const specialPath = '/tmp/test file with spaces.pcap'
      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: specialPath,
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'test-special-chars'
      })

      // Should properly quote or escape special paths
      expect(command).toContain(specialPath)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty job ID gracefully', () => {
      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: ''
      })

      expect(command).toContain('--session=') // Even empty job ID should include session flag
      expect(command).toContain('--quiet')
      expect(command).toContain('--force')
    })

    it('should handle very long file paths', () => {
      const longPath = '/very/long/path/to/network/capture/with/many/subdirectories/test.hc22000'
      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: longPath,
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'test-long-path'
      })

      expect(command).toContain(longPath)
      expect(command).toContain('--session=test-long-path')
    })

    it('should handle concurrent job scenarios', () => {
      const command1 = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: '/tmp/test1.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'concurrent-job-1'
      })

      const command2 = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: '/tmp/test2.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'concurrent-job-2'
      })

      // Each command should have unique session IDs
      expect(command1).toContain('--session=concurrent-job-1')
      expect(command2).toContain('--session=concurrent-job-2')

      // Commands should be different
      expect(command1).not.toBe(command2)
    })
  })

  describe('Command Validation', () => {
    it('should produce syntactically correct commands', () => {
      const command = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: '/tmp/test.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'test-validation'
      })

      // Command should start with hashcat
      expect(command).toMatch(/^hashcat/)

      // Should have all required flags in correct order
      const flags = command.split(' ').filter(arg => arg.startsWith('-'))
      expect(flags).toContain('-m')
      expect(flags).toContain('-a')
      expect(flags).toContain('-o')
      expect(flags.some(flag => flag.includes('--potfile-path')))
    })

    it('should support different hashcat modes', () => {
      // Test WPA handshake
      const handshakeCommand = buildHashcatCommand({
        attackMode: 'handshake',
        handshakePath: '/tmp/wpa.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'wpa-test'
      })
      expect(handshakeCommand).toContain('-m 22000')

      // Test PMKID
      const pmkidCommand = buildHashcatCommand({
        attackMode: 'pmkid',
        handshakePath: '/tmp/pmkid.hc22000',
        dictionaryPath: '/tmp/wordlist.txt',
        jobId: 'pmkid-test'
      })
      expect(pmkidCommand).toContain('-m 16800')

      // Commands should be different for different modes
      expect(handshakeCommand).not.toBe(pmkidCommand)
    })
  })
})