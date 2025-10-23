import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@/db'
import { jobs, networks, dictionaries } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import {
  addPCAPProcessingJob,
  addHashcatCrackingJob,
  addDictionaryGenerationJob,
  addFileCleanupJob,
  QUEUE_NAMES
} from '@/lib/queue'
import { authenticate, getUserId } from '@/middleware/auth'
import { rateLimit } from '@/middleware/rateLimit'

const queueManagement = new Hono()

// Apply authentication and rate limiting middleware to all routes
queueManagement.use('*', authenticate)
queueManagement.use('*', rateLimit())

// Create cracking job
queueManagement.post('/crack', zValidator('json', z.object({
  networkId: z.string().min(1),
  dictionaryId: z.string().min(1),
  attackMode: z.enum(['pmkid', 'handshake']).default('handshake'),
})), async (c) => {
  const data = c.req.valid('json')
  const userId = getUserId(c)

  try {
    // Verify network exists and has handshake/PMKID
    const network = await db.query.networks.findFirst({
      where: eq(networks.id, data.networkId)
    })

    if (!network) {
      return c.json({
        success: false,
        error: 'Network not found',
      }, 404)
    }

    // Verify dictionary exists
    const dictionary = await db.query.dictionaries.findFirst({
      where: eq(dictionaries.id, data.dictionaryId)
    })

    if (!dictionary) {
      return c.json({
        success: false,
        error: 'Dictionary not found',
      }, 404)
    }

    // Create job record
    const [newJob] = await db.insert(jobs).values({
      networkId: data.networkId,
      dictionaryId: data.dictionaryId,
      status: 'queued',
      attackMode: data.attackMode,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    // Add to queue
    await addHashcatCrackingJob({
      jobId: newJob.id,
      networkId: data.networkId,
      dictionaryId: data.dictionaryId,
      handshakePath: network.filePath || '', // This would be the extracted handshake file
      dictionaryPath: dictionary.filePath || '',
      attackMode: data.attackMode,
      userId
    })

    return c.json({
      success: true,
      message: 'Cracking job queued successfully',
      job: {
        id: newJob.id,
        networkId: data.networkId,
        dictionaryId: data.dictionaryId,
        attackMode: data.attackMode,
        status: 'queued',
        createdAt: newJob.createdAt
      }
    })

  } catch (error) {
    console.error('Create cracking job error:', error)
    return c.json({
      success: false,
      error: 'Failed to create cracking job',
    }, 500)
  }
})

// Generate dictionary job
queueManagement.post('/dictionary/generate', zValidator('json', z.object({
  name: z.string().min(1),
  baseWords: z.array(z.string()).optional(),
  rules: z.array(z.string()).optional(),
  transformations: z.array(z.string()).optional(),
})), async (c) => {
  const data = c.req.valid('json')
  const userId = getUserId(c)

  try {
    // Add to queue
    await addDictionaryGenerationJob({
      name: data.name,
      baseWords: data.baseWords,
      rules: data.rules,
      transformations: data.transformations,
      userId
    })

    return c.json({
      success: true,
      message: 'Dictionary generation job queued successfully',
      job: {
        name: data.name,
        baseWords: data.baseWords?.length || 0,
        rules: data.rules?.length || 0,
        transformations: data.transformations?.length || 0,
        status: 'queued'
      }
    })

  } catch (error) {
    console.error('Generate dictionary job error:', error)
    return c.json({
      success: false,
      error: 'Failed to queue dictionary generation',
    }, 500)
  }
})

// Get queue statistics
queueManagement.get('/stats', async (c) => {
  try {
    // Get job counts by status
    const [queuedJobs, runningJobs, completedJobs, failedJobs] = await Promise.all([
      db.select().from(jobs).where(eq(jobs.status, 'queued')),
      db.select().from(jobs).where(eq(jobs.status, 'running')),
      db.select().from(jobs).where(eq(jobs.status, 'completed')),
      db.select().from(jobs).where(eq(jobs.status, 'failed')),
    ])

    // Get recent jobs
    const recentJobs = await db.query.jobs.findMany({
      where: eq(jobs.userId, getUserId(c)),
      with: {
        network: true,
        dictionary: true,
      },
      orderBy: [(jobs, { desc }) => [desc(jobs.createdAt)]],
      limit: 10
    })

    return c.json({
      success: true,
      stats: {
        queued: queuedJobs.length,
        running: runningJobs.length,
        completed: completedJobs.length,
        failed: failedJobs.length,
        total: queuedJobs.length + runningJobs.length + completedJobs.length + failedJobs.length
      },
      recentJobs,
      queues: {
        [QUEUE_NAMES.PCAP_PROCESSING]: 'PCAP Processing',
        [QUEUE_NAMES.HASHCAT_CRACKING]: 'Hashcat Cracking',
        [QUEUE_NAMES.DICTIONARY_GENERATION]: 'Dictionary Generation',
        [QUEUE_NAMES.FILE_CLEANUP]: 'File Cleanup'
      }
    })

  } catch (error) {
    console.error('Get queue stats error:', error)
    return c.json({
      success: false,
      error: 'Failed to get queue statistics',
    }, 500)
  }
})

// Cancel job
queueManagement.delete('/jobs/:id', async (c) => {
  const jobId = c.req.param('id')
  const userId = getUserId(c)

  try {
    // Update job status to cancelled
    const [cancelledJob] = await db.update(jobs)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, userId)
      ))
      .returning()

    if (!cancelledJob) {
      return c.json({
        success: false,
        error: 'Job not found or you do not have permission to cancel it',
      }, 404)
    }

    // Note: In BullMQ, you would also want to cancel the job in the queue
    // This would require access to the queue instance and job ID from BullMQ

    return c.json({
      success: true,
      message: 'Job cancelled successfully',
      job: cancelledJob
    })

  } catch (error) {
    console.error('Cancel job error:', error)
    return c.json({
      success: false,
      error: 'Failed to cancel job',
    }, 500)
  }
})

