export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type JobItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: number;
  job_id: string | null;
  filename: string;
  status: JobStatus;
  priority: number;
  paused: number;
  batch_mode: number;
  items_total: number | null;
  items_cracked: number | null;
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
  captures: string | null;
  total_hashes: number | null;
}

export interface JobItem {
  id: number;
  job_id: number;
  filename: string;
  essid: string | null;
  bssid: string | null;
  status: JobItemStatus;
  password: string | null;
  cracked_at: string | null;
  pcap_filename: string | null;
}

export interface JobDictionary {
  id: number;
  job_id: number;
  dictionary_id: number;
  status: string;
}

export interface Result {
  id: number;
  job_id: number;
  essid: string;
  password: string;
  cracked_at: string;
  pcap_filename: string | null;
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
  batch_mode?: number;
  items_total?: number;
}

export interface CreateJobItemInput {
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
  job_id: number;
  essid: string;
  password: string;
  pcap_filename?: string | null;
}

export interface PcapEssidMapping {
  id: number;
  pcap_filename: string;
  essid: string;
  bssid: string | null;
  created_at: string;
}

export interface CaptureFile {
  filename: string;
  size: number;
  uploaded_at: string;
  essids: string[];
  bssids: string[];
}
