import Database from 'better-sqlite3';
import { DB_SCHEMA, Job, Result, Dictionary, CreateJobInput, UpdateJobInput, CreateResultInput } from '@autopwn/shared';
import { config } from './config.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dbDir = dirname(config.databasePath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(config.databasePath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize() {
    this.db.exec(DB_SCHEMA);
  }

  // Jobs
  createJob(input: CreateJobInput): Job {
    const stmt = this.db.prepare(
      'INSERT INTO jobs (filename, hash_count) VALUES (?, ?)'
    );
    const result = stmt.run(input.filename, input.hash_count);
    return this.getJob(result.lastInsertRowid as number)!;
  }

  getJob(id: number): Job | null {
    const stmt = this.db.prepare('SELECT * FROM jobs WHERE id = ?');
    return stmt.get(id) as Job | null;
  }

  getPendingJob(): Job | null {
    const stmt = this.db.prepare(
      "SELECT * FROM jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
    );
    return stmt.get() as Job | null;
  }

  getAllJobs(): Job[] {
    const stmt = this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC');
    return stmt.all() as Job[];
  }

  updateJob(id: number, input: UpdateJobInput): void {
    const fields = Object.keys(input).map(key => `${key} = ?`).join(', ');
    const values = Object.values(input);
    const stmt = this.db.prepare(`UPDATE jobs SET ${fields} WHERE id = ?`);
    stmt.run(...values, id);
  }

  // Results
  createResult(input: CreateResultInput): Result {
    const stmt = this.db.prepare(
      'INSERT INTO results (job_id, essid, password) VALUES (?, ?, ?)'
    );
    const result = stmt.run(input.job_id, input.essid, input.password);
    return this.getResult(result.lastInsertRowid as number)!;
  }

  getResult(id: number): Result | null {
    const stmt = this.db.prepare('SELECT * FROM results WHERE id = ?');
    return stmt.get(id) as Result | null;
  }

  getResultsByJobId(jobId: number): Result[] {
    const stmt = this.db.prepare('SELECT * FROM results WHERE job_id = ?');
    return stmt.all(jobId) as Result[];
  }

  getAllResults(): Result[] {
    const stmt = this.db.prepare('SELECT * FROM results ORDER BY cracked_at DESC');
    return stmt.all() as Result[];
  }

  // Dictionaries
  syncDictionaries(dictionaries: Omit<Dictionary, 'id'>[]): void {
    this.db.exec('DELETE FROM dictionaries');
    const stmt = this.db.prepare(
      'INSERT INTO dictionaries (name, path, size) VALUES (?, ?, ?)'
    );
    for (const dict of dictionaries) {
      stmt.run(dict.name, dict.path, dict.size);
    }
  }

  getAllDictionaries(): Dictionary[] {
    const stmt = this.db.prepare('SELECT * FROM dictionaries ORDER BY name ASC');
    return stmt.all() as Dictionary[];
  }

  close() {
    this.db.close();
  }
}

export const db = new DatabaseManager();
