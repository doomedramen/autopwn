import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { db } from '../../db'
import { dictionaries, users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { addDictionaryGenerationJob } from '../../lib/queue'

describe('Dictionary Generation Integration Tests', () => {
  let app: Hono
  let testUserId: string

  beforeAll(async () => {
    // Setup test database and user
    testUserId = 'test-user-dict-gen'

    // Create test user
    await db.insert(users).values({
      id: testUserId,
      email: 'test-dict-gen@example.com',
      password: 'test_password_hash',
      role: 'user',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Setup test app
    app = new Hono()

    // Mock authentication
    app.use('*', async (c, next) => {
      c.set('userId', testUserId)
      await next()
    })

    // Import and use queue routes
    const { queueRoutes } = await import('../../routes/queue-management')
    app.route('/api/queue', queueRoutes)
  })

  beforeEach(async () => {
    // Clean up any test dictionaries
    await db.delete(dictionaries).where(eq(dictionaries.userId, testUserId))
  })

  afterEach(async () => {
    // Clean up test dictionaries
    await db.delete(dictionaries).where(eq(dictionaries.userId, testUserId))
  })

  afterAll(async () => {
    // Clean up test data
    await db.delete(users).where(eq(users.id, testUserId))
  })

  it('should queue dictionary generation with base words', async () => {
    const requestData = {
      name: 'Test Dictionary',
      baseWords: ['password', 'admin', '123456'],
      async: true
    }

    const response = await app.request('/api/queue/dictionary/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toBe('Dictionary generation job queued successfully')
    expect(data.job.name).toBe('Test Dictionary')
    expect(data.job.baseWords).toBe(3)
    expect(data.job.id).toBeDefined()
  })

  it('should queue dictionary generation with rules and transformations', async () => {
    const requestData = {
      name: 'Advanced Dictionary',
      baseWords: ['test', 'word'],
      rules: ['u', 'l', 'c', 'r'],
      transformations: ['leet', 'append_year'],
      async: true
    }

    const response = await app.request('/api/queue/dictionary/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.job.rules).toBe(4)
    expect(data.job.transformations).toBe(3) // baseWords + rules + transformations
  })

  it('should generate dictionary synchronously for small requests', async () => {
    const requestData = {
      name: 'Small Dictionary',
      baseWords: ['test', 'word'],
      transformations: ['upper'],
      async: false
    }

    const response = await app.request('/api/queue/dictionary/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toBe('Dictionary generated successfully')
    expect(data.dictionary).toBeDefined()
    expect(data.dictionary.name).toBe('Small Dictionary')
    expect(data.dictionary.wordCount).toBeGreaterThan(0)
    expect(data.dictionary.status).toBe('ready')
  })

  it('should reject synchronous generation for large requests', async () => {
    const largeWordList = Array.from({ length: 1001 }, (_, i) => `word${i}`)

    const requestData = {
      name: 'Large Dictionary',
      baseWords: largeWordList,
      async: false
    }

    const response = await app.request('/api/queue/dictionary/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe('Request too large for synchronous generation')
  })

  it('should validate dictionary name uniqueness', async () => {
    // Create first dictionary
    const firstResponse = await app.request('/api/queue/dictionary/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Duplicate Test Dictionary',
        baseWords: ['test'],
        async: true
      })
    })

    expect(firstResponse.status).toBe(200)

    // Try to create dictionary with same name
    const secondResponse = await app.request('/api/queue/dictionary/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Duplicate Test Dictionary',
        baseWords: ['test2'],
        async: true
      })
    })

    expect(secondResponse.status).toBe(400)
    const data = await secondResponse.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe('Dictionary name already exists')
  })

  it('should validate input size limits', async () => {
    // Test too many base words
    const tooManyWords = Array.from({ length: 10001 }, (_, i) => `word${i}`)

    const response = await app.request('/api/queue/dictionary/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Too Large Dictionary',
        baseWords: tooManyWords,
        async: true
      })
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe('Too many base words')
  })

  it('should validate too many rules', async () => {
    const tooManyRules = Array.from({ length: 101 }, (_, i) => 'u')

    const response = await app.request('/api/queue/dictionary/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Too Many Rules Dictionary',
        baseWords: ['test'],
        rules: tooManyRules,
        async: true
      })
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe('Too many rules')
  })

  it('should validate too many transformations', async () => {
    const tooManyTransformations = Array.from({ length: 51 }, (_, i) => `transform${i}`)

    const response = await app.request('/api/queue/dictionary/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Too Many Transformations Dictionary',
        baseWords: ['test'],
        transformations: tooManyTransformations,
        async: true
      })
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe('Too many transformations')
  })

  it('should require dictionary name', async () => {
    const response = await app.request('/api/queue/dictionary/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: '',
        baseWords: ['test'],
        async: true
      })
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.success).toBe(false)
  })

  it('should return dictionary templates', async () => {
    const response = await app.request('/api/queue/dictionary/templates', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.wordLists).toBeDefined()
    expect(data.data.transformations).toBeDefined()
    expect(data.data.commonRules).toBeDefined()

    // Check word lists
    expect(data.data.wordLists.commonPasswords).toBeDefined()
    expect(data.data.wordLists.commonPasswords.words).toBeInstanceOf(Array)
    expect(data.data.wordLists.commonPasswords.words.length).toBeGreaterThan(0)

    // Check transformations
    expect(Array.isArray(data.data.transformations)).toBe(true)
    expect(data.data.transformations.length).toBeGreaterThan(0)

    // Check common rules
    expect(Array.isArray(data.data.commonRules)).toBe(true)
    expect(data.data.commonRules.length).toBeGreaterThan(0)
  })

  it('should handle dictionary generation with no base words', async () => {
    const response = await app.request('/api/queue/dictionary/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'No Base Words Dictionary',
        async: true
      })
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.job.baseWords).toBe(0)
  })
})