// Retry failed job
queueManagement.post('/jobs/:id/retry', async (c) => {
  const jobId = c.req.param('id')
  const userId = getUserId(c)

  try {
    // Get the failed job
    const failedJob = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.id, jobId),
        eq(jobs.userId, userId),
        eq(jobs.status, 'failed')
      ),
      with: {
        network: true,
        dictionary: true,
      }
    })

    if (!failedJob) {
      return c.json({
        success: false,
        error: 'Failed job not found or you do not have permission to retry it',
      }, 404)
    }

    // Reset job status
    const [retriedJob] = await db.update(jobs)
      .set({
        status: 'queued',
        error: null,
        failedAt: null,
        updatedAt: new Date()
      })
      .where(eq(jobs.id, jobId))
      .returning()

    // Re-add to queue based on job type
    if (failedJob.networkId && failedJob.dictionaryId) {
      await addHashcatCrackingJob({
        jobId: failedJob.id,
        networkId: failedJob.networkId,
        dictionaryId: failedJob.dictionaryId,
        handshakePath: failedJob.network?.filePath || '',
        dictionaryPath: failedJob.dictionary?.filePath || '',
        attackMode: (failedJob.attackMode as 'pmkid' | 'handshake') || 'handshake',
        userId
      })
    }

    return c.json({
      success: true,
      message: 'Job queued for retry',
      job: retriedJob
    })

  } catch (error) {
    console.error('Retry job error:', error)
    return c.json({
      success: false,
      error: 'Failed to retry job',
    }, 500)
  }
})

// Cleanup job
queueManagement.post('/cleanup', zValidator('json', z.object({
  strategy: z.enum(['old_files', 'failed_jobs', 'completed_jobs', 'temp_files']),
  userId: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json')
  const userId = data.userId || getUserId(c)

  try {
    // Add cleanup job to queue
    await addFileCleanupJob({
      filePaths: [],
      userId
    })

    return c.json({
      success: true,
      message: 'Cleanup job queued successfully',
      strategy: data.strategy
    })

  } catch (error) {
    console.error('Cleanup job error:', error)
    return c.json({
      success: false,
      error: 'Failed to queue cleanup job',
    }, 500)
  }
})

export { queueManagement as queueManagementRoutes, queueManagement as queueRoutes }