import { vi } from 'vitest'

// Mock external dependencies for unit tests
vi.mock('@/lib/queue', () => ({
  createJob: vi.fn(),
  processJob: vi.fn(),
  checkQueueHealth: vi.fn().mockResolvedValue({ status: 'healthy' })
}))

vi.mock('@/workers/hashcat', () => ({
  runHashcat: vi.fn().mockResolvedValue({ success: true, cracked: 0 }),
  generateHashcatCommand: vi.fn().mockReturnValue('hashcat -m 22000 -a 0'),
  parseHashcatOutput: vi.fn().mockImplementation((stdout, stderr, exitCode) => {
    const results = []

    if (exitCode === 0 && stdout.includes('Cracked:')) {
      const match = stdout.match(/Cracked:\s+(\d+)\/(\d+)/)
      if (match) {
        return {
          success: true,
          cracked: parseInt(match[1]),
          total: parseInt(match[2]),
          passwords: []
        }
      }
    }

    return {
      success: exitCode === 0,
      cracked: 0,
      total: 0,
      passwords: []
    }
  }),
  buildHashcatCommand: vi.fn().mockImplementation((options) => {
    const workDir = options.jobId ? `/tmp/temp/hashcat/${options.jobId}` : '/tmp/temp/hashcat/test'

    // Hashcat attack modes:
    // -m 16800: WPA-PMKID-PBKDF2 (PMKID attack)
    // -m 22000: WPA-PBKDF2-PMKID+EAPOL (handshake attack)
    const hashMode = options.attackMode === 'pmkid' ? 16800 : 22000

    // Output files
    const outputFile = options.outputFile || `${workDir}/hashcat_output.txt`
    const potfile = `${workDir}/hashcat.pot`

    const command = [
      'hashcat',
      `-m ${hashMode}`,
      `-a 0`, // Dictionary attack
      options.handshakePath || '/tmp/test.hc22000',
      options.dictionaryPath || '/tmp/wordlist.txt',
      `-o ${outputFile}`,
      `--potfile-path=${potfile}`,
      '--quiet',
      '--force',
      '-O', // Optimized kernel
      '-w 4', // Workload profile (high)
      `--session=${options.jobId || ''}`,
      options.runtime ? `--runtime=${options.runtime}` : '--runtime=3600'
    ].join(' ')

    return command
  }),
  runHashcatAttack: vi.fn().mockResolvedValue({ success: true, passwordsFound: 0, passwords: [] }),
  checkHashcatAvailability: vi.fn().mockResolvedValue({ available: true, version: 'v6.2.6' })
}))

vi.mock('@/lib/auth', () => ({
  authClient: {
    options: {
      emailAndPassword: {
        enabled: true,
        disableSignUp: true
      },
      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
        cookieCache: {
          enabled: true,
          maxAge: 5 * 60 // 5 minutes
        },
        modelName: 'sessions',
        fields: {
          userId: 'user_id',
          expiresAt: 'expires_at',
          createdAt: 'created_at',
          updatedAt: 'updated_at',
          ipAddress: 'ip_address',
          userAgent: 'user_agent'
        }
      },
      user: {
        modelName: 'users',
        additionalFields: {
          role: {
            type: 'string',
            defaultValue: 'user'
          }
        },
        fields: {
          emailVerified: 'email_verified',
          createdAt: 'created_at',
          updatedAt: 'updated_at'
        }
      },
      account: {
        modelName: 'accounts',
        accountLinking: {
          enabled: true,
          allowDifferentEmails: false,
          trustedProviders: ['google', 'github', 'microsoft']
        },
        fields: {
          userId: 'user_id',
          accountId: 'account_id',
          providerId: 'provider_id',
          accessTokenExpiresAt: 'access_token_expires_at',
          refreshTokenExpiresAt: 'refresh_token_expires_at',
          createdAt: 'created_at',
          updatedAt: 'updated_at'
        }
      },
      verification: {
        modelName: 'verifications',
        fields: {
          userId: 'user_id'
        },
        disableCleanup: false
      },
      plugins: [{ name: 'admin' }],
      advanced: {
        secureCookies: false,
        generateId: false,
        crossSubDomainCookies: { enabled: false },
        prefixedCookies: false
      }
    }
  }
}))

