import { faker } from '@faker-js/faker'

// Test data factory for creating consistent test data
export class TestDataFactory {
  // User data generation
  static createUser(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email().toLowerCase(),
      username: faker.internet.userName().toLowerCase(),
      password: faker.internet.password({ length: 12 }),
      role: 'user',
      isActive: true,
      emailVerified: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    }
  }

  static createAdminUser(overrides: Partial<any> = {}) {
    return this.createUser({
      role: 'admin',
      email: 'admin@autopwn.local',
      username: 'admin',
      ...overrides
    })
  }

  // Job data generation
  static createJob(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      name: `Job ${faker.hacker.verb()} ${faker.hacker.noun()}`,
      description: faker.hacker.phrase(),
      type: faker.helpers.arrayElement(['wordlist', 'mask', 'hybrid']),
      status: faker.helpers.arrayElement(['pending', 'running', 'completed', 'failed']),
      userId: faker.string.uuid(),
      targetFile: faker.system.fileName({ extensionCount: 1, extension: 'cap' }),
      dictionaryFile: faker.system.fileName({ extensionCount: 1, extension: 'txt' }),
      hashcatMode: faker.helpers.arrayElement([22000, 16800, 2500]),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      completedAt: faker.datatype.boolean() ? faker.date.recent() : null,
      results: faker.datatype.boolean() ? {
        cracked: faker.number.int({ min: 0, max: 100 }),
        total: faker.number.int({ min: 100, max: 1000 }),
        timeTaken: faker.number.int({ min: 1000, max: 3600000 })
      } : null,
      ...overrides
    }
  }

  // Network capture data
  static createNetworkCapture(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      filename: faker.system.fileName({ extensionCount: 1, extension: 'pcap' }),
      originalName: `capture_${faker.date.recent().getTime()}.pcap`,
      size: faker.number.int({ min: 1024, max: 10485760 }), // 1KB to 10MB
      userId: faker.string.uuid(),
      networks: faker.helpers.multiple(() => ({
        ssid: faker.internet.wifiSsid(),
        bssid: faker.internet.mac(),
        channel: faker.number.int({ min: 1, max: 14 }),
        frequency: faker.helpers.arrayElement([2412, 2437, 2462, 5180, 5240, 5785]),
        signalStrength: faker.number.int({ min: -90, max: -20 }),
        encryption: faker.helpers.arrayElement(['WPA2', 'WPA3', 'WPA/WPA2', 'OPEN'])
      }), { count: faker.number.int({ min: 1, max: 5 }) }),
      createdAt: faker.date.past(),
      ...overrides
    }
  }

  // Dictionary data
  static createDictionary(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      name: `${faker.hacker.adjective()} ${faker.hacker.noun()}`,
      description: `Dictionary for ${faker.hacker.verb()}`,
      type: faker.helpers.arrayElement(['wordlist', 'rule', 'combined']),
      size: faker.number.int({ min: 100, max: 1000000 }),
      source: faker.helpers.arrayElement(['rockyou', 'custom', 'generated']),
      format: 'txt',
      userId: faker.string.uuid(),
      isPublic: faker.datatype.boolean(),
      downloadCount: faker.number.int({ min: 0, max: 1000 }),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    }
  }

  // Hashcat result data
  static createHashcatResult(overrides: Partial<any> = {}) {
    return {
      jobId: faker.string.uuid(),
      success: faker.datatype.boolean(),
      cracked: faker.number.int({ min: 0, max: 100 }),
      total: faker.number.int({ min: 100, max: 1000 }),
      timeTaken: faker.number.int({ min: 1000, max: 3600000 }),
      speed: faker.number.int({ min: 1000, max: 100000 }), // H/s
      mode: faker.helpers.arrayElement([22000, 16800]),
      command: `hashcat -m ${faker.helpers.arrayElement([22000, 16800])} -a 0 ${faker.system.filePath()} ${faker.system.filePath()}`,
      stdout: faker.helpers.arrayElement([
        'hashcat (v6.2.6) starting...',
        'Session..........: hashcat',
        'Status...........: Cracked',
        'Recovered........: 1/1 hashes'
      ]),
      stderr: '',
      ...overrides
    }
  }

  // Queue job data
  static createQueueJob(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      name: faker.hacker.verb(),
      data: {
        jobId: faker.string.uuid(),
        hashcatMode: faker.helpers.arrayElement([22000, 16800]),
        inputFile: faker.system.filePath(),
        dictionaryFile: faker.system.filePath(),
        outputFile: faker.system.filePath()
      },
      opts: {
        attempts: faker.number.int({ min: 1, max: 3 }),
        delay: faker.number.int({ min: 1000, max: 5000 }),
        removeOnComplete: faker.datatype.boolean(),
        removeOnFail: faker.datatype.boolean()
      },
      progress: faker.number.int({ min: 0, max: 100 }),
      processedOn: faker.date.recent(),
      finishedOn: faker.datatype.boolean() ? faker.date.recent() : null,
      failedReason: faker.datatype.boolean() ? faker.helpers.arrayElement([
        'timeout',
        'memory',
        'invalid_input',
        'hashcat_error'
      ]) : null,
      ...overrides
    }
  }

  // API response fixtures
  static createApiResponse(overrides: Partial<any> = {}) {
    return {
      success: faker.datatype.boolean(),
      message: faker.helpers.arrayElement([
        'Operation completed successfully',
        'Request processed',
        'Data retrieved',
        'Error occurred'
      ]),
      data: faker.datatype.boolean() ? {} : null,
      error: faker.datatype.boolean() ? {
        code: faker.helpers.arrayElement(['VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED', 'INTERNAL_ERROR']),
        message: faker.lorem.sentence(),
        details: faker.lorem.paragraph()
      } : null,
      timestamp: faker.date.recent().toISOString(),
      requestId: faker.string.uuid(),
      ...overrides
    }
  }
}

// Specific test data for security testing
export const SecurityTestData = {
  // Known hashes for testing (these are test hashes, not real passwords)
  knownHashes: {
    // WPA/WPA2 PMKID hash (mode 16800) - test hash only
    wpaPmkid: 'WPA*01*03ca2b5120f094868b9a8e2d19b7e6f5*test_ssid*001122334455',
    // WPA/WPA2 handshake hash (mode 22000) - test hash only
    wpaHandshake: 'WPA*02*test_ssid*001122334455*aa:bb:cc:dd:ee:ff*cc:dd:ee:ff:aa:bb*03ca2b5120f094868b9a8e2d19b7e6f5*03ca2b5120f094868b9a8e2d19b7e6f5'
  },

  // Test passwords and their hashes (for validation)
  testPasswords: {
    password123: 'test_hash_value_here',
    testpass: 'another_test_hash',
    autopwn: 'yet_another_test_hash'
  },

  // Sample network captures for testing
  sampleCaptures: {
    valid: 'sample_valid.pcap',
    invalid: 'sample_invalid.pcap',
    empty: 'sample_empty.pcap'
  }
}