import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * Get status updates for a specific job
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
      where: eq(jobs.id, jobId)
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Return job status information
    return NextResponse.json({
      success: true,
      data: {
        id: job.id,
        name: job.name,
        status: job.status,
        progress: job.progress || 0,
        cracked: job.cracked || 0,
        totalHashes: job.totalHashes || 0,
        speed: {
          current: Number(job.speedCurrent) || 0,
          average: Number(job.speedAverage) || 0,
          unit: job.speedUnit || 'H/s'
        },
        eta: job.eta || '',
        hashcatSession: job.hashcatSession,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        completedAt: job.completedAt,
        error: job.error,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }
    });

  } catch (error) {
    console.error('Job status fetch error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch job status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}