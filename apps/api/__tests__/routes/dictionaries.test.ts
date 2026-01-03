import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getTestDb, testHelpers } from '../setup'
import { dictionaries, users } from '../../src/db/schema'
import { eq, and } from 'drizzle-orm'

// Mock the logger
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    security: vi.fn(),
  },
}))

// Mock fs operations
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<any>('fs/promises')
  return {
    ...actual,
    readFile: vi.fn(() => Promise.resolve('word1\nword2\nword3\ntest123')),
    writeFile: vi.fn(() => Promise.resolve()),
    mkdir: vi.fn(() => Promise.resolve()),
    chmod: vi.fn(() => Promise.resolve()),
    unlink: vi.fn(() => Promise.resolve()),
    statfs: vi.fn(() => Promise.reject(new Error('Not found'))),
  }
})

// Mock crypto
vi.mock('crypto', () => ({
  createHash: () => ({
    update: () => ({
      digest: (format: string) => {
        if (format === 'hex') return 'abc123def456'
        return 'mock-hash'
      },
    }),
  }),
  randomBytes: (size: number) => ({
    toString: (format: string) => 'random-string',
  }),
}))

// Mock the env config
vi.mock('../../src/config/env', () => ({
  env: {
    UPLOAD_DIR: './uploads/test',
    MAX_DICTIONARY_SIZE: '1GB',
    NODE_ENV: 'test',
  },
}))

