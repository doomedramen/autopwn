/**
 * Test data fixtures for E2E testing
 */

import { testUsers } from './test-users'

// Re-export testUsers for convenience
export { testUsers }

/**
 * Test networks data
 */
export const testNetworks = {
  wpa2: {
    ssid: 'TestWPA2-Network',
    bssid: 'AA:BB:CC:DD:EE:FF',
    encryption: 'WPA2',
    channel: 6,
    frequency: 2437,
    signalStrength: -45,
  },
  wpa3: {
    ssid: 'TestWPA3-Network',
    bssid: '11:22:33:44:55:66',
    encryption: 'WPA3',
    channel: 36,
    frequency: 5180,
    signalStrength: -52,
  },
  wep: {
    ssid: 'TestWEP-Network',
    bssid: '33:44:55:66:77:88',
    encryption: 'WEP',
    channel: 1,
    frequency: 2412,
    signalStrength: -60,
  },
  open: {
    ssid: 'TestOpen-Network',
    bssid: '44:55:66:77:88:99',
    encryption: 'Open',
    channel: 11,
    frequency: 2462,
    signalStrength: -70,
  },
}

/**
 * Test dictionary data
 */
export const testDictionaries = {
  small: {
    name: 'E2E Small Dictionary',
    filename: 'e2e-small.txt',
    wordCount: 100,
    size: 1024,
  },
  medium: {
    name: 'E2E Medium Dictionary',
    filename: 'e2e-medium.txt',
    wordCount: 10000,
    size: 102400,
  },
  rockyou: {
    name: 'E2E Rockyou.txt',
    filename: 'rockyou.txt',
    wordCount: 14344391,
    size: 139921507,
  },
}

/**
 * Test job configurations
 */
export const testJobConfigs = {
  basic: {
    name: 'E2E Test Job',
    hashcatMode: 22000,
    rules: [],
    workload: 100,
  },
  advanced: {
    name: 'E2E Advanced Job',
    hashcatMode: 22000,
    rules: ['best64.rule'],
    workload: 250,
    optimizedKernel: true,
  },
}

/**
 * Common test strings
 */
export const testStrings = {
  validPasswords: [
    'Password123!',
    'SecurePass#2024',
    'MyP@ssw0rd',
    'Test1234!',
  ],
  invalidPasswords: [
    '', // empty
    '123', // too short
    'password', // no number, no special char
    'Password1', // no special char
    'P1!', // too short
  ],
  validEmails: [
    'test@example.com',
    'user.name@example.com',
    'user+tag@example.co.uk',
  ],
  invalidEmails: [
    '', // empty
    'not-an-email',
    '@example.com',
    'user@',
    'user @example.com',
  ],
}

/**
 * PCAP file metadata for testing
 */
export const testPcapMetadata = {
  small: {
    filename: 'test-small.pcap',
    size: 1024,
    networkCount: 1,
  },
  medium: {
    filename: 'test-medium.pcap',
    size: 51200,
    networkCount: 3,
  },
  large: {
    filename: 'test-large.pcap',
    size: 102400,
    networkCount: 5,
  },
  invalid: {
    filename: 'test-invalid.txt',
    size: 512,
  },
}

/**
 * API response timeouts
 */
export const timeouts = {
  short: 1000, // 1 second
  medium: 5000, // 5 seconds
  long: 30000, // 30 seconds
  jobCompletion: 120000, // 2 minutes for job to complete
  fileUpload: 60000, // 1 minute for file upload
}

/**
 * Test pagination options
 */
export const testPagination = {
  small: { page: 1, limit: 5 },
  medium: { page: 1, limit: 20 },
  large: { page: 1, limit: 50 },
}

/**
 * Wait durations for UI states
 */
export const waitDurations = {
  instant: 0,
  veryShort: 100,
  short: 500,
  medium: 1000,
  long: 3000,
  veryLong: 10000,
}
