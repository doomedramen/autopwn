import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@/db'
import { jobs, selectJobSchema } from '@/db/schema'
import { eq, desc, and, isNull } from 'drizzle-orm'
import { createNotFoundError, createValidationError, createSuccessResponse } from '@/lib/error-handler'
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

    return createValidationError('Failed to fetch jobs')
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
      throw createNotFoundError('Job', id)
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

    throw createValidationError('Failed to fetch job')
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

    const [newJob] = await db.insert(jobs).values({
      name,
      description,
      type,
      userId,
      dictionaryId,
      hashcatMode: hashcatMode || 22000, // Default to handshake mode
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

    throw createValidationError('Failed to create job')
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
      throw createNotFoundError('Job', id)
    }

    if (existingJob.userId !== userId) {
      throw createValidationError('You do not have permission to update this job')
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

    throw createValidationError('Failed to update job')
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
      throw createNotFoundError('Job', id)
    }

    if (existingJob.userId !== userId) {
      throw createValidationError('You do not have permission to cancel this job')
    }

    // Only allow cancellation of pending jobs
    if (!['pending', 'running'].includes(existingJob.status)) {
      throw createValidationError('Only pending or running jobs can be cancelled')
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

    throw createValidationError('Failed to cancel job')
  }
})

/**
 * Get job statistics
 */
jobs.get('/stats', async (c) => {
  try {
    const userId = c.get('userId')

    const [jobStats] = await db.query.jobs.findMany({
      where: eq(jobs.userId, userId),
      columns: {
        status: true,
        total: true
      }
    })

    const stats = {
      total: jobStats.length,
      pending: jobStats.filter(job => job.status === 'pending').length,
      running: jobStats.filter(job => job.status === 'running').length,
      completed: jobStats.filter(job => job.status === 'completed').length,
      failed: jobStats.filter(job => job.status === 'failed').length,
      cancelled: jobStats.filter(job => job.status === 'cancelled').length
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

    throw createValidationError('Failed to get job statistics')
  }
})

export { jobs as jobsRoutes }