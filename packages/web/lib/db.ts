import Database from 'better-sqlite3';
import { Job, JobItem, Result, Dictionary } from '@autopwn/shared';

const DATABASE_PATH = process.env.DATABASE_PATH || '/data/db/autopwn.db';
console.log('[DEBUG] Database path:', DATABASE_PATH);

let db: Database.Database | null = null;
let writeDb: Database.Database | null = null;

function getDb() {
  if (!db) {
    console.log('[DEBUG] Opening read-only database connection');
    try {
      db = new Database(DATABASE_PATH, { readonly: true });
      console.log('[DEBUG] Database connection opened successfully');
    } catch (error: any) {
      console.error('[DEBUG] Failed to open database:', error?.message || error);
      throw error;
    }
  }
  return db;
}

function getWriteDb() {
  if (!writeDb) {
    console.log('[DEBUG] Opening read-write database connection');
    try {
      writeDb = new Database(DATABASE_PATH);
      console.log('[DEBUG] Write database connection opened successfully');
    } catch (error: any) {
      console.error('[DEBUG] Failed to open write database:', error?.message || error);
      throw error;
    }
  }
  return writeDb;
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

export function getJobItems(jobId: number): JobItem[] {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM job_items WHERE job_id = ? ORDER BY id ASC');
  return stmt.all(jobId) as JobItem[];
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

export function addDictionary(name: string, path: string, size: number): Dictionary {
  console.log('[DEBUG] Adding dictionary to database:', { name, path, size });
  const database = getWriteDb();
  try {
    const stmt = database.prepare(
      'INSERT INTO dictionaries (name, path, size) VALUES (?, ?, ?)'
    );
    const result = stmt.run(name, path, size);
    console.log('[DEBUG] Dictionary inserted with ID:', result.lastInsertRowid);
    const getStmt = database.prepare('SELECT * FROM dictionaries WHERE id = ?');
    const dict = getStmt.get(result.lastInsertRowid) as Dictionary;
    console.log('[DEBUG] Dictionary retrieved from database:', dict);
    return dict;
  } catch (error: any) {
    console.error('[DEBUG] Failed to add dictionary to database:', error?.message || error);
    throw error;
  }
}

export function getDictionaryCoverage(dictionaryId: number, jobIds: number[]): number {
  if (jobIds.length === 0) return 0;
  const database = getDb();
  const placeholders = jobIds.map(() => '?').join(',');
  const stmt = database.prepare(
    `SELECT COUNT(DISTINCT job_id) as count FROM job_dictionaries
     WHERE dictionary_id = ? AND job_id IN (${placeholders})`
  );
  const result = stmt.get(dictionaryId, ...jobIds) as { count: number };
  return result.count;
}

export function getFailedJobs(): Job[] {
  const database = getDb();
  const stmt = database.prepare("SELECT * FROM jobs WHERE status = 'failed' ORDER BY created_at DESC");
  return stmt.all() as Job[];
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

export function getAnalytics() {
  const database = getDb();

  // Jobs created over time (last 30 days)
  const jobsOverTime = database.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM jobs
    WHERE created_at >= DATE('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).all() as { date: string; count: number }[];

  // Cracks over time (last 30 days)
  const cracksOverTime = database.prepare(`
    SELECT DATE(cracked_at) as date, COUNT(*) as count
    FROM results
    WHERE cracked_at >= DATE('now', '-30 days')
    GROUP BY DATE(cracked_at)
    ORDER BY date ASC
  `).all() as { date: string; count: number }[];

  // Status distribution
  const statusDistribution = database.prepare(`
    SELECT status, COUNT(*) as count
    FROM jobs
    GROUP BY status
  `).all() as { status: string; count: number }[];

  // Dictionary effectiveness (top 10)
  const dictionaryEffectiveness = database.prepare(`
    SELECT d.name, COUNT(r.id) as cracks
    FROM dictionaries d
    LEFT JOIN job_dictionaries jd ON d.id = jd.dictionary_id
    LEFT JOIN results r ON jd.job_id = r.job_id
    GROUP BY d.id, d.name
    HAVING cracks > 0
    ORDER BY cracks DESC
    LIMIT 10
  `).all() as { name: string; cracks: number }[];

  // Average completion time (in seconds)
  const avgCompletionTime = database.prepare(`
    SELECT AVG(
      (julianday(completed_at) - julianday(started_at)) * 86400
    ) as avg_seconds
    FROM jobs
    WHERE status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL
  `).get() as { avg_seconds: number | null };

  // Success rate
  const successRate = database.prepare(`
    SELECT
      (CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS REAL) / COUNT(*)) * 100 as rate
    FROM jobs
    WHERE status IN ('completed', 'failed')
  `).get() as { rate: number | null };

  return {
    jobsOverTime,
    cracksOverTime,
    statusDistribution,
    dictionaryEffectiveness,
    avgCompletionTime: avgCompletionTime?.avg_seconds || 0,
    successRate: successRate?.rate || 0,
  };
}
