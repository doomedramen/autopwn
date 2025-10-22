import { faker } from '@faker-js/faker'

// Test data factory for frontend tests
export class TestDataFactory {
  // User data
  static createUser(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email().toLowerCase(),
      username: faker.internet.userName().toLowerCase(),
      role: faker.helpers.arrayElement(['user', 'admin']),
      isActive: true,
      emailVerified: true,
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
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

  // Job data
  static createJob(overrides: Partial<any> = {}) {
    const status = faker.helpers.arrayElement(['pending', 'running', 'completed', 'failed'])
    const completed = status === 'completed'

    return {
      id: faker.string.uuid(),
      name: `Job: ${faker.hacker.verb()} ${faker.hacker.noun()}`,
      description: faker.hacker.phrase(),
      type: faker.helpers.arrayElement(['wordlist', 'mask', 'hybrid']),
      status,
      userId: faker.string.uuid(),
      targetFile: faker.system.fileName({ extensionCount: 1, extension: 'cap' }),
      dictionaryFile: faker.system.fileName({ extensionCount: 1, extension: 'txt' }),
      hashcatMode: faker.helpers.arrayElement([22000, 16800]),
      progress: status === 'running' ? faker.number.int({ min: 0, max: 100 }) :
                completed ? 100 : 0,
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      completedAt: completed ? faker.date.recent().toISOString() : null,
      results: completed ? {
        cracked: faker.number.int({ min: 0, max: 100 }),
        total: faker.number.int({ min: 100, max: 1000 }),
        timeTaken: faker.number.int({ min: 1000, max: 3600000 }),
        speed: faker.number.int({ min: 1000, max: 100000 }) // H/s
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
        encryption: faker.helpers.arrayElement(['WPA2', 'WPA3', 'WPA/WPA2', 'OPEN']),
        hasHandshake: faker.datatype.boolean(),
        hasPmkid: faker.datatype.boolean()
      }), { count: faker.number.int({ min: 1, max: 5 }) }),
      createdAt: faker.date.past().toISOString(),
      ...overrides
    }
  }

  // Dictionary data
  static createDictionary(overrides: Partial<any> = {}) {
    return {
      id: faker.string.uuid(),
      name: `${faker.hacker.adjective()} ${faker.hacker.noun()}`,
      description: `Dictionary for ${faker.hacker.verb()} attacks`,
      type: faker.helpers.arrayElement(['wordlist', 'rule', 'combined']),
      size: faker.number.int({ min: 100, max: 1000000 }),
      source: faker.helpers.arrayElement(['rockyou', 'custom', 'generated']),
      format: 'txt',
      userId: faker.string.uuid(),
      isPublic: faker.datatype.boolean(),
      downloadCount: faker.number.int({ min: 0, max: 1000 }),
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      ...overrides
    }
  }

  // Form data
  static createJobFormData(overrides: Partial<any> = {}) {
    return {
      name: faker.hacker.phrase(),
      description: faker.lorem.paragraph(),
      type: faker.helpers.arrayElement(['wordlist', 'mask', 'hybrid']),
      dictionaryId: faker.string.uuid(),
      captureId: faker.string.uuid(),
      hashcatMode: faker.helpers.arrayElement([22000, 16800]),
      mask: faker.helpers.arrayElement(['?d?d?d?d?d', '?l?l?l?l?l?l?l', '?a?a?a?a?a?a?a']),
      rules: faker.helpers.arrayElement(['best64.rule', 'd3ad0ne.rule']),
      ...overrides
    }
  }

  static createAuthFormData(overrides: Partial<any> = {}) {
    return {
      email: faker.internet.email().toLowerCase(),
      password: faker.internet.password({ length: 12, memorable: true }),
      ...overrides
    }
  }

  // API response data
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

  // Pagination data
  static createPaginationResponse(overrides: Partial<any> = {}) {
    const page = faker.number.int({ min: 1, max: 10 })
    const limit = faker.number.int({ min: 10, max: 50 })
    const total = faker.number.int({ min: 100, max: 1000 })
    const items = Array.from({ length: limit }, (_, i) => ({
      id: faker.string.uuid(),
      name: faker.hacker.noun(),
      ...faker.helpers.createTransaction()
    }))

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      ...overrides
    }
  }

  // Queue status
  static createQueueStatus(overrides: Partial<any> = {}) {
    return {
      waiting: faker.number.int({ min: 0, max: 20 }),
      active: faker.number.int({ min: 0, max: 5 }),
      completed: faker.number.int({ min: 50, max: 500 }),
      failed: faker.number.int({ min: 0, max: 10 }),
      workerStatus: faker.helpers.arrayElement(['healthy', 'busy', 'idle', 'error']),
      lastActivity: faker.date.recent().toISOString(),
      uptime: faker.number.int({ min: 3600, max: 86400 }), // 1-24 hours
      ...overrides
    }
  }

  // File upload data
  static createFileUpload(overrides: Partial<any> = {}) {
    return {
      file: new File(['test data'], faker.system.fileName({ extensionCount: 1, extension: 'pcap' }), {
        type: 'application/octet-stream'
      }),
      name: faker.system.fileName({ extensionCount: 1, extension: 'pcap' }),
      size: faker.number.int({ min: 1024, max: 10485760 }),
      type: 'application/octet-stream',
      lastModified: faker.date.past().getTime(),
      ...overrides
    }
  }
}

// Export default instance
export default TestDataFactory