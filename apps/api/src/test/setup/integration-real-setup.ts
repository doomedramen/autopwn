import { beforeAll, afterAll, vi, expect } from 'vitest'

// Mock database with proper Drizzle ORM chaining pattern
// Real integration tests test hashcat/hcx tools, not database operations
const createChainableMock = () => {
  const chainable: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
    limit: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockResolvedValue([]),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    rightJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined)
  }
  // Make where() also chainable
  chainable.where = vi.fn().mockReturnValue({
    ...chainable,
    execute: vi.fn().mockResolvedValue(undefined)
  })
  return chainable
}

vi.mock('../../db/index.ts', () => ({
  db: {
    update: vi.fn().mockImplementation(() => createChainableMock()),
    select: vi.fn().mockImplementation(() => createChainableMock()),
    insert: vi.fn().mockImplementation(() => createChainableMock()),
    delete: vi.fn().mockImplementation(() => createChainableMock()),
    query: {
      jobs: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([])
      }
    }
  }
}))

vi.mock('../../lib/auth.ts', () => ({
  auth: {
    api: {
      session: vi.fn().mockResolvedValue(null)
    }
  }
}))

beforeAll(async () => {
  console.log('🚀 Starting integration test environment with real tools...')

  // Set environment variables for tests
  process.env.NODE_ENV = 'test'
  process.env.HASHCAT_PATH = process.env.HASHCAT_PATH || 'hashcat'
  process.env.HCX_PCAPNGTOOL_PATH = process.env.HCX_PCAPNGTOOL_PATH || 'hcxpcapngtool'
  process.env.TEST_WITH_REAL_TOOLS = process.env.TEST_WITH_REAL_TOOLS || 'true'

  // Setup test directories
  const fs = await import('fs/promises')
  const path = await import('path')

  try {
    const testDir = '/tmp/integration-test'
    await fs.default.mkdir(testDir, { recursive: true })
    await fs.default.mkdir(path.default.join(testDir, 'hashcat'), { recursive: true })

    // Return test directory for tests to use
    global.testRealTools = {
      createTestPCAP: async (filePath: string, content: string | Buffer = 'test pcap data') => {
        const fullFilePath = path.default.join(testDir, filePath.split('/').pop() || filePath)
        await fs.default.writeFile(fullFilePath, content)
        return fullFilePath
      },

      createTestDictionary: async (filePath: string, passwords: string[] = ['password123', 'admin', '123456']) => {
        const fullFilePath = path.default.join(testDir, filePath.split('/').pop() || filePath)
        const dictContent = passwords.join('\n')
        await fs.default.writeFile(fullFilePath, dictContent)
        return fullFilePath
      },

      createTestHashFile: async (filePath: string, hashes: string[] = ['testhash1', 'testhash2']) => {
        const fullFilePath = path.default.join(testDir, filePath.split('/').pop() || filePath)
        const hashContent = hashes.join('\n')
        await fs.default.writeFile(fullFilePath, hashContent)
        return fullFilePath
      },

      createJobDir: async (jobId: string): Promise<string> => {
        const jobDir = path.default.join(testDir, 'hashcat-jobs', jobId)
        await fs.default.mkdir(jobDir, { recursive: true })
        return jobDir
      },

      cleanupJobDir: async (jobId: string): Promise<void> => {
        const jobDir = path.default.join(testDir, 'hashcat-jobs', jobId)
        try {
          await fs.default.rm(jobDir, { recursive: true, force: true })
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }

    console.log('✅ Real tools test setup completed')
    console.log('🔧 Real tools enabled: hashcat, hcxpcapngtool')
    console.log(`📁 Test directory: ${testDir}`)
  } catch (error) {
    console.error('❌ Setup error:', error)
  }

  console.log('✅ Real tools test setup completed')
  console.log('🔧 Real tools enabled: hashcat, hcxpcapngtool')
})

afterAll(async () => {
  console.log('🧹 Cleaning up real tools test environment...')

  const fs = await import('fs/promises')
  const path = await import('path')

  try {
    // Cleanup test directories
    const testDir = '/tmp/integration-test'
    await fs.default.rm(testDir, { recursive: true, force: true })
  } catch (error) {
    console.error('⚠️  Error during cleanup:', error)
  }

  console.log('✅ Real tools test cleanup completed')
})

// Global test utilities
declare global {
  const testRealTools: typeof testRealTools
}

// Mock test data factory
export const testRealTools = {
  async createTestPCAP(filePath: string, content: string | Buffer = 'test pcap data') {
    const { writeFile } = await import('fs/promises')
    await writeFile(filePath, content)
    return filePath
  },

  async createTestDictionary(filePath: string, passwords: string[] = ['password123', 'admin', '123456']) {
    const { writeFile, mkdir } = await import('fs/promises')
    const { dirname } = await import('path')
    const dictContent = passwords.join('\n')

    // Ensure directory exists
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, dictContent)
    return filePath
  },

  async createTestHashFile(filePath: string, hashes: string[] = ['testhash1', 'testhash2']) {
    const { writeFile } = await import('fs/promises')
    const hashContent = hashes.join('\n')
    await writeFile(filePath, hashContent)
    return filePath
  },

  async createJobDir(jobId: string): Promise<string> {
    const { mkdir } = await import('fs/promises')
    const jobDir = `/tmp/hashcat-jobs/${jobId}`
    await mkdir(jobDir, { recursive: true })
    return jobDir
  },

  async cleanupJobDir(jobId: string): Promise<void> {
    const { rm } = await import('fs/promises')
    const jobDir = `/tmp/hashcat-jobs/${jobId}`
    try {
      await rm(jobDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}