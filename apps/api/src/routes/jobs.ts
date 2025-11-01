import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@/db'
import { jobs, selectJobSchema } from '@/db/schema'
import { eq, desc, and, isNull } from 'drizzle-orm'
import { createNotFoundError, createValidationError } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

// Job update schema
const updateJobSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
  progress: z.number().min(0).max(100).optional(),
  hashcatMode: z.number().optional(),
  dictionaryId: z.string().uuid().optional()
})

const jobs = new Hono()

/**
 * Get all jobs with filtering and pagination
 */
jobs.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const status = c.req.query('status') as string
    const offset = (page - 1) * limit

    let whereCondition = undefined
    if (status) {
      whereCondition = eq(jobs.status, status)
    }

    const allJobs = await db.query.jobs.findMany({
      where: whereCondition,
      orderBy: [desc(jobs.createdAt)],
      with: {
        network: true,
        dictionary: true,
      },
      limit,
      offset
    })

    const totalCount = await db.query.jobs.findMany({
      where: whereCondition
    })

    return c.json({
      success: true,
      data: allJobs,
      pagination: {
        page,
        limit,
        total: totalCount.length,
        pages: Math.ceil(totalCount.length / limit),
        hasNext: page * limit < totalCount.length,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    logger.error('get_jobs_error', 'jobs', {
      error: error.message,
      page: c.req.query('page'),
      limit: c.req.query('limit'),
      status: c.req.query('status')
    })

    return c.json({
      success: false,
      error: 'Failed to fetch jobs',
      message: error.message
    }, 500)
  }
})

/**
 * Get single job by ID with full details
 */
jobs.get('/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, id),
      with: {
        network: true,
        dictionary: true,
        results: true, // Include job results
      },
    })

    if (!job) {
      return c.json({
        success: false,
        error: 'Job not found',
        message: `No job found with ID: ${id}`
      }, 404)
    }

    return c.json({
      success: true,
      data: job
    })
  } catch (error) {
    logger.error('get_job_error', 'jobs', {
      error: error.message,
      jobId: id
    })

    return c.json({
      success: false,
      error: 'Failed to fetch job',
      message: error.message
    }, 500)
  }
})

/**
 * Create new job
 */
jobs.post('/', zValidator('json', z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000),
  type: z.enum(['wordlist', 'mask', 'hybrid']),
  dictionaryId: z.string().uuid().optional(),
  targetFile: z.string().optional(),
  hashcatMode: z.number().optional(),
  options: z.record(z.string()).optional()
})), async (c) => {
  try {
    const userId = c.get('userId')
    const { name, description, type, dictionaryId, targetFile, hashcatMode, options } = c.req.valid('json')

    // Validate required fields
    if (!dictionaryId) {
      return c.json({
        success: false,
        error: 'Validation failed',
        message: 'dictionaryId is required',
        code: 'MISSING_DICTIONARY_ID'
      }, 400)
    }

    // For now, we'll require networkId to be provided via metadata
    // In a real workflow, this might come from PCAP processing
    const networkId = options?.networkId
    if (!networkId) {
      return c.json({
        success: false,
        error: 'Validation failed',
        message: 'networkId is required (should be provided in options)',
        code: 'MISSING_NETWORK_ID'
      }, 400)
    }

    const [newJob] = await db.insert(jobs).values({
      name,
      description,
      userId,
      networkId,
      dictionaryId,
      config: {
        type,
        hashcatMode: hashcatMode || 22000, // Default to handshake mode
        targetFile,
        ...options
      },
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    logger.info('job_created', 'jobs', {
      jobId: newJob.id,
      userId,
      type,
      name
    })

    return c.json({
      success: true,
      data: newJob
    })
  } catch (error) {
    logger.error('create_job_error', 'jobs', {
      error: error.message,
      userId: c.get('userId'),
      jobData: c.req.valid('json')
    })

    return c.json({
      success: false,
      error: 'Failed to create job',
      message: error.message
    }, 500)
  }
})

/**
 * Update existing job
 */
jobs.put('/:id', zValidator('json', updateJobSchema), async (c) => {
  try {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const updates = c.req.valid('json')

    // Verify job exists and user owns it
    const existingJob = await db.query.jobs.findFirst({
      where: eq(jobs.id, id)
    })

    if (!existingJob) {
      return c.json({
        success: false,
        error: 'Job not found',
        message: `No job found with ID: ${id}`
      }, 404)
    }

    if (existingJob.userId !== userId) {
      return c.json({
        success: false,
        error: 'Permission denied',
        message: 'You do not have permission to update this job'
      }, 403)
    }

    const [updatedJob] = await db.update(jobs)
      .set(updates)
      .where(eq(jobs.id, id))
      .returning()

    logger.info('job_updated', 'jobs', {
      jobId: id,
      userId,
      updates: Object.keys(updates)
    })

    return c.json({
      success: true,
      data: updatedJob
    })
  } catch (error) {
    logger.error('update_job_error', 'jobs', {
      error: error.message,
      jobId: c.req.param('id'),
      userId: c.get('userId'),
      updates: c.req.valid('json')
    })

    return c.json({
      success: false,
      error: 'Failed to update job',
      message: error.message
    }, 500)
  }
})

/**
 * Cancel job
 */
jobs.delete('/:id', async (c) => {
  try {
    const userId = c.get('userId')
    const id = c.req.param('id')

    // Verify job exists and user owns it
    const existingJob = await db.query.jobs.findFirst({
      where: eq(jobs.id, id)
    })

    if (!existingJob) {
      return c.json({
        success: false,
        error: 'Job not found',
        message: `No job found with ID: ${id}`
      }, 404)
    }

    if (existingJob.userId !== userId) {
      return c.json({
        success: false,
        error: 'Permission denied',
        message: 'You do not have permission to cancel this job'
      }, 403)
    }

    // Only allow cancellation of pending jobs
    if (!['pending', 'running'].includes(existingJob.status)) {
      return c.json({
        success: false,
        error: 'Invalid job status',
        message: 'Only pending or running jobs can be cancelled'
      }, 400)
    }

    const [cancelledJob] = await db.update(jobs)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(jobs.id, id))
      .returning()

    logger.info('job_cancelled', 'jobs', {
      jobId: id,
      userId,
      previousStatus: existingJob.status
    })

    return c.json({
      success: true,
      data: cancelledJob
    })
  } catch (error) {
    logger.error('cancel_job_error', 'jobs', {
      error: error.message,
      jobId: c.req.param('id'),
      userId: c.get('userId')
    })

    return c.json({
      success: false,
      error: 'Failed to cancel job',
      message: error.message
    }, 500)
  }
})

/**
 * Get job statistics
 */
jobs.get('/stats', async (c) => {
  try {
    const userId = c.get('userId')

    const userJobs = await db.query.jobs.findMany({
      where: eq(jobs.userId, userId),
      columns: {
        status: true
      }
    })

    const stats = {
      total: userJobs.length,
      pending: userJobs.filter(job => job.status === 'pending').length,
      running: userJobs.filter(job => job.status === 'running').length,
      completed: userJobs.filter(job => job.status === 'completed').length,
      failed: userJobs.filter(job => job.status === 'failed').length,
      cancelled: userJobs.filter(job => job.status === 'cancelled').length
    }

    return c.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('job_stats_error', 'jobs', {
      error: error.message,
      userId: c.get('userId')
    })

    return c.json({
      success: false,
      error: 'Failed to get job statistics',
      message: error.message
    }, 500)
  }
})

export { jobs as jobsRoutes }