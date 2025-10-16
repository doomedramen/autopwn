import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get logs for a specific job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get job from database
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, jobId),
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get logs from hashcat session file if available
    let logs: string[] = [];

    if (job.hashcatSession) {
      try {
        const hashcatDir = path.join(process.env.HOME || '', '.hashcat');
        const sessionFile = path.join(hashcatDir, `${job.hashcatSession}.log`);

        if (fs.existsSync(sessionFile)) {
          const logContent = fs.readFileSync(sessionFile, 'utf-8');
          logs = logContent.split('\n').filter(line => line.trim());
        }
      } catch (error) {
        logError('Error reading hashcat logs:', error);
      }
    }

    // Get real-time job status updates
    const speedCurrent = Number(job.speedCurrent || 0);
    const speedFormatted =
      speedCurrent > 0
        ? `${speedCurrent.toLocaleString()} ${job.speedUnit || 'H/s'}`
        : '0 H/s';

    const etaFormatted = job.eta && job.status === 'processing' ? job.eta : '';

    const statusLogs = [
      `Job created: ${new Date(job.createdAt).toLocaleString()}`,
      `Status: ${job.status}`,
      `Progress: ${job.progress || 0}%`,
      `Cracked: ${job.cracked || 0} / ${job.totalHashes || 0}`,
      `Speed: ${speedFormatted}`,
      etaFormatted ? `ETA: ${etaFormatted}` : '',
      job.startedAt
        ? `Started: ${new Date(job.startedAt).toLocaleString()}`
        : '',
      (job.status === 'completed' || job.status === 'failed') && job.updatedAt
        ? `Finished: ${new Date(job.updatedAt).toLocaleString()}`
        : '',
      job.errorMessage ? `Error: ${job.errorMessage}` : '',
    ].filter(line => line.trim());

    // Combine hashcat logs with status logs
    const allLogs = [...statusLogs];
    if (logs.length > 0) {
      allLogs.push('', '--- Hashcat Logs ---', ...logs);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: job.id,
        name: job.name,
        status: job.status,
        logs: allLogs,
        hashcatSession: job.hashcatSession,
        lastUpdated: job.updatedAt,
      },
    });
  } catch (error) {
    logError('Job logs fetch error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch job logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
