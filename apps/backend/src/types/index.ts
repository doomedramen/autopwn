export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type JobItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

// User authentication types - Note: User type is exported from schema.ts

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

// Note: Database types are now exported from schema.ts as Drizzle inferred types

export interface HashcatProgress {
  progress: number;
  speed: string;
  eta: string;
  recovered: number;
  total: number;
}

export interface CreateJobInput {
  user_id: string; // Added user ownership
  filename: string;
  hash_count: number;
  batch_mode?: number;
  items_total?: number;
}

export interface CreateJobItemInput {
  user_id: string; // Added user ownership
  job_id: number;
  filename: string;
  essid?: string;
  bssid?: string;
}

export interface UpdateJobInput {
  status?: JobStatus;
  priority?: number;
  paused?: number;
  batch_mode?: number;
  items_total?: number;
  items_cracked?: number;
  started_at?: string;
  completed_at?: string;
  current_dictionary?: string;
  progress?: number;
  speed?: string;
  eta?: string;
  error?: string;
  logs?: string;
}

export interface UpdateJobItemInput {
  status?: JobItemStatus;
  essid?: string;
  bssid?: string;
  password?: string;
  cracked_at?: string;
}

export interface CreateResultInput {
  user_id: string; // Added user ownership
  job_id: number;
  essid: string;
  password: string;
  pcap_filename?: string | null;
}


export interface CaptureFile {
  filename: string;
  size: number;
  uploaded_at: string;
  essids: string[];
  bssids: string[];
}
