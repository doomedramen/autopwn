import { setupServer } from 'msw/node'
import { rest } from 'msw'
import { TestDataFactory } from '../utils/test-data-factory'

// API handlers for MSW
export const handlers = [
  // Auth endpoints
  rest.post('/api/auth/sign-in', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          user: TestDataFactory.createUser(),
          session: {
            token: 'test-session-token',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          }
        }
      })
    )
  }),

  rest.post('/api/auth/sign-up', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: TestDataFactory.createUser()
      })
    )
  }),

  rest.post('/api/auth/sign-out', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        message: 'Signed out successfully'
      })
    )
  }),

  rest.get('/api/auth/me', (req, res, ctx) => {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(
        ctx.status(401),
        ctx.json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated'
          }
        })
      )
    }

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: TestDataFactory.createUser()
      })
    )
  }),

  // Jobs endpoints
  rest.get('/api/jobs', (req, res, ctx) => {
    const page = parseInt(req.url.searchParams.get('page') || '1')
    const limit = parseInt(req.url.searchParams.get('limit') || '10')

    const jobs = Array.from({ length: limit }, (_, i) =>
      TestDataFactory.createJob({
        id: `job-${page}-${i}`,
        name: `Job ${page}-${i}`,
        status: ['pending', 'running', 'completed', 'failed'][i % 4]
      })
    )

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          jobs,
          pagination: {
            page,
            limit,
            total: 100,
            pages: 10
          }
        }
      })
    )
  }),

  rest.post('/api/jobs', async (req, res, ctx) => {
    const jobData = await req.json()
    const newJob = TestDataFactory.createJob(jobData)

    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: newJob
      })
    )
  }),

  rest.get('/api/jobs/:id', (req, res, ctx) => {
    const { id } = req.params
    const job = TestDataFactory.createJob({ id })

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: job
      })
    )
  }),

  rest.delete('/api/jobs/:id', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        message: 'Job deleted successfully'
      })
    )
  }),

  // Network captures endpoints
  rest.get('/api/captures', (req, res, ctx) => {
    const captures = Array.from({ length: 5 }, (_, i) =>
      TestDataFactory.createNetworkCapture({
        id: `capture-${i}`,
        filename: `capture_${i}.pcap`
      })
    )

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: captures
      })
    )
  }),

  rest.post('/api/captures', async (req, res, ctx) => {
    // Handle file upload
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: TestDataFactory.createNetworkCapture({
          filename: 'uploaded_capture.pcap'
        })
      })
    )
  }),

  rest.delete('/api/captures/:id', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        message: 'Capture deleted successfully'
      })
    )
  }),

  // Dictionaries endpoints
  rest.get('/api/dictionaries', (req, res, ctx) => {
    const dictionaries = Array.from({ length: 10 }, (_, i) =>
      TestDataFactory.createDictionary({
        id: `dict-${i}`,
        name: `Dictionary ${i}`,
        size: 1000 * (i + 1)
      })
    )

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: dictionaries
      })
    )
  }),

  // Queue status endpoints
  rest.get('/api/queue/status', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          waiting: 5,
          active: 2,
          completed: 100,
          failed: 3,
          workerStatus: 'healthy'
        }
      })
    )
  }),

  // Health check
  rest.get('/api/health', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      })
    )
  }),

  // Error handlers
  rest.get('/api/error-test', (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Test error for testing error handling'
        }
      })
    )
  })
]

// Create MSW server
export const server = setupServer(...handlers)

// Export for use in tests
export { rest }