import { createHono } from '../lib/hono';
import { requireAuth } from '../middleware/auth';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, jobs, jobItems, jobDictionaries, dictionaries } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { webSocketService } from '../services/websocket';

const jobsRouter = createHono();

// Apply authentication middleware
jobsRouter.use('*', requireAuth);

// Get all jobs for current user
jobsRouter.get('/list', async (c) => {
  try {
    const user = c.get('user')!;

    const userJobs = await db.select()
      .from(jobs)
      .where(eq(jobs.userId, user.id))
      .orderBy(desc(jobs.createdAt));

    return c.json(userJobs);
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    return c.json({ error: 'Failed to fetch jobs' }, 500);
  }
});

// Get specific job
jobsRouter.get('/:id', async (c) => {
  try {
    const jobId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    const job = await db.select()
      .from(jobs)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, user.id)
      ))
      .limit(1);

    if (job.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    return c.json(job[0]);
  } catch (error) {
    console.error('Failed to fetch job:', error);
    return c.json({ error: 'Failed to fetch job' }, 500);
  }
});

// Create new job
const createJobSchema = z.object({
  filename: z.string(),
  dictionaryIds: z.array(z.number()),
  priority: z.number().default(0),
});

jobsRouter.post('/create', zValidator('json', createJobSchema), async (c) => {
  try {
    const { filename, dictionaryIds, priority } = c.req.valid('json');
    const user = c.get('user')!;

    // Create job
    const [newJob] = await db.insert(jobs).values({
      userId: user.id,
      filename,
      priority,
      status: 'pending',
      createdAt: new Date(),
    }).returning();

    // Add dictionaries to job
    for (const dictId of dictionaryIds) {
      await db.insert(jobDictionaries).values({
        jobId: newJob.id,
        dictionaryId: dictId,
        status: 'pending',
      });
    }

    return c.json({
      success: true,
      job: newJob,
      message: 'Job created successfully',
    });
  } catch (error) {
    console.error('Failed to create job:', error);
    return c.json({ error: 'Failed to create job' }, 500);
  }
});

// Get job items
jobsRouter.get('/:id/items', async (c) => {
  try {
    const jobId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    // Verify job ownership
    const job = await db.select()
      .from(jobs)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, user.id)
      ))
      .limit(1);

    if (job.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    const items = await db.select()
      .from(jobItems)
      .where(eq(jobItems.jobId, jobId))
      .orderBy(jobItems.id);

    return c.json(items);
  } catch (error) {
    console.error('Failed to fetch job items:', error);
    return c.json({ error: 'Failed to fetch job items' }, 500);
  }
});

// Get job status and progress
jobsRouter.get('/:id/status', async (c) => {
  try {
    const jobId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    const job = await db.select({
      id: jobs.id,
      status: jobs.status,
      progress: jobs.progress,
      itemsTotal: jobs.itemsTotal,
      itemsCracked: jobs.itemsCracked,
      speed: jobs.speed,
      eta: jobs.eta,
      startedAt: jobs.startedAt,
      completedAt: jobs.completedAt,
      currentDictionary: jobs.currentDictionary,
      error: jobs.error,
      hashCount: jobs.hashCount,
      totalHashes: jobs.totalHashes,
    })
      .from(jobs)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, user.id)
      ))
      .limit(1);

    if (job.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // Get additional stats
    const crackedItemsCount = await db.select({ count: jobItems.id })
      .from(jobItems)
      .where(and(
        eq(jobItems.jobId, jobId),
        eq(jobItems.status, 'cracked')
      ))
      .then(results => results.length);

    const totalItemsCount = await db.select({ count: jobItems.id })
      .from(jobItems)
      .where(eq(jobItems.jobId, jobId))
      .then(results => results.length);

    const jobStatus = job[0];
    const calculatedProgress = totalItemsCount > 0 ? (crackedItemsCount / totalItemsCount) * 100 : 0;

    return c.json({
      ...jobStatus,
      calculatedProgress: Math.round(calculatedProgress * 100) / 100,
      crackedItems: crackedItemsCount,
      totalItems: totalItemsCount,
    });
  } catch (error) {
    console.error('Failed to fetch job status:', error);
    return c.json({ error: 'Failed to fetch job status' }, 500);
  }
});

