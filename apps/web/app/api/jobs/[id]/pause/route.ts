import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), '../../volumes/db/autopwn.db');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);

    if (!job) {
      db.close();
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Toggle pause state
    const currentPaused = (job as any).paused || 0;
    const newPaused = currentPaused === 0 ? 1 : 0;

    db.prepare('UPDATE jobs SET paused = ? WHERE id = ?').run(newPaused, id);
    db.close();

    return NextResponse.json({ paused: newPaused });
  } catch (error) {
    console.error('Error toggling pause:', error);
    return NextResponse.json({ error: 'Failed to toggle pause' }, { status: 500 });
  }
}
