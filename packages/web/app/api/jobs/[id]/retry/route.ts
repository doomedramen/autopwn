import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { rename } from 'fs/promises';
import { join } from 'path';

const DATABASE_PATH = process.env.DATABASE_PATH || '/data/db/autopwn.db';
const FAILED_PATH = process.env.FAILED_PATH || '/data/failed';
const INTERMEDIATE_PATH = process.env.INTERMEDIATE_PATH || '/data/intermediate';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const db = new Database(DATABASE_PATH);

    // Get the job
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;

    if (!job) {
      db.close();
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'failed') {
      db.close();
      return NextResponse.json({ error: 'Only failed jobs can be retried' }, { status: 400 });
    }

    // Move file from failed back to intermediate
    const failedFile = join(FAILED_PATH, job.filename);
    const intermediateFile = join(INTERMEDIATE_PATH, job.filename);

    try {
      await rename(failedFile, intermediateFile);
    } catch (error) {
      db.close();
      return NextResponse.json(
        { error: 'Failed to move file from failed folder', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // Reset the job to pending status
    db.prepare(`
      UPDATE jobs
      SET status = 'pending',
          started_at = NULL,
          completed_at = NULL,
          current_dictionary = NULL,
          progress = NULL,
          speed = NULL,
          eta = NULL,
          error = NULL,
          logs = NULL
      WHERE id = ?
    `).run(jobId);

    db.close();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to retry job:', error);
    return NextResponse.json(
      { error: 'Failed to retry job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
