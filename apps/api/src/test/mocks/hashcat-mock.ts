import { vi } from 'vitest'
import { SecurityTestData } from '../utils/test-data-factory'

// Mock hashcat execution with realistic responses
export const mockHashcat = {
  // Default successful execution
  default: vi.fn().mockResolvedValue({
    success: true,
    stdout: [
      'hashcat (v6.2.6) starting...',
      'Session..........: hashcat',
      'Status...........: Cracked',
      'Hash.Type........: WPA-PBKDF2-PMKID+EAPOL',
      'Input.Mode.......: Hybrid (dict + mask)',
      'Hash.Target......: test.hc22000',
      'Recovered........: 1/1 (100.00%) Digests',
      'Recovered/Total...: 1',
      'Time.Started.....: Tue Jan 01 10:00:00 2025',
      'Time.Modulated...: 0.15 Seconds'
    ].join('\n'),
    stderr: '',
    exitCode: 0,
    cracked: 1,
    total: 1,
    timeTaken: 150
  }),

  // No passwords cracked
  noCrack: vi.fn().mockResolvedValue({
    success: true,
    stdout: [
      'hashcat (v6.2.6) starting...',
      'Session..........: hashcat',
      'Status...........: Exhausted',
      'Hash.Type........: WPA-PBKDF2-PMKID+EAPOL',
      'Input.Mode.......: Straight',
      'Hash.Target......: test.hc22000',
      'Recovered........: 0/1 (0.00%) Digests',
      'Recovered/Total...: 0'
    ].join('\n'),
    stderr: '',
    exitCode: 1,
    cracked: 0,
    total: 1,
    timeTaken: 30000
  }),

  // Error case
  error: vi.fn().mockResolvedValue({
    success: false,
    stdout: '',
    stderr: [
      'hashcat (v6.2.6) starting...',
      'ERROR: Invalid command line parameter.',
      'Usage: hashcat [options]... hash|hashfile|hccapxfile [dictionary|mask|directory]...'
    ].join('\n'),
    exitCode: 1,
    cracked: 0,
    total: 0,
    timeTaken: 100
  }),

  // Timeout case
  timeout: vi.fn().mockRejectedValue(new Error('Process timed out after 300000ms')),

  // Memory error
  memoryError: vi.fn().mockRejectedValue(new Error('Process killed: Out of memory'))
}

// Mock hashcat command generation
export const mockHashcatCommand = {
  default: vi.fn().mockImplementation((mode, options) => [
    'hashcat',
    '-m', mode.toString(),
    '-a', '0',
    '-o', options.outputFile,
    options.inputFile,
    options.dictionaryFile
  ]),

  withRules: vi.fn().mockImplementation((mode, options) => [
    'hashcat',
    '-m', mode.toString(),
    '-a', '1',
    '-r', options.rulesFile,
    '-o', options.outputFile,
    options.inputFile,
    options.dictionaryFile
  ]),

  withMask: vi.fn().mockImplementation((mode, options) => [
    'hashcat',
    '-m', mode.toString(),
    '-a', '3',
    '-o', options.outputFile,
    options.inputFile,
    options.mask
  ])
}

// Mock hashcat output parsing
export const mockParseHashcatOutput = {
  default: vi.fn().mockImplementation((output) => {
    if (output.includes('Cracked')) {
      return {
        success: true,
        cracked: 1,
        total: 1,
        status: 'Cracked',
        timeTaken: 150,
        speed: 1500
      }
    }
    if (output.includes('Exhausted')) {
      return {
        success: true,
        cracked: 0,
        total: 1,
        status: 'Exhausted',
        timeTaken: 30000,
        speed: 200
      }
    }
    if (output.includes('ERROR')) {
      return {
        success: false,
        error: 'Invalid command line parameter',
        type: 'COMMAND_ERROR'
      }
    }
    return { success: false, error: 'Unknown output format' }
  })
}

// Mock file operations for hashcat testing
export const mockFileOperations = {
  readFile: vi.fn().mockImplementation(async (path: string) => {
    if (path.includes('.pcap')) {
      return Buffer.from('fake pcap data', 'binary')
    }
    if (path.includes('.hc22000') || path.includes('.16800')) {
      return SecurityTestData.knownHashes.wpaHandshake
    }
    if (path.includes('.txt') && path.includes('dictionary')) {
      return 'password\ntest\nadmin\n123456\nqwerty\n'
    }
    return Buffer.from('', 'binary')
  }),

  writeFile: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(true),
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined)
}

// Complete mock hashcat module
export const createMockHashcatModule = () => ({
  runHashcat: mockHashcat.default,
  generateHashcatCommand: mockHashcatCommand.default,
  parseHashcatOutput: mockParseHashcatOutput.default,
  supportedModes: [22000, 16800, 2500],
  defaultOptions: {
    timeout: 300000, // 5 minutes
    maxMemory: '1G',
    workLoadProfile: 2
  }
})

// Test helper functions
export const createTestHashcatScenario = async (scenario: 'success' | 'failure' | 'timeout' | 'error') => {
  const mocks = createMockHashcatModule()

  switch (scenario) {
    case 'success':
      mocks.runHashcat = mockHashcat.default
      break
    case 'failure':
      mocks.runHashcat = mockHashcat.noCrack
      break
    case 'timeout':
      mocks.runHashcat = mockHashcat.timeout
      break
    case 'error':
      mocks.runHashcat = mockHashcat.error
      break
  }

  return mocks
}

// Export default mock
export default createMockHashcatModule()