import { createHono } from '../lib/hono';
import { requireAuth } from '../middleware/auth';
import { db, results, jobs, jobItems } from '@autopwn/shared';
import { eq, and, desc, gte, lte, like, count } from 'drizzle-orm';

const resultsRouter = createHono();

// Apply authentication middleware
resultsRouter.use('*', requireAuth);

// Get all results for current user with filtering and pagination
resultsRouter.get('/list', async (c) => {
  try {
    const user = c.get('user')!;
    const {
      page = '1',
      limit = '50',
      jobId,
      essid,
      startDate,
      endDate,
      sortBy = 'crackedAt',
      sortOrder = 'desc'
    } = c.req.query();

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    const conditions = [eq(results.userId, user.id)];

    if (jobId) {
      conditions.push(eq(results.jobId, parseInt(jobId)));
    }

    if (essid) {
      conditions.push(like(results.essid, `%${essid}%`));
    }

    if (startDate) {
      conditions.push(gte(results.crackedAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(results.crackedAt, new Date(endDate)));
    }

    // Get total count
    const totalCountQuery = await db.select({ count: count() })
      .from(results)
      .where(and(...conditions));

    const totalResults = totalCountQuery[0].count;

    // Get paginated results
    const userResults = await db.select({
      id: results.id,
      jobId: results.jobId,
      essid: results.essid,
      password: results.password,
      crackedAt: results.crackedAt,
      pcapFilename: results.pcapFilename,
      jobFilename: jobs.filename,
      jobStatus: jobs.status,
    })
      .from(results)
      .leftJoin(jobs, eq(results.jobId, jobs.id))
      .where(and(...conditions))
      .orderBy(
        sortOrder === 'desc'
          ? desc(sortBy === 'crackedAt' ? results.crackedAt : results.id)
          : (sortBy === 'crackedAt' ? results.crackedAt : results.id)
      )
      .limit(limitNum)
      .offset(offset);

    return c.json({
      results: userResults,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalResults,
        totalPages: Math.ceil(totalResults / limitNum),
      }
    });
  } catch (error) {
    console.error('Failed to fetch results:', error);
    return c.json({ error: 'Failed to fetch results' }, 500);
  }
});

