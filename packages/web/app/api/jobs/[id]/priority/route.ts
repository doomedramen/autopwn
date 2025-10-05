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
    const { priority } = await request.json();

    if (typeof priority !== 'number') {
      return NextResponse.json({ error: 'Invalid priority value' }, { status: 400 });
    }

    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);

    if (!job) {
      db.close();
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    db.prepare('UPDATE jobs SET priority = ? WHERE id = ?').run(priority, id);
    db.close();

    return NextResponse.json({ priority });
  } catch (error) {
    console.error('Error setting priority:', error);
    return NextResponse.json({ error: 'Failed to set priority' }, { status: 500 });
  }
}
