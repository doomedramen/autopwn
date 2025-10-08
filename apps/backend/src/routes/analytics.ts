import { createHono } from '../lib/hono.js';
import { requireAuth } from '../middleware/auth.js';
import { db, jobs, results, jobDictionaries, dictionaries } from '@autopwn/shared';
import { eq, and, sql, desc } from 'drizzle-orm';

const analyticsRouter = createHono();

// Apply authentication middleware
analyticsRouter.use('*', requireAuth);

// Get comprehensive analytics for current user
analyticsRouter.get('/', async (c) => {
  try {
    const user = c.get('user')!;
    const range = c.req.query('range') || '30d';

    // Calculate date range based on parameter
    const startDate = new Date();
    switch (range) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate.setFullYear(2020); // Or use a very old date
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const jobsOverTime = await db.select({
      date: sql`DATE(created_at)::text`,
      count: sql`count(*)`
    })
      .from(jobs)
      .where(and(
        eq(jobs.userId, user.id),
        sql`created_at >= ${startDate}`
      ))
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    // Cracks over time (based on date range)
    const cracksOverTime = await db.select({
      date: sql`DATE(cracked_at)::text`,
      count: sql`count(*)`
    })
      .from(results)
      .where(and(
        eq(results.userId, user.id),
        sql`cracked_at >= ${startDate}`
      ))
      .groupBy(sql`DATE(cracked_at)`)
      .orderBy(sql`DATE(cracked_at)`);

    // Status distribution
    const statusDistribution = await db.select({
      status: jobs.status,
      count: sql`count(*)`
    })
      .from(jobs)
      .where(eq(jobs.userId, user.id))
      .groupBy(jobs.status);

    // Dictionary effectiveness (top 10)
    const dictionaryEffectiveness = await db.select({
      name: dictionaries.name,
      cracks: sql`count(${results.id})`
    })
      .from(dictionaries)
      .leftJoin(jobDictionaries, eq(dictionaries.id, jobDictionaries.dictionaryId))
      .leftJoin(results, eq(jobDictionaries.jobId, results.jobId))
      .where(and(
        eq(dictionaries.userId, user.id),
        eq(results.userId, user.id)
      ))
      .groupBy(dictionaries.id, dictionaries.name)
      .having(sql`count(${results.id}) > 0`)
      .orderBy(sql`count(${results.id}) desc`)
      .limit(10);

    // Average completion time (in seconds)
    const avgCompletionTime = await db.select({
      avgSeconds: sql`AVG((julianday(completed_at) - julianday(started_at)) * 86400)`
    })
      .from(jobs)
      .where(and(
        eq(jobs.userId, user.id),
        eq(jobs.status, 'completed'),
        sql`started_at IS NOT NULL`,
        sql`completed_at IS NOT NULL`
      ));

    // Success rate
    const successRate = await db.select({
      rate: sql`CAST(COUNT(CASE WHEN status = 'completed' THEN 1 END) AS REAL) / COUNT(*) * 100`
    })
      .from(jobs)
      .where(and(
        eq(jobs.userId, user.id),
        sql`status IN ('completed', 'failed')`
      ));

    return c.json({
      jobsOverTime,
      cracksOverTime,
      statusDistribution,
      dictionaryEffectiveness,
      avgCompletionTime: avgCompletionTime[0]?.avgSeconds || 0,
      successRate: successRate[0]?.rate || 0,
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
});

// Get detailed job statistics
analyticsRouter.get('/jobs', async (c) => {
  try {
    const user = c.get('user')!;

    const jobStats = await db.select({
      totalJobs: sql`count(*)`,
      completedJobs: sql`count(*) FILTER (WHERE status = 'completed')`,
      failedJobs: sql`count(*) FILTER (WHERE status = 'failed')`,
      processingJobs: sql`count(*) FILTER (WHERE status = 'processing')`,
      pendingJobs: sql`count(*) FILTER (WHERE status = 'pending')`,
    })
      .from(jobs)
      .where(eq(jobs.userId, user.id));

    return c.json(jobStats[0]);
  } catch (error) {
    console.error('Failed to fetch job analytics:', error);
    return c.json({ error: 'Failed to fetch job analytics' }, 500);
  }
});

// Get result statistics
analyticsRouter.get('/results', async (c) => {
  try {
    const user = c.get('user')!;

    const resultStats = await db.select({
      totalCracks: sql`count(*)`,
      uniqueEssids: sql`count(DISTINCT essid)`,
      avgCracksPerJob: sql`AVG(crack_count)`
    })
      .from(
        db.select({
          jobId: results.jobId,
          crackCount: sql`count(*)`
        })
          .from(results)
          .where(eq(results.userId, user.id))
          .groupBy(results.jobId)
          .as('job_cracks')
      );

    return c.json(resultStats[0]);
  } catch (error) {
    console.error('Failed to fetch result analytics:', error);
    return c.json({ error: 'Failed to fetch result analytics' }, 500);
  }
});

// Export comprehensive analytics data
analyticsRouter.get('/export', async (c) => {
  try {
    const user = c.get('user')!;
    const range = c.req.query('range') || '30d';
    const format = c.req.query('format') || 'json';

    // Calculate date range based on parameter
    const startDate = new Date();
    switch (range) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate.setFullYear(2020);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get comprehensive data
    const [jobsData, resultsData, analytics] = await Promise.all([
      // Detailed job data
      db.select({
        id: jobs.id,
        filename: jobs.filename,
        status: jobs.status,
        progress: jobs.progress,
        speed: jobs.speed,
        eta: jobs.eta,
        itemsCracked: jobs.itemsCracked,
        itemsTotal: jobs.itemsTotal,
        priority: jobs.priority,
        createdAt: jobs.createdAt,
        startedAt: jobs.startedAt,
        completedAt: jobs.completedAt
      })
        .from(jobs)
        .where(and(
          eq(jobs.userId, user.id),
          sql`created_at >= ${startDate}`
        ))
        .orderBy(desc(jobs.createdAt)),

      // Detailed results data
      db.select({
        id: results.id,
        essid: results.essid,
        password: results.password,
        crackedAt: results.crackedAt,
        jobId: results.jobId
      })
        .from(results)
        .where(and(
          eq(results.userId, user.id),
          sql`cracked_at >= ${startDate}`
        ))
        .orderBy(desc(results.crackedAt)),

      // Get main analytics
      fetch(`${c.req.url.replace('/export', '')}?range=${range}`).then(res => res.json())
    ]);

    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        dateRange: range,
        userId: user.id,
        recordCounts: {
          jobs: jobsData.length,
          results: resultsData.length
        }
      },
      analytics,
      jobs: jobsData,
      results: resultsData
    };

    if (format === 'csv') {
      // Convert to CSV format
      const jobsCsv = [
        ['ID', 'Filename', 'Status', 'Progress', 'Speed', 'ETA', 'Items Cracked', 'Items Total', 'Priority', 'Created At', 'Started At', 'Completed At'].join(','),
        ...jobsData.map(job => [
          job.id,
          `"${job.filename}"`,
          job.status,
          job.progress || '',
          job.speed || '',
          job.eta || '',
          job.itemsCracked || '',
          job.itemsTotal || '',
          job.priority,
          job.createdAt,
          job.startedAt || '',
          job.completedAt || ''
        ].join(','))
      ].join('\n');

      const resultsCsv = [
        ['ID', 'ESSID', 'Password', 'BSSID', 'Cracked At', 'Job ID'].join(','),
        ...resultsData.map(result => [
          result.id,
          `"${result.essid}"`,
          `"${result.password}"`,
          `""`,
          result.crackedAt,
          result.jobId
        ].join(','))
      ].join('\n');

      const csvContent = `# AutoPWN Analytics Export - ${range}\n# Exported at: ${new Date().toISOString()}\n\n# JOBS\n${jobsCsv}\n\n# RESULTS\n${resultsCsv}`;

      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', `attachment; filename="autopwn-analytics-${range}-${new Date().toISOString().split('T')[0]}.csv"`);
      return c.body(csvContent);
    }

    // Default JSON format
    c.header('Content-Type', 'application/json');
    c.header('Content-Disposition', `attachment; filename="autopwn-analytics-${range}-${new Date().toISOString().split('T')[0]}.json"`);
    return c.json(exportData);
  } catch (error) {
    console.error('Failed to export analytics:', error);
    return c.json({ error: 'Failed to export analytics' }, 500);
  }
});

export { analyticsRouter };