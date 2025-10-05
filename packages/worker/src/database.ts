import Database from 'better-sqlite3';
import {
  DB_SCHEMA,
  Job,
  JobItem,
  JobDictionary,
  Result,
  Dictionary,
  CreateJobInput,
  CreateJobItemInput,
  UpdateJobInput,
  UpdateJobItemInput,
  CreateResultInput
} from '@autopwn/shared';
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
      'INSERT INTO jobs (filename, hash_count, batch_mode, items_total) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(
      input.filename,
      input.hash_count,
      input.batch_mode || 0,
      input.items_total || null
    );
    return this.getJob(result.lastInsertRowid as number)!;
  }

  getJob(id: number): Job | null {
    const stmt = this.db.prepare('SELECT * FROM jobs WHERE id = ?');
    return stmt.get(id) as Job | null;
  }

  getPendingJob(): Job | null {
    const stmt = this.db.prepare(
      "SELECT * FROM jobs WHERE status = 'pending' AND paused = 0 ORDER BY priority DESC, created_at ASC LIMIT 1"
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

  // Job Items
  createJobItem(input: CreateJobItemInput): JobItem {
    const stmt = this.db.prepare(
      'INSERT INTO job_items (job_id, filename, essid, bssid) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(
      input.job_id,
      input.filename,
      input.essid || null,
      input.bssid || null
    );
    return this.getJobItem(result.lastInsertRowid as number)!;
  }

  getJobItem(id: number): JobItem | null {
    const stmt = this.db.prepare('SELECT * FROM job_items WHERE id = ?');
    return stmt.get(id) as JobItem | null;
  }

  getJobItemsByJobId(jobId: number): JobItem[] {
    const stmt = this.db.prepare('SELECT * FROM job_items WHERE job_id = ? ORDER BY id ASC');
    return stmt.all(jobId) as JobItem[];
  }

  getJobItemByEssidBssid(jobId: number, essid: string, bssid: string): JobItem | null {
    const stmt = this.db.prepare(
      'SELECT * FROM job_items WHERE job_id = ? AND essid = ? AND bssid = ? LIMIT 1'
    );
    return stmt.get(jobId, essid, bssid) as JobItem | null;
  }

  updateJobItem(id: number, input: UpdateJobItemInput): void {
    const fields = Object.keys(input).map(key => `${key} = ?`).join(', ');
    const values = Object.values(input);
    const stmt = this.db.prepare(`UPDATE job_items SET ${fields} WHERE id = ?`);
    stmt.run(...values, id);
  }

  // Job Dictionaries
  createJobDictionary(jobId: number, dictionaryId: number): void {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO job_dictionaries (job_id, dictionary_id, status) VALUES (?, ?, ?)'
    );
    stmt.run(jobId, dictionaryId, 'pending');
  }

  updateJobDictionary(jobId: number, dictionaryId: number, status: string): void {
    const stmt = this.db.prepare(
      'UPDATE job_dictionaries SET status = ? WHERE job_id = ? AND dictionary_id = ?'
    );
    stmt.run(status, jobId, dictionaryId);
  }

  getJobDictionaries(jobId: number): JobDictionary[] {
    const stmt = this.db.prepare('SELECT * FROM job_dictionaries WHERE job_id = ?');
    return stmt.all(jobId) as JobDictionary[];
  }

  getDictionaryCoverage(dictionaryId: number, jobIds: number[]): number {
    if (jobIds.length === 0) return 0;
    const placeholders = jobIds.map(() => '?').join(',');
    const stmt = this.db.prepare(
      `SELECT COUNT(DISTINCT job_id) as count FROM job_dictionaries
       WHERE dictionary_id = ? AND job_id IN (${placeholders})`
    );
    const result = stmt.get(dictionaryId, ...jobIds) as { count: number };
    return result.count;
  }

  close() {
    this.db.close();
  }
}

export const db = new DatabaseManager();
