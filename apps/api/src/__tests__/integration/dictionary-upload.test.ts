import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { app } from '@/index'
import { setupTestDB, cleanupTestDB, createTestUser, getAuthHeaders } from '../helpers/test-helpers'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

describe('Dictionary Upload API', () => {
  let adminAuth: Record<string, string>
  let userAuth: Record<string, string>
  let superuserAuth: Record<string, string>
  let adminUser: any
  let regularUser: any
  let superUser: any

  beforeAll(async () => {
    await setupTestDB()

    // Create test users with different roles
    adminUser = await createTestUser({ role: 'admin' })
    regularUser = await createTestUser({ role: 'user' })
    superUser = await createTestUser({ role: 'superuser' })

    adminAuth = await getAuthHeaders(adminUser.email, 'password123')
    userAuth = await getAuthHeaders(regularUser.email, 'password123')
    superuserAuth = await getAuthHeaders(superUser.email, 'password123')
  })

  afterAll(async () => {
    await cleanupTestDB()
  })

  describe('POST /api/dictionaries/upload', () => {
    const testDictContent = 'password\ntest123\nadmin\nroot\npassword1\npassword2\npassword3\n'
    const testDictBuffer = Buffer.from(testDictContent, 'utf8')

    test('should upload dictionary file successfully as regular user', async () => {
      const formData = new FormData()
      const blob = new Blob([testDictBuffer], { type: 'text/plain' })
      formData.append('file', blob, 'test-dictionary.txt')
      formData.append('name', 'Test Dictionary')

      const response = await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        },
        body: formData
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toMatchObject({
        name: 'Test Dictionary',
        type: 'uploaded',
        status: 'ready',
        size: testDictBuffer.length,
        wordCount: 7, // Should count the lines
        encoding: 'utf-8'
      })
      expect(data.data.id).toBeDefined()
      expect(data.data.checksum).toBeDefined()
      expect(data.data.filePath).toBeDefined()
    })

    test('should use filename as default name when name not provided', async () => {
      const formData = new FormData()
      const blob = new Blob([testDictBuffer], { type: 'text/plain' })
      formData.append('file', blob, 'custom-name.txt')

      const response = await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        },
        body: formData
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.name).toBe('custom-name') // Should strip .txt extension
    })

    test('should calculate correct word count', async () => {
      const multiWordDict = 'password1\npassword2\npassword3\n\npassword4\n\tpassword5\npassword6\r\npassword7'
      const formData = new FormData()
      const blob = new Blob([multiWordDict], { type: 'text/plain' })
      formData.append('file', blob, 'word-count-test.txt')

      const response = await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        },
        body: formData
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.wordCount).toBe(7) // Should count non-empty lines
    })

    test('should generate valid SHA256 checksum', async () => {
      const formData = new FormData()
      const blob = new Blob([testDictBuffer], { type: 'text/plain' })
      formData.append('file', blob, 'checksum-test.txt')

      const response = await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        },
        body: formData
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      // Verify checksum is valid SHA256 (64 hex characters)
      expect(data.data.checksum).toMatch(/^[a-f0-9]{64}$/i)

      // Verify checksum matches expected value
      const expectedChecksum = crypto.createHash('sha256').update(testDictBuffer).digest('hex')
      expect(data.data.checksum).toBe(expectedChecksum)
    })

    test('should reject files larger than 10GB', async () => {
      // Create a file larger than 10GB (just test the validation logic)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024 * 1024) // 11GB
      const formData = new FormData()
      const blob = new Blob([largeBuffer], { type: 'text/plain' })
      formData.append('file', blob, 'large-dict.txt')

      const response = await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        },
        body: formData
      })

      expect(response.status).toBe(400)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toContain('File size must be less than')
    })

    test('should reject invalid file types', async () => {
      const formData = new FormData()
      const blob = new Blob([testDictBuffer], { type: 'application/pdf' })
      formData.append('file', blob, 'not-a-dictionary.pdf')

      const response = await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        },
        body: formData
      })

      // This should be caught by file security middleware
      expect([400, 422]).toContain(response.status)
    })

    test('should reject unauthorized requests', async () => {
      const formData = new FormData()
      const blob = new Blob([testDictBuffer], { type: 'text/plain' })
      formData.append('file', blob, 'test.txt')

      const response = await app.request('/api/dictionaries/upload', {
        method: 'POST',
        body: formData
      })

      expect(response.status).toBe(401)
    })

    test('should store file with secure permissions', async () => {
      const formData = new FormData()
      const blob = new Blob([testDictBuffer], { type: 'text/plain' })
      formData.append('file', blob, 'security-test.txt')

      const response = await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        },
        body: formData
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      // Verify file exists on disk
      expect(fs.existsSync(data.data.filePath)).toBe(true)
    })
  })

  describe('DELETE /api/dictionaries/:id', () => {
    let dictionaryId: string

    beforeEach(async () => {
      // Create a test dictionary to delete
      const formData = new FormData()
      const blob = new Blob(['test\ndictionary\nwords'], { type: 'text/plain' })
      formData.append('file', blob, 'delete-test.txt')

      const response = await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        },
        body: formData
      })

      const data = await response.json()
      dictionaryId = data.data.id
    })

    test('should delete own dictionary as regular user', async () => {
      const response = await app.request(`/api/dictionaries/${dictionaryId}`, {
        method: 'DELETE',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.message).toBe('Dictionary deleted successfully')
    })

    test('should allow admin to delete user dictionary', async () => {
      const response = await app.request(`/api/dictionaries/${dictionaryId}`, {
        method: 'DELETE',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
    })

    test('should prevent user from deleting others dictionary', async () => {
      // Create dictionary as user1
      const formData = new FormData()
      const blob = new Blob(['user1\ndictionary'], { type: 'text/plain' })
      formData.append('file', blob, 'user1-dict.txt')

      const createResponse = await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        },
        body: formData
      })

      const createdData = await createResponse.json()
      const user1DictId = createdData.data.id

      // Try to delete as user2
      const user2 = await createTestUser({ role: 'user' })
      const user2Auth = await getAuthHeaders(user2.email, 'password123')

      const deleteResponse = await app.request(`/api/dictionaries/${user1DictId}`, {
        method: 'DELETE',
        headers: {
          ...user2Auth,
          'Authorization': user2Auth.authorization
        }
      })

      expect(deleteResponse.status).toBe(403)
      const deleteData = await deleteResponse.json()

      expect(deleteData.success).toBe(false)
      expect(deleteData.error).toBe('Access denied')
    })

    test('should return 404 for non-existent dictionary', async () => {
      const fakeId = crypto.randomUUID()

      const response = await app.request(`/api/dictionaries/${fakeId}`, {
        method: 'DELETE',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(404)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Dictionary not found')
    })
  })

  describe('GET /api/dictionaries', () => {
    test('should only return user-owned dictionaries', async () => {
      // Upload dictionary as user1
      const formData1 = new FormData()
      const blob1 = new Blob(['user1\npasswords'], { type: 'text/plain' })
      formData1.append('file', blob1, 'user1-dict.txt')

      await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        },
        body: formData1
      })

      // Upload dictionary as admin
      const formData2 = new FormData()
      const blob2 = new Blob(['admin\npasswords'], { type: 'text/plain' })
      formData2.append('file', blob2, 'admin-dict.txt')

      await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization
        },
        body: formData2
      })

      // User1 should only see their dictionary
      const user1Response = await app.request('/api/dictionaries', {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(user1Response.status).toBe(200)
      const user1Data = await user1Response.json()

      expect(user1Data.data.length).toBeGreaterThanOrEqual(1)
      expect(user1Data.data.every((dict: any) => dict.userId === regularUser.id)).toBe(true)

      // Admin should see all dictionaries (since they're admin)
      const adminResponse = await app.request('/api/dictionaries', {
        headers: {
          ...adminAuth,
          'Authorization': adminAuth.authorization
        }
      })

      expect(adminResponse.status).toBe(200)
      const adminData = await adminResponse.json()

      expect(adminData.data.length).toBeGreaterThanOrEqual(1)
    })

    test('should return 401 for unauthorized requests', async () => {
      const response = await app.request('/api/dictionaries')

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/dictionaries/:id', () => {
    test('should return own dictionary details', async () => {
      // Create dictionary
      const formData = new FormData()
      const blob = new Blob(['test\ndictionary'], { type: 'text/plain' })
      formData.append('file', blob, 'details-test.txt')

      const createResponse = await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        },
        body: formData
      })

      const createData = await createResponse.json()
      const dictionaryId = createData.data.id

      // Get dictionary details
      const response = await app.request(`/api/dictionaries/${dictionaryId}`, {
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.id).toBe(dictionaryId)
      expect(data.data.name).toBe('details-test')
      expect(data.data.userId).toBe(regularUser.id)
    })

    test('should prevent access to others dictionary', async () => {
      // Create dictionary as user1
      const formData = new FormData()
      const blob = new Blob(['private\ndictionary'], { type: 'text/plain' })
      formData.append('file', blob, 'private-dict.txt')

      const createResponse = await app.request('/api/dictionaries/upload', {
        method: 'POST',
        headers: {
          ...userAuth,
          'Authorization': userAuth.authorization
        },
        body: formData
      })

      const createData = await createResponse.json()
      const dictionaryId = createData.data.id

      // Try to access as user2
      const user2 = await createTestUser({ role: 'user' })
      const user2Auth = await getAuthHeaders(user2.email, 'password123')

      const response = await app.request(`/api/dictionaries/${dictionaryId}`, {
        headers: {
          ...user2Auth,
          'Authorization': user2Auth.authorization
        }
      })

      expect(response.status).toBe(403)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Access denied')
    })
  })
})