describe('Dictionaries Routes', () => {
  let db: ReturnType<typeof getTestDb>
  let testUser: any
  let testAdmin: any

  beforeEach(async () => {
    db = getTestDb()

    // Create test users
    testUser = await testHelpers.createUser({ role: 'user' })
    testAdmin = await testHelpers.createAdmin({ role: 'admin' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Dictionary CRUD Operations', () => {
    describe('Creating dictionaries', () => {
      it('should create a dictionary with valid data', async () => {
        const dictionaryData = {
          name: 'Test Dictionary',
          filename: 'test-dict.txt',
          type: 'uploaded' as const,
          status: 'ready' as const,
          size: 1024,
          wordCount: 100,
          encoding: 'utf-8',
          checksum: 'abc123',
          filePath: '/tmp/test-dict.txt',
          userId: testUser.id,
        }

        const [newDictionary] = await db
          .insert(dictionaries)
          .values(dictionaryData)
          .returning()

        expect(newDictionary).toBeDefined()
        expect(newDictionary.name).toBe('Test Dictionary')
        expect(newDictionary.filename).toBe('test-dict.txt')
        expect(newDictionary.type).toBe('uploaded')
        expect(newDictionary.userId).toBe(testUser.id)
      })

      it('should create dictionary with generated type', async () => {
        const dictionaryData = {
          name: 'Generated Dictionary',
          filename: 'generated-dict.txt',
          type: 'generated' as const,
          status: 'ready' as const,
          size: 2048,
          wordCount: 200,
          encoding: 'utf-8',
          checksum: 'def456',
          filePath: '/tmp/generated-dict.txt',
          userId: testUser.id,
        }

        const [newDictionary] = await db
          .insert(dictionaries)
          .values(dictionaryData)
          .returning()

        expect(newDictionary.type).toBe('generated')
      })

      it('should validate enum values for status', async () => {
        const validStatuses = ['ready', 'uploading', 'processing', 'failed'] as const

        for (const status of validStatuses) {
          const dictionary = await testHelpers.createDictionary(testUser.id, { status })
          expect(dictionary.status).toBe(status)
        }
      })

      it('should validate enum values for type', async () => {
        const validTypes = ['uploaded', 'generated'] as const

        for (const type of validTypes) {
          const dictionary = await testHelpers.createDictionary(testUser.id, { type })
          expect(dictionary.type).toBe(type)
        }
      })
    })

    describe('Reading dictionaries', () => {
      beforeEach(async () => {
        // Create test dictionaries
        await testHelpers.createDictionary(testUser.id, {
          name: 'User Dictionary 1',
          filename: 'user-dict-1.txt',
        })
        await testHelpers.createDictionary(testUser.id, {
          name: 'User Dictionary 2',
          filename: 'user-dict-2.txt',
        })
      })

      it('should get all dictionaries for a user', async () => {
        const result = await db.query.dictionaries.findMany({
          where: eq(dictionaries.userId, testUser.id),
        })

        expect(result).toHaveLength(2)
        expect(result.every(d => d.userId === testUser.id)).toBe(true)
      })

      it('should get dictionary by id', async () => {
        const dictionary = await testHelpers.createDictionary(testUser.id, {
          name: 'Target Dictionary',
          filename: 'target.txt',
        })

        const result = await db.query.dictionaries.findFirst({
          where: eq(dictionaries.id, dictionary.id),
        })

        expect(result).toBeDefined()
        expect(result?.name).toBe('Target Dictionary')
      })

      it('should not return dictionaries from other users', async () => {
        const otherUser = await testHelpers.createUser({ email: 'other@example.com' })
        await testHelpers.createDictionary(otherUser.id, {
          name: 'Other Dictionary',
          filename: 'other.txt',
        })

        const result = await db.query.dictionaries.findMany({
          where: eq(dictionaries.userId, testUser.id),
        })

        expect(result).toHaveLength(2)
        expect(result.every(d => d.userId === testUser.id)).toBe(true)
      })
    })

    describe('Updating dictionaries', () => {
      it('should update dictionary status', async () => {
        const dictionary = await testHelpers.createDictionary(testUser.id, {
          status: 'uploading',
        })

        await db
          .update(dictionaries)
          .set({
            status: 'ready',
            updatedAt: new Date(),
          })
          .where(eq(dictionaries.id, dictionary.id))

        const result = await db.query.dictionaries.findFirst({
          where: eq(dictionaries.id, dictionary.id),
        })

        expect(result?.status).toBe('ready')
      })

      it('should update dictionary word count', async () => {
        const dictionary = await testHelpers.createDictionary(testUser.id, {
          wordCount: 0,
        })

        await db
          .update(dictionaries)
          .set({
            wordCount: 1000,
            updatedAt: new Date(),
          })
          .where(eq(dictionaries.id, dictionary.id))

        const result = await db.query.dictionaries.findFirst({
          where: eq(dictionaries.id, dictionary.id),
        })

        expect(result?.wordCount).toBe(1000)
      })

      it('should update processing config', async () => {
        const dictionary = await testHelpers.createDictionary(testUser.id, {})

        const processingConfig = {
          merge: {
            sourceDictionaries: ['uuid1', 'uuid2'],
            originalWordCount: 200,
            finalWordCount: 150,
          },
        }

        await db
          .update(dictionaries)
          .set({
            processingConfig,
            updatedAt: new Date(),
          })
          .where(eq(dictionaries.id, dictionary.id))

        const result = await db.query.dictionaries.findFirst({
          where: eq(dictionaries.id, dictionary.id),
        })

        expect(result?.processingConfig).toEqual(processingConfig)
      })
    })

    describe('Deleting dictionaries', () => {
      it('should delete a dictionary', async () => {
        const dictionary = await testHelpers.createDictionary(testUser.id, {
          name: 'To Delete',
          filename: 'delete.txt',
        })

        // Verify it exists
        let result = await db.query.dictionaries.findFirst({
          where: eq(dictionaries.id, dictionary.id),
        })
        expect(result).toBeDefined()

        // Delete it
        await db.delete(dictionaries).where(eq(dictionaries.id, dictionary.id))

        // Verify it's gone
        result = await db.query.dictionaries.findFirst({
          where: eq(dictionaries.id, dictionary.id),
        })
        expect(result).toBeUndefined()
      })

      it('should handle deleting non-existent dictionary', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000'
        const result = await db
          .delete(dictionaries)
          .where(eq(dictionaries.id, fakeId))
          .returning()

        expect(result).toHaveLength(0)
      })
    })
  })

  describe('Dictionary filtering and querying', () => {
    beforeEach(async () => {
      // Create dictionaries with different statuses
      await testHelpers.createDictionary(testUser.id, {
        name: 'Ready Dictionary',
        filename: 'ready.txt',
        status: 'ready',
      })
      await testHelpers.createDictionary(testUser.id, {
        name: 'Processing Dictionary',
        filename: 'processing.txt',
        status: 'processing',
      })
      await testHelpers.createDictionary(testUser.id, {
        name: 'Failed Dictionary',
        filename: 'failed.txt',
        status: 'failed',
      })

      // Create dictionaries with different types
      await testHelpers.createDictionary(testUser.id, {
        name: 'Uploaded Dictionary',
        filename: 'uploaded.txt',
        type: 'uploaded',
      })
      await testHelpers.createDictionary(testUser.id, {
        name: 'Generated Dictionary',
        filename: 'generated.txt',
        type: 'generated',
      })
    })

    it('should filter dictionaries by status', async () => {
      const readyDicts = await db.query.dictionaries.findMany({
        where: and(
          eq(dictionaries.userId, testUser.id),
          eq(dictionaries.status, 'ready'),
        ),
      })

      expect(readyDicts.length).toBeGreaterThan(0)
      readyDicts.forEach(dict => {
        expect(dict.status).toBe('ready')
      })
    })

    it('should filter dictionaries by type', async () => {
      const uploadedDicts = await db.query.dictionaries.findMany({
        where: and(
          eq(dictionaries.userId, testUser.id),
          eq(dictionaries.type, 'uploaded'),
        ),
      })

      expect(uploadedDicts.length).toBeGreaterThan(0)
      uploadedDicts.forEach(dict => {
        expect(dict.type).toBe('uploaded')
      })
    })

    it('should order dictionaries by createdAt descending', async () => {
      const result = await db.query.dictionaries.findMany({
        where: eq(dictionaries.userId, testUser.id),
        orderBy: (dictionaries, { desc }) => [desc(dictionaries.createdAt)],
      })

      // Verify ordering
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          result[i + 1].createdAt.getTime(),
        )
      }
    })
  })

  describe('Dictionary data types and constraints', () => {
    it('should handle large file sizes', async () => {
      const largeSize = 1024 * 1024 * 1024 // 1GB

      const dictionary = await testHelpers.createDictionary(testUser.id, {
        size: largeSize,
      })

      expect(dictionary.size).toBe(largeSize)
    })

    it('should handle large word counts', async () => {
      const largeWordCount = 10000000 // 10 million words

      const dictionary = await testHelpers.createDictionary(testUser.id, {
        wordCount: largeWordCount,
      })

      expect(dictionary.wordCount).toBe(largeWordCount)
    })

    it('should store checksum correctly', async () => {
      const checksum = 'a'.repeat(64) // SHA256 hash length

      const dictionary = await testHelpers.createDictionary(testUser.id, {
        checksum,
      })

      expect(dictionary.checksum).toBe(checksum)
    })

    it('should handle different encodings', async () => {
      const encodings = ['utf-8', 'ascii', 'latin1']

      for (const encoding of encodings) {
        const dictionary = await testHelpers.createDictionary(testUser.id, {
          encoding: encoding as any,
        })
        expect(dictionary.encoding).toBe(encoding)
      }
    })
  })

  describe('Dictionary timestamps', () => {
    it('should set createdAt and updatedAt automatically', async () => {
      const beforeCreate = new Date()

      const dictionary = await testHelpers.createDictionary(testUser.id, {
        name: 'Timestamp Test',
        filename: 'timestamp.txt',
      })

      const afterCreate = new Date()

      expect(dictionary.createdAt).toBeDefined()
      expect(dictionary.updatedAt).toBeDefined()
      expect(dictionary.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(dictionary.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(dictionary.updatedAt.getTime()).toBe(dictionary.createdAt.getTime())
    })

    it('should update updatedAt on modification', async () => {
      const dictionary = await testHelpers.createDictionary(testUser.id, {})

      // Wait to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      await db
        .update(dictionaries)
        .set({
          name: 'Updated Name',
          updatedAt: new Date(),
        })
        .where(eq(dictionaries.id, dictionary.id))

      const result = await db.query.dictionaries.findFirst({
        where: eq(dictionaries.id, dictionary.id),
      })

      expect(result?.updatedAt.getTime()).toBeGreaterThan(dictionary.createdAt.getTime())
    })
  })

  describe('Dictionary ownership and access control', () => {
    it('should associate dictionary with user', async () => {
      const dictionary = await testHelpers.createDictionary(testUser.id, {})

      expect(dictionary.userId).toBe(testUser.id)
    })

    it('should allow multiple users to have dictionaries with same name', async () => {
      const otherUser = await testHelpers.createUser({ email: 'other@example.com' })

      const dict1 = await testHelpers.createDictionary(testUser.id, {
        name: 'My Dictionary',
        filename: 'dict1.txt',
      })
      const dict2 = await testHelpers.createDictionary(otherUser.id, {
        name: 'My Dictionary',
        filename: 'dict2.txt',
      })

      expect(dict1.name).toBe(dict2.name)
      expect(dict1.userId).toBe(testUser.id)
      expect(dict2.userId).toBe(otherUser.id)
      expect(dict1.id).not.toBe(dict2.id)
    })
  })

  describe('Dictionary processing config', () => {
    it('should store merge processing config', async () => {
      const processingConfig = {
        merge: {
          sourceDictionaries: ['uuid-1', 'uuid-2', 'uuid-3'],
          originalWordCount: 3000,
          finalWordCount: 2500,
          removedDuplicates: 500,
          validationRules: {
            minLength: 8,
            maxLength: 63,
          },
          mergedAt: new Date().toISOString(),
        },
      }

      const dictionary = await testHelpers.createDictionary(testUser.id, {
        processingConfig,
      })

      expect(dictionary.processingConfig).toEqual(processingConfig)
    })

    it('should store validation processing config', async () => {
      const processingConfig = {
        validation: {
          sourceDictionaryId: 'source-uuid',
          originalWordCount: 1000,
          validWordCount: 800,
          invalidWordCount: 150,
          duplicateWordCount: 50,
          invalidWords: ['123', 'abc', 'xyz'],
          duplicateWords: ['password', '123456'],
          validatedAt: new Date().toISOString(),
        },
      }

      const dictionary = await testHelpers.createDictionary(testUser.id, {
        processingConfig,
      })

      expect(dictionary.processingConfig).toEqual(processingConfig)
    })

    it('should allow null processing config', async () => {
      const dictionary = await testHelpers.createDictionary(testUser.id, {
        processingConfig: null,
      })

      expect(dictionary.processingConfig).toBeNull()
    })
  })

  describe('Dictionary count operations', () => {
    it('should return count of user dictionaries', async () => {
      await testHelpers.createDictionary(testUser.id, { name: 'Dict1' })
      await testHelpers.createDictionary(testUser.id, { name: 'Dict2' })
      await testHelpers.createDictionary(testUser.id, { name: 'Dict3' })

      const result = await db.query.dictionaries.findMany({
        where: eq(dictionaries.userId, testUser.id),
      })

      expect(result.length).toBe(3)
    })

    it('should count only ready dictionaries', async () => {
      await testHelpers.createDictionary(testUser.id, { status: 'ready' })
      await testHelpers.createDictionary(testUser.id, { status: 'ready' })
      await testHelpers.createDictionary(testUser.id, { status: 'processing' })
      await testHelpers.createDictionary(testUser.id, { status: 'failed' })

      const result = await db.query.dictionaries.findMany({
        where: and(
          eq(dictionaries.userId, testUser.id),
          eq(dictionaries.status, 'ready'),
        ),
      })

      expect(result.length).toBe(2)
    })
  })

  describe('Dictionary validation constraints', () => {
    it('should enforce name max length', async () => {
      const longName = 'a'.repeat(255) // Max length

      const dictionary = await testHelpers.createDictionary(testUser.id, {
        name: longName,
      })

      expect(dictionary.name).toHaveLength(255)
    })

    it('should enforce filename constraints', async () => {
      const validFilenames = [
        'dictionary.txt',
        'wordlist.lst',
        'passwords.dict',
        'test-wordlist.txt',
      ]

      for (const filename of validFilenames) {
        const dictionary = await testHelpers.createDictionary(testUser.id, {
          filename,
        })
        expect(dictionary.filename).toBe(filename)
      }
    })

    it('should handle size as bigint', async () => {
      const size = BigInt(1024 * 1024 * 1024)

      const dictionary = await testHelpers.createDictionary(testUser.id, {
        size: Number(size),
      })

      expect(dictionary.size).toBeGreaterThanOrEqual(0)
    })
  })
})