// Get job logs
jobsRouter.get('/:id/logs', async (c) => {
  try {
    const jobId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    const job = await db.select({ logs: jobs.logs })
      .from(jobs)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, user.id)
      ))
      .limit(1);

    if (job.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    return c.json({
      logs: job[0].logs || '',
      jobId,
    });
  } catch (error) {
    console.error('Failed to fetch job logs:', error);
    return c.json({ error: 'Failed to fetch job logs' }, 500);
  }
});

// Update job progress (for worker service)
jobsRouter.post('/:id/progress', async (c) => {
  try {
    const jobId = parseInt(c.req.param('id'));
    const user = c.get('user')!;
    const { progress, speed, eta, itemsCracked, hashCount, currentDictionary, logs } = await c.req.json();

    const updateData: any = {};
    if (progress !== undefined) updateData.progress = progress;
    if (speed !== undefined) updateData.speed = speed;
    if (eta !== undefined) updateData.eta = eta;
    if (itemsCracked !== undefined) updateData.itemsCracked = itemsCracked;
    if (hashCount !== undefined) updateData.hashCount = hashCount;
    if (currentDictionary !== undefined) updateData.currentDictionary = currentDictionary;
    if (logs !== undefined) updateData.logs = logs;

    const result = await db.update(jobs)
      .set(updateData)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, user.id)
      ))
      .returning();

    if (result.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // Broadcast WebSocket update
    webSocketService.broadcastJobUpdate(jobId, {
      type: 'progress',
      data: {
        progress,
        speed,
        eta,
        itemsCracked,
        hashCount,
        currentDictionary
      }
    });

    return c.json({
      success: true,
      message: 'Job progress updated successfully',
    });
  } catch (error) {
    console.error('Failed to update job progress:', error);
    return c.json({ error: 'Failed to update job progress' }, 500);
  }
});

// Get job statistics
jobsRouter.get('/:id/stats', async (c) => {
  try {
    const jobId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    // Verify job ownership and get basic job info
    const job = await db.select()
      .from(jobs)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, user.id)
      ))
      .limit(1);

    if (job.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // Get item status breakdown using count
    const statusCounts = await db.select({
      status: jobItems.status,
    })
      .from(jobItems)
      .where(eq(jobItems.jobId, jobId));

    // Get cracked passwords
    const crackedItems = await db.select({
      essid: jobItems.essid,
      bssid: jobItems.bssid,
      password: jobItems.password,
      crackedAt: jobItems.crackedAt,
    })
      .from(jobItems)
      .where(and(
        eq(jobItems.jobId, jobId),
        eq(jobItems.status, 'cracked')
      ))
      .orderBy(desc(jobItems.crackedAt));

    // Calculate status breakdown
    const statusBreakdown = statusCounts.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const stats = {
      job: job[0],
      statusBreakdown,
      crackedItems,
      totalItems: statusCounts.length,
      crackedCount: crackedItems.length,
    };

    return c.json(stats);
  } catch (error) {
    console.error('Failed to fetch job statistics:', error);
    return c.json({ error: 'Failed to fetch job statistics' }, 500);
  }
});

// Pause job
jobsRouter.post('/:id/pause', async (c) => {
  try {
    const jobId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    const result = await db.update(jobs)
      .set({
        status: 'paused',
        paused: 1
      })
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, user.id)
      ))
      .returning();

    if (result.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // Broadcast WebSocket update
    webSocketService.broadcastJobUpdate(jobId, {
      type: 'status',
      data: {
        status: 'paused',
        paused: 1
      }
    });

    return c.json({
      success: true,
      message: 'Job paused successfully',
    });
  } catch (error) {
    console.error('Failed to pause job:', error);
    return c.json({ error: 'Failed to pause job' }, 500);
  }
});

