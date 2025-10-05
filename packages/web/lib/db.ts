import Database from 'better-sqlite3';
import { Job, Result, Dictionary } from '@autopwn/shared';

const DATABASE_PATH = process.env.DATABASE_PATH || '/data/db/autopwn.db';

let db: Database.Database | null = null;

function getDb() {
  if (!db) {
    db = new Database(DATABASE_PATH, { readonly: true });
  }
  return db;
}

export function getAllJobs(): Job[] {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM jobs ORDER BY created_at DESC');
  return stmt.all() as Job[];
}

export function getJob(id: number): Job | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM jobs WHERE id = ?');
  return stmt.get(id) as Job | null;
}

export function getAllResults(): Result[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT r.*, j.filename
    FROM results r
    JOIN jobs j ON r.job_id = j.id
    ORDER BY r.cracked_at DESC
  `);
  return stmt.all() as Result[];
}

export function getAllDictionaries(): Dictionary[] {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM dictionaries ORDER BY name ASC');
  return stmt.all() as Dictionary[];
}

export function getStats() {
  const database = getDb();

  const totalJobs = database.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
  const completedJobs = database.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'completed'").get() as { count: number };
  const processingJobs = database.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'processing'").get() as { count: number };
  const failedJobs = database.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'failed'").get() as { count: number };
  const totalCracks = database.prepare('SELECT COUNT(*) as count FROM results').get() as { count: number };

  return {
    total: totalJobs.count,
    completed: completedJobs.count,
    processing: processingJobs.count,
    failed: failedJobs.count,
    cracked: totalCracks.count,
  };
}
