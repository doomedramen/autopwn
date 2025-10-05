export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: number;
  filename: string;
  status: JobStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  current_dictionary: string | null;
  progress: number | null;
  hash_count: number | null;
  speed: string | null;
  eta: string | null;
  error: string | null;
  logs: string | null;
}

export interface Result {
  id: number;
  job_id: number;
  essid: string;
  password: string;
  cracked_at: string;
}

export interface Dictionary {
  id: number;
  name: string;
  path: string;
  size: number;
}

export interface HashcatProgress {
  progress: number;
  speed: string;
  eta: string;
  recovered: number;
  total: number;
}

export interface CreateJobInput {
  filename: string;
  hash_count: number;
}

export interface UpdateJobInput {
  status?: JobStatus;
  started_at?: string;
  completed_at?: string;
  current_dictionary?: string;
  progress?: number;
  speed?: string;
  eta?: string;
  error?: string;
  logs?: string;
}

export interface CreateResultInput {
  job_id: number;
  essid: string;
  password: string;
}
