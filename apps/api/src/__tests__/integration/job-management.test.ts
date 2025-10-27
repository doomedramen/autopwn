import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { db } from '../../../db'
import { jobs, networkCaptures, users } from '../../../db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { createSuccessResponse, createValidationError } from '../../../lib/error-handler'
import { createJob } from '../../../lib/queue'

describe('Job Management Integration Tests', () => {
  let app: Hono
  let testUserId: string

  beforeAll(async () => {
    // Setup test database and user
    testUserId = 'test-user-integration'

    // Create test user
    await db.insert(users).values({
      id: testUserId,
      email: 'test-integration@example.com',
      password: 'test_password_hash',
      role: 'user',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Setup test app
    app = new Hono()

    // Mock queue health check
    vi.mock('@/lib/queue', () => ({
      createJob: vi.fn().mockResolvedValue({ success: true, jobId: 'test-job-id' }),
      checkQueueHealth: vi.fn().mockResolvedValue({
        status: 'healthy',
        workers: { active: 2, idle: 1 }
      })
    }))
  })

  beforeEach(async () => {
    // Clean up any test data
    await db.delete(jobs).where(eq(jobs.userId, testUserId))
    await db.delete(networkCaptures).where(eq(networkCaptures.userId, testUserId))
  })

  afterEach(async () => {
    // Clean up test data
    await db.delete(jobs).where(eq(jobs.userId, testUserId))
    await db.delete(networkCaptures).where(eq(networkCaptures.userId, testUserId))
  })

  describe('Job Creation', () => {
    it('should create job with valid data', async () => {
      const mockJobData = {
        name: 'Test Job',
        description: 'Integration test job',
        type: 'wordlist',
        dictionaryId: 'test-dict-id',
        targetFile: '/test/file.pcap',
        hashcatMode: 22000,
        options: { test: 'value' }
      }

      const mockContext = {
        req: {
          json: vi.fn().mockReturnValue(mockJobData),
          header: vi.fn().mockReturnValue('test-token'),
          param: vi.fn().mockReturnValue('test-user-id')
        }
      }

      // Mock the response methods
      const mockResponse = {
        status: vi.fn().mockReturnValue(200),
        json: vi.fn().mockImplementation((data) => {
          return data
        })
      }

      Object.assign(app, mockResponse)

      const response = await app.request('/api/jobs', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
        json: mockJobData
      } as any)

      expect(response.status).toHaveBeenCalledWith(200)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            name: 'Test Job',
            type: 'wordlist',
            userId: testUserId,
            status: 'pending'
          })
        })
      )

      // Verify job was created in database
      const createdJobs = await db.query.jobs.findMany({
        where: eq(jobs.userId, testUserId)
      })

      expect(createdJobs).toHaveLength(1)
      expect(createdJobs[0]).toMatchObject({
        name: 'Test Job',
        description: 'Integration test job',
        type: 'wordlist',
        userId: testUserId,
        status: 'pending'
      })

      // Verify job was added to queue
      const { createJob } = await import('@/lib/queue')
      expect(createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'wordlist',
          userId: testUserId,
          targetFile: '/test/file.pcap',
          options: { test: 'value' }
        })
      )
    })

    it('should reject job creation without required fields', async () => {
      const invalidJobData = {
        name: '', // Missing required field
        type: 'invalid_type', // Invalid enum value
        hashcatMode: 99999 // Invalid mode
      }

      const mockResponse = {
        status: vi.fn().mockReturnValue(200),
        json: vi.fn().mockImplementation((data) => {
          return data
        })
      }

      Object.assign(app, mockResponse)

      const response = await app.request('/api/jobs', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
        json: invalidJobData
      } as any)

      expect(response.status).toHaveBeenCalledWith(200)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Validation failed')
        })
      )
    })
  })

  describe('Job Status and Updates', () => {
    it('should get job status successfully', async () => {
      // First create a test job
      const [testJob] = await db.insert(jobs).values({
        id: 'status-test-job',
        userId: testUserId,
        name: 'Status Test Job',
        description: 'Job for status testing',
        type: 'wordlist',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const mockResponse = {
        status: vi.fn().mockReturnValue(200),
        json: vi.fn().mockImplementation((data) => {
          return data
        })
      }

      Object.assign(app, mockResponse)

      const response = await app.request(`/api/jobs/${testJob.id}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' }
      } as any)

      expect(response.status).toHaveBeenCalledWith(200)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: testJob.id,
            userId: testUserId,
            name: 'Status Test Job',
            status: 'pending'
          })
        })
      )
    })

    it('should update job status successfully', async () => {
      // Create a test job to update
      const [testJob] = await db.insert(jobs).values({
        id: 'update-test-job',
        userId: testUserId,
        name: 'Update Test Job',
        description: 'Job for update testing',
        type: 'wordlist',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const updateData = {
        status: 'running',
        progress: 25
      }

      const mockResponse = {
        status: vi.fn().mockReturnValue(200),
        json: vi.fn().mockImplementation((data) => {
          return data
        })
      }

      Object.assign(app, mockResponse)

      const response = await app.request(`/api/jobs/${testJob.id}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer test-token' },
        json: updateData
      } as any)

      expect(response.status).toHaveBeenCalledWith(200)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: testJob.id,
            userId: testUserId,
            name: 'Update Test Job',
            status: 'running',
            progress: 25
          })
        })
      )

      // Verify update in database
      const updatedJob = await db.query.jobs.findFirst({
        where: eq(jobs.id, testJob.id)
      })

      expect(updatedJob).toMatchObject({
        id: testJob.id,
        userId: testUserId,
        name: 'Update Test Job',
        status: 'running',
        progress: 25
      })
    })

    it('should handle job not found in status request', async () => {
      const mockResponse = {
        status: vi.fn().mockReturnValue(404),
        json: vi.fn().mockImplementation((data) => {
          return data
        })
      }

      Object.assign(app, mockResponse)

      const response = await app.request('/api/jobs/non-existent-job', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' }
      } as any)

      expect(response.status).toHaveBeenCalledWith(404)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('not found')
        })
      )
    })
  })

  describe('Job Listing and Filtering', () => {
    beforeEach(async () => {
      // Create test jobs for listing
      await db.insert(jobs).values([
        {
          id: 'job-1',
          userId: testUserId,
          name: 'Job 1',
          description: 'Test job 1',
          type: 'wordlist',
          status: 'completed',
          createdAt: new Date(Date.now() - 86400000), // 1 day ago
          updatedAt: new Date(Date.now() - 86400000)
        },
        {
          id: 'job-2',
          userId: testUserId,
          name: 'Job 2',
          description: 'Test job 2',
          type: 'mask',
          status: 'running',
          createdAt: new Date(Date.now() - 43200000), // 12 hours ago
          updatedAt: new Date(Date.now() - 43200000)
        },
        {
          id: 'job-3',
          userId: testUserId,
          name: 'Job 3',
          description: 'Test job 3',
          type: 'hybrid',
          status: 'failed',
          createdAt: new Date(Date.now() - 21600000), // 6 hours ago
          updatedAt: new Date(Date.now() - 21600000)
        }
      ])
    })

    it('should list all jobs without filters', async () => {
      const mockResponse = {
        status: vi.fn().mockReturnValue(200),
        json: vi.fn().mockImplementation((data) => {
          return data
        })
      }

      Object.assign(app, mockResponse)

      const response = await app.request('/api/jobs', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' }
      } as any)

      expect(response.status).toHaveBeenCalledWith(200)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            jobs: expect.arrayContaining([
              expect.objectContaining({ name: 'Job 1', status: 'completed' }),
              expect.objectContaining({ name: 'Job 2', status: 'running' }),
              expect.objectContaining({ name: 'Job 3', status: 'failed' })
            ]),
            count: 3,
            pagination: expect.any(Object)
          })
        })
      )
    })

    it('should filter jobs by status', async () => {
      const mockResponse = {
        status: vi.fn().mockReturnValue(200),
        json: vi.fn().mockImplementation((data) => {
          return data
        })
      }

      Object.assign(app, mockResponse)

      const response = await app.request('/api/jobs?status=completed', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' }
      } as any)

      expect(response.status).toHaveBeenCalledWith(200)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            jobs: expect.arrayContaining([
              expect.objectContaining({ name: 'Job 1', status: 'completed' })
            ]),
            count: 1,
            pagination: expect.any(Object)
          })
        })
      )
    })

    it('should paginate job listings', async () => {
      const mockResponse = {
        status: vi.fn().mockReturnValue(200),
        json: vi.fn().mockImplementation((data) => {
          return data
        })
      }

      Object.assign(app, mockResponse)

      const response = await app.request('/api/jobs?page=1&limit=2', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' }
      } as any)

      expect(response.status).toHaveBeenCalledWith(200)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            jobs: expect.arrayContaining([
              expect.objectContaining({ name: 'Job 1', status: 'completed' }),
              expect.objectContaining({ name: 'Job 2', status: 'running' })
            ]),
            count: 2,
            pagination: expect.objectContaining({
              page: 1,
              limit: 2,
              hasNext: true,
              hasPrev: false
            })
          })
        })
      )
    })
  })

  describe('Job Deletion and Cancellation', () => {
    it('should cancel a pending job successfully', async () => {
      // Create a test job to cancel
      const [testJob] = await db.insert(jobs).values({
        id: 'cancel-test-job',
        userId: testUserId,
        name: 'Cancel Test Job',
        description: 'Job for cancellation testing',
        type: 'wordlist',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      const mockResponse = {
        status: vi.fn().mockReturnValue(200),
        json: vi.fn().mockImplementation((data) => {
          return data
        })
      }

      Object.assign(app, mockResponse)

      const response = await app.request(`/api/jobs/${testJob.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' }
      } as any)

      expect(response.status).toHaveBeenCalledWith(200)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: testJob.id,
            userId: testUserId,
            name: 'Cancel Test Job',
            status: 'cancelled'
          })
        })
      )

      // Verify job status was updated
      const cancelledJob = await db.query.jobs.findFirst({
        where: eq(jobs.id, testJob.id)
      })

      expect(cancelledJob).toMatchObject({
        id: testJob.id,
        userId: testUserId,
        name: 'Cancel Test Job',
        status: 'cancelled'
      })
    })

    it('should reject cancellation of completed job', async () => {
      // Create a completed test job
      const [completedJob] = await db.insert(jobs).values({
        id: 'completed-test-job',
        userId: testUserId,
        name: 'Completed Test Job',
        description: 'Job for cancellation testing',
        type: 'wordlist',
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(Date.now() - 86400000)
      }).returning()

      const mockResponse = {
        status: vi.fn().mockReturnValue(400),
        json: vi.fn().mockImplementation((data) => {
          return data
        })
      }

      Object.assign(app, mockResponse)

      const response = await app.request(`/api/jobs/${completedJob.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' }
      } as any)

      expect(response.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Only pending or running jobs can be cancelled')
        })
      )
    })
  })

  describe('Job Statistics', () => {
    it('should get job statistics successfully', async () => {
      // The job statistics endpoint doesn't require any job data creation
      // It should return aggregated data about jobs for the user

      const mockResponse = {
        status: vi.fn().mockReturnValue(200),
        json: vi.fn().mockImplementation((data) => {
          return data
        })
      }

      Object.assign(app, mockResponse)

      const response = await app.request('/api/jobs/stats', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' }
      } as any)

      expect(response.status).toHaveBeenCalledWith(200)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            total: expect.any(Number),
            pending: expect.any(Number),
            running: expect.any(Number),
            completed: expect.any(Number),
            failed: expect.any(Number),
            cancelled: expect.any(Number)
          })
        })
      )
    })
  })
})