vi.mock('@/config/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    NODE_ENV: 'test',
    AUTH_URL: 'http://localhost:3001/auth',
    FRONTEND_URL: 'http://localhost:3000'
  }
}))

// Mock child_process with proper exec function
const mockExec = vi.fn((command, callback) => {
  // Default implementation - can be overridden in tests
  setTimeout(() => {
    if (callback) {
      callback(null, {
        stdout: "hcxpcapngtool v1.2.3",
        stderr: "",
      });
    }
  }, 0);
  return { kill: vi.fn() } as any;
})
const mockSpawn = vi.fn()

vi.mock('child_process', () => ({
  exec: mockExec,
  spawn: mockSpawn
}))

// Mock database with explicit type
type MockDB = {
  query: any;
  select: any;
  insert: any;
  update: any;
  delete: any;
  from: any;
  where: any;
  values: any;
  set: any;
  returning: any;
  limit: any;
  offset: any;
  orderBy: any;
  leftJoin: any;
  rightJoin: any;
  innerJoin: any;
}

const dbMock: MockDB = {
  query: vi.fn(),
  select: vi.fn(() => dbMock),
  insert: vi.fn(() => dbMock),
  update: vi.fn(() => dbMock),
  delete: vi.fn(() => dbMock),
  from: vi.fn(() => dbMock),
  where: vi.fn(() => dbMock),
  values: vi.fn(() => dbMock),
  set: vi.fn(() => dbMock),
  returning: vi.fn(() => dbMock),
  limit: vi.fn(() => dbMock),
  offset: vi.fn(() => dbMock),
  orderBy: vi.fn(() => dbMock),
  leftJoin: vi.fn(() => dbMock),
  rightJoin: vi.fn(() => dbMock),
  innerJoin: vi.fn(() => dbMock),
  db: {
    update: vi.fn(() => dbMock),
    delete: vi.fn(() => dbMock)
  }
}

vi.mock('@/db', () => dbMock)

// Mock hcx-tools - COMMENTED OUT to allow hcx-tools-basic.test.ts to test real implementations
// const mockHCXTools = {
//   convertToHC22000: vi.fn(),
//   convertToPMKID: vi.fn(),
//   extractPMKID: vi.fn(),
//   convertToHashcat: vi.fn(),
//   validateConversion: vi.fn(),
//   checkAvailability: vi.fn(),
//   checkHCXToolsAvailability: vi.fn().mockResolvedValue({ available: true, version: 'v1.2.3' }),
//   processHandshakeCapture: vi.fn().mockResolvedValue({ networks: [], handshakes: [] }),
//   extractHandshakes: vi.fn().mockResolvedValue({ handshakes: [] }),
//   getNetworkInfo: vi.fn().mockResolvedValue({ networks: [] })
// }
//
// vi.mock('@/lib/hcx-tools', () => mockHCXTools)

const mockHCXTools = {} // Keep for backwards compatibility with other tests

// Mock file system operations with mutable functions
const fsMock = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
  unlink: vi.fn(),
  readdir: vi.fn(),
  chmod: vi.fn(),
  stat: vi.fn()
}

vi.mock('node:fs/promises', () => fsMock)
vi.mock('fs/promises', () => fsMock)

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.REDIS_URL = 'redis://localhost:6379'

// Global test utilities
declare global {
  namespace Vi {
    interface JestAssertion<T = any> extends jest.Matchers<void, T> {}
  }
}

// Setup test database (in-memory for unit tests)
global.testDb = dbMock

// Make mocks globally available for all test files
global.fsMock = fsMock
global.dbMock = dbMock
global.mockHCXTools = mockHCXTools
global.mockExec = mockExec

// Export mocks for test files to use
export { fsMock, dbMock, mockHCXTools, mockExec }

// Also export mock instances for tests to use
export const mockExecInstance = mockExec

// Cleanup utilities
afterEach(() => {
  vi.clearAllMocks()
})