// Resume job
jobsRouter.post('/:id/resume', async (c) => {
  try {
    const jobId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    const result = await db.update(jobs)
      .set({
        status: 'pending',
        paused: 0
      })
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, user.id)
      ))
      .returning();

    if (result.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // Broadcast WebSocket update
    webSocketService.broadcastJobUpdate(jobId, {
      type: 'status',
      data: {
        status: 'pending',
        paused: 0
      }
    });

    return c.json({
      success: true,
      message: 'Job resumed successfully',
    });
  } catch (error) {
    console.error('Failed to resume job:', error);
    return c.json({ error: 'Failed to resume job' }, 500);
  }
});

// Stop/abort job
jobsRouter.post('/:id/stop', async (c) => {
  try {
    const jobId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    const result = await db.update(jobs)
      .set({
        status: 'stopped',
        completedAt: new Date()
      })
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, user.id)
      ))
      .returning();

    if (result.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // Broadcast WebSocket update
    webSocketService.broadcastJobUpdate(jobId, {
      type: 'status',
      data: {
        status: 'stopped',
        completedAt: new Date()
      }
    });

    return c.json({
      success: true,
      message: 'Job stopped successfully',
    });
  } catch (error) {
    console.error('Failed to stop job:', error);
    return c.json({ error: 'Failed to stop job' }, 500);
  }
});

// Restart job
jobsRouter.post('/:id/restart', async (c) => {
  try {
    const jobId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    // Reset job progress
    const result = await db.update(jobs)
      .set({
        status: 'pending',
        progress: 0,
        itemsCracked: 0,
        hashCount: 0,
        speed: null,
        eta: null,
        error: null,
        startedAt: null,
        completedAt: null,
        currentDictionary: null,
        paused: 0,
      })
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, user.id)
      ))
      .returning();

    if (result.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // Reset job items to pending status (keep cracked ones)
    await db.update(jobItems)
      .set({
        status: 'pending',
        password: null,
        crackedAt: null,
      })
      .where(and(
        eq(jobItems.jobId, jobId),
        eq(jobItems.status, 'cracked')
      ));

    // Broadcast WebSocket update
    webSocketService.broadcastJobUpdate(jobId, {
      type: 'status',
      data: {
        status: 'pending',
        progress: 0,
        itemsCracked: 0,
        hashCount: 0,
        speed: null,
        eta: null,
        error: null,
        startedAt: null,
        completedAt: null,
        currentDictionary: null,
        paused: 0,
      }
    });

    return c.json({
      success: true,
      message: 'Job restarted successfully',
    });
  } catch (error) {
    console.error('Failed to restart job:', error);
    return c.json({ error: 'Failed to restart job' }, 500);
  }
});

// Update job priority
jobsRouter.put('/:id/priority', async (c) => {
  try {
    const jobId = parseInt(c.req.param('id'));
    const { priority } = await c.req.json();
    const user = c.get('user')!;

    const result = await db.update(jobs)
      .set({ priority })
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, user.id)
      ))
      .returning();

    if (result.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'Job priority updated successfully',
    });
  } catch (error) {
    console.error('Failed to update job priority:', error);
    return c.json({ error: 'Failed to update job priority' }, 500);
  }
});

// Delete job
jobsRouter.delete('/:id', async (c) => {
  try {
    const jobId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    // Verify job ownership
    const job = await db.select()
      .from(jobs)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.userId, user.id)
      ))
      .limit(1);

    if (job.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // Check if job is running
    if (job[0].status === 'processing') {
      return c.json({ error: 'Cannot delete job while it is processing' }, 400);
    }

    // Delete job (cascades to job items and job dictionaries)
    await db.delete(jobs).where(eq(jobs.id, jobId));

    return c.json({
      success: true,
      message: 'Job deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete job:', error);
    return c.json({ error: 'Failed to delete job' }, 500);
  }
});

export { jobsRouter };