// Export results in various formats
resultsRouter.get('/export', async (c) => {
  try {
    const user = c.get('user')!;
    const { format = 'json', jobId, essid, startDate, endDate } = c.req.query();

    // Build where conditions
    const conditions = [eq(results.userId, user.id)];

    if (jobId) {
      conditions.push(eq(results.jobId, parseInt(jobId)));
    }

    if (essid) {
      conditions.push(like(results.essid, `%${essid}%`));
    }

    if (startDate) {
      conditions.push(gte(results.crackedAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(results.crackedAt, new Date(endDate)));
    }

    const exportResults = await db.select({
      id: results.id,
      jobId: results.jobId,
      essid: results.essid,
      password: results.password,
      crackedAt: results.crackedAt,
      pcapFilename: results.pcapFilename,
      jobFilename: jobs.filename,
    })
      .from(results)
      .leftJoin(jobs, eq(results.jobId, jobs.id))
      .where(and(...conditions))
      .orderBy(desc(results.crackedAt));

    if (format === 'csv') {
      // Generate CSV
      const headers = ['ID', 'Job ID', 'ESSID', 'Password', 'Cracked At', 'PCAP Filename', 'Job Filename'];
      const csvRows = [
        headers.join(','),
        ...exportResults.map(r => [
          r.id,
          r.jobId,
          `"${r.essid}"`,
          `"${r.password}"`,
          r.crackedAt?.toISOString(),
          `"${r.pcapFilename || ''}"`,
          `"${r.jobFilename || ''}"`
        ].join(','))
      ].join('\n');

      return c.text(csvRows, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="autopwn_results_${new Date().toISOString().split('T')[0]}.csv"`
      });
    }

    if (format === 'txt') {
      // Generate plain text format
      const textContent = exportResults.map(r =>
        `ESSID: ${r.essid}\nPassword: ${r.password}\nJob: ${r.jobFilename}\nCracked: ${r.crackedAt?.toISOString()}\nPCAP: ${r.pcapFilename || 'N/A'}\n${'='.repeat(50)}`
      ).join('\n\n');

      return c.text(textContent, 200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="autopwn_results_${new Date().toISOString().split('T')[0]}.txt"`
      });
    }

    if (format === 'hashcat') {
      // Generate hashcat format (ESSID:password)
      const hashcatContent = exportResults.map(r => `${r.essid}:${r.password}`).join('\n');

      return c.text(hashcatContent, 200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="autopwn_hashcat_${new Date().toISOString().split('T')[0]}.hccapx"`
      });
    }

    // Default JSON format
    return c.json({
      exportDate: new Date().toISOString(),
      totalResults: exportResults.length,
      filters: { jobId, essid, startDate, endDate },
      results: exportResults,
    });

  } catch (error) {
    console.error('Failed to export results:', error);
    return c.json({ error: 'Failed to export results' }, 500);
  }
});


// Get results for specific job
resultsRouter.get('/job/:jobId', async (c) => {
  try {
    const jobId = parseInt(c.req.param('jobId'));
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

    const jobResults = await db.select()
      .from(results)
      .where(and(
        eq(results.jobId, jobId),
        eq(results.userId, user.id)
      ))
      .orderBy(desc(results.crackedAt));

    return c.json(jobResults);
  } catch (error) {
    console.error('Failed to fetch job results:', error);
    return c.json({ error: 'Failed to fetch job results' }, 500);
  }
});

// Get result statistics
resultsRouter.get('/stats', async (c) => {
  try {
    const user = c.get('user')!;

    // Get total results count
    const totalResultsQuery = await db.select()
      .from(results)
      .where(eq(results.userId, user.id));
    const totalResults = totalResultsQuery.length;

    // Get recent results (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentResultsQuery = await db.select()
      .from(results)
      .where(and(
        eq(results.userId, user.id),
        gte(results.crackedAt, thirtyDaysAgo)
      ));
    const recentResults = recentResultsQuery.length;

    // Get unique ESSIDs
    const allResults = await db.select({
      essid: results.essid,
    })
      .from(results)
      .where(eq(results.userId, user.id));

    const uniqueEssids = new Set(allResults.map(r => r.essid)).size;

    return c.json({
      totalCracked: totalResults,
      recentCracked: recentResults,
      uniqueEssids,
      period: '30d'
    });
  } catch (error) {
    console.error('Failed to fetch result stats:', error);
    return c.json({ error: 'Failed to fetch result stats' }, 500);
  }
});

// Search results
resultsRouter.get('/search', async (c) => {
  try {
    const user = c.get('user')!;
    const { q, type = 'essid', page = '1', limit = '20' } = c.req.query();

    if (!q) {
      return c.json({ error: 'Search query is required' }, 400);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const searchConditions = type === 'password'
      ? like(results.password, `%${q}%`)
      : like(results.essid, `%${q}%`);

    // Get total count
    const totalCountQuery = await db.select({ count: count() })
      .from(results)
      .where(and(
        eq(results.userId, user.id),
        searchConditions
      ));

    const totalResults = totalCountQuery[0].count;

    // Get paginated search results
    const searchResults = await db.select({
      id: results.id,
      jobId: results.jobId,
      essid: results.essid,
      password: results.password,
      crackedAt: results.crackedAt,
      pcapFilename: results.pcapFilename,
      jobFilename: jobs.filename,
    })
      .from(results)
      .leftJoin(jobs, eq(results.jobId, jobs.id))
      .where(and(
        eq(results.userId, user.id),
        searchConditions
      ))
      .orderBy(desc(results.crackedAt))
      .limit(limitNum)
      .offset(offset);

    return c.json({
      results: searchResults,
      query: q,
      type,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalResults,
        totalPages: Math.ceil(totalResults / limitNum),
      }
    });
  } catch (error) {
    console.error('Failed to search results:', error);
    return c.json({ error: 'Failed to search results' }, 500);
  }
});

// Delete a result
resultsRouter.delete('/:id', async (c) => {
  try {
    const resultId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    // Verify result ownership
    const result = await db.select()
      .from(results)
      .where(and(
        eq(results.id, resultId),
        eq(results.userId, user.id)
      ))
      .limit(1);

    if (result.length === 0) {
      return c.json({ error: 'Result not found' }, 404);
    }

    await db.delete(results).where(eq(results.id, resultId));

    return c.json({
      success: true,
      message: 'Result deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete result:', error);
    return c.json({ error: 'Failed to delete result' }, 500);
  }
});

// Bulk delete results
resultsRouter.delete('/bulk', async (c) => {
  try {
    const user = c.get('user')!;
    const { jobId, olderThan } = await c.req.json();

    let conditions = [eq(results.userId, user.id)];

    if (jobId) {
      conditions.push(eq(results.jobId, parseInt(jobId)));
    }

    if (olderThan) {
      conditions.push(lte(results.crackedAt, new Date(olderThan)));
    }

    // Note: IN clause for arrays would need more complex handling
    const deletedResults = await db.delete(results)
      .where(and(...conditions))
      .returning();

    return c.json({
      success: true,
      deletedCount: deletedResults.length,
      message: `Successfully deleted ${deletedResults.length} result(s)`,
    });
  } catch (error) {
    console.error('Failed to bulk delete results:', error);
    return c.json({ error: 'Failed to bulk delete results' }, 500);
  }
});

// Get detailed result information
resultsRouter.get('/:id', async (c) => {
  try {
    const resultId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    const result = await db.select({
      id: results.id,
      jobId: results.jobId,
      essid: results.essid,
      password: results.password,
      crackedAt: results.crackedAt,
      pcapFilename: results.pcapFilename,
      jobFilename: jobs.filename,
      jobStatus: jobs.status,
      jobCreatedAt: jobs.createdAt,
      jobCompletedAt: jobs.completedAt,
    })
      .from(results)
      .leftJoin(jobs, eq(results.jobId, jobs.id))
      .where(and(
        eq(results.id, resultId),
        eq(results.userId, user.id)
      ))
      .limit(1);

    if (result.length === 0) {
      return c.json({ error: 'Result not found' }, 404);
    }

    // Get related results for the same ESSID
    const relatedResults = await db.select({
      id: results.id,
      jobId: results.jobId,
      password: results.password,
      crackedAt: results.crackedAt,
      jobFilename: jobs.filename,
    })
      .from(results)
      .leftJoin(jobs, eq(results.jobId, jobs.id))
      .where(and(
        eq(results.userId, user.id),
        eq(results.essid, result[0].essid),
        eq(results.id, resultId) // Exclude current result
      ))
      .orderBy(desc(results.crackedAt))
      .limit(5);

    return c.json({
      result: result[0],
      relatedResults,
    });
  } catch (error) {
    console.error('Failed to fetch result details:', error);
    return c.json({ error: 'Failed to fetch result details' }, 500);
  }
});

export { resultsRouter };