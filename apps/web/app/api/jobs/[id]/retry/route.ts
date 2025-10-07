import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';

const DATABASE_PATH = process.env.DATABASE_PATH || '/data/db/autopwn.db';

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

    // In the simplified system, we don't need to move files between directories
    // The job files remain in the jobs directory, we just reset the job status

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
