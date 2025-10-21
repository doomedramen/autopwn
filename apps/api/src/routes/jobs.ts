import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@/db'
import { jobs, selectJobSchema } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

const jobs = new Hono()

// Get all jobs
jobs.get('/', async (c) => {
  try {
    const allJobs = await db.query.jobs.findMany({
      orderBy: [desc(jobs.createdAt)],
      with: {
        network: true,
        dictionary: true,
      },
    })

    return c.json({
      success: true,
      data: allJobs,
      count: allJobs.length,
    })
  } catch (error) {
    console.error('Get jobs error:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch jobs',
    }, 500)
  }
})

// Get single job by ID
jobs.get('/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, id),
      with: {
        network: true,
        dictionary: true,
      },
    })

    if (!job) {
      return c.json({
        success: false,
        error: 'Job not found',
      }, 404)
    }

    return c.json({
      success: true,
      data: job,
    })
  } catch (error) {
    console.error('Get job error:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch job',
    }, 500)
  }
})

export { jobs as jobsRoutes }