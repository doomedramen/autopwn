import { createHono } from '../lib/hono.js';
import { requireAuth } from '../middleware/auth.js';
import { db, jobs, results } from '@autopwn/shared';
import { eq, and, sql, desc } from 'drizzle-orm';

const statsRouter = createHono();

// Apply authentication middleware
statsRouter.use('*', requireAuth);

// Get overall statistics for current user
statsRouter.get('/', async (c) => {
  try {
    const user = c.get('user')!;

    // Get job counts
    const totalJobs = await db.select({ count: sql`count(*)` })
      .from(jobs)
      .where(eq(jobs.userId, user.id));

    const completedJobs = await db.select({ count: sql`count(*)` })
      .from(jobs)
      .where(and(
        eq(jobs.userId, user.id),
        eq(jobs.status, 'completed')
      ));

    const processingJobs = await db.select({ count: sql`count(*)` })
      .from(jobs)
      .where(and(
        eq(jobs.userId, user.id),
        eq(jobs.status, 'processing')
      ));

    const failedJobs = await db.select({ count: sql`count(*)` })
      .from(jobs)
      .where(and(
        eq(jobs.userId, user.id),
        eq(jobs.status, 'failed')
      ));

    const totalCracks = await db.select({ count: sql`count(*)` })
      .from(results)
      .where(eq(results.userId, user.id));

    return c.json({
      total: totalJobs[0].count,
      completed: completedJobs[0].count,
      processing: processingJobs[0].count,
      failed: failedJobs[0].count,
      cracked: totalCracks[0].count,
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// Get success rate
statsRouter.get('/success-rate', async (c) => {
  try {
    const user = c.get('user')!;

    const successRate = await db.select({
      rate: sql`CAST(COUNT(CASE WHEN status = 'completed' THEN 1 END) AS REAL) / COUNT(*) * 100`
    })
      .from(jobs)
      .where(and(
        eq(jobs.userId, user.id),
        sql`status IN ('completed', 'failed')`
      ));

    return c.json({
      successRate: successRate[0]?.rate || 0,
    });
  } catch (error) {
    console.error('Failed to fetch success rate:', error);
    return c.json({ error: 'Failed to fetch success rate' }, 500);
  }
});

// Get recent activity
statsRouter.get('/recent', async (c) => {
  try {
    const user = c.get('user')!;

    // Get recent jobs
    const recentJobs = await db.select({
      id: jobs.id,
      filename: jobs.filename,
      status: jobs.status,
      createdAt: jobs.createdAt,
      completedAt: jobs.completedAt,
    })
      .from(jobs)
      .where(eq(jobs.userId, user.id))
      .orderBy(desc(jobs.createdAt))
      .limit(10);

    // Get recent results
    const recentResults = await db.select()
      .from(results)
      .where(eq(results.userId, user.id))
      .orderBy(desc(results.crackedAt))
      .limit(10);

    return c.json({
      recentJobs,
      recentResults,
    });
  } catch (error) {
    console.error('Failed to fetch recent activity:', error);
    return c.json({ error: 'Failed to fetch recent activity' }, 500);
  }
});

export { statsRouter };