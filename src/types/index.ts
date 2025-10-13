// Core file types
export interface PcapInfo {
  filename: string;
  path: string;
  size: number;
  checksum: string;
  networks: NetworkInfo[];
  isValid: boolean;
  errorMessage?: string;
}

export interface NetworkInfo {
  id: string;
  essid: string;
  bssid: string;
  channel?: number;
  encryption?: string;
  hasHandshake: boolean;
  firstSeen: Date;
  lastSeen: Date;
}

// Dictionary types
export interface DictionaryInfo {
  id?: string;
  name: string;
  path: string;
  size: number;
  lineCount: number;
  checksum: string;
  encoding: string;
  createdAt: Date;
  lastModified: Date;
  isCompressed: boolean;
}

// Job types
export interface JobCreationRequest {
  name: string;
  pcaps: string[];
  dictionaries: string[];
  options: HashcatOptions;
  priority?: number;
}

export interface JobInfo {
  id: string;
  name: string;
  status: JobStatus;
  progress: number;
  speed?: string;
  eta?: string;
  cracked: number;
  total: number;
  currentDictionary?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  options: HashcatOptions;
}

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'queued';

// Hashcat configuration
export interface HashcatOptions {
  attackMode: AttackMode;
  hashType: number;
  rules?: string[];
  mask?: string;
  workloadProfile?: WorkloadProfile;
  gpuTempAbort?: number;
  gpuTempDisable?: boolean;
  optimizedKernelEnable?: boolean;
  potfileDisable?: boolean;
  session?: string;
}

export type AttackMode =
  | 0 // Straight
  | 1 // Combination
  | 3 // Brute-force
  | 6 // Hybrid Wordlist + Mask
  | 7 // Hybrid Mask + Wordlist;

export type WorkloadProfile =
  | 1 // Desktop
  | 2 // Laptop
  | 3 // High Performance Desktop
  | 4 // Fanless/Embedded;

// Hashcat result types
export interface HashcatResult {
  hash: string;
  plain: string;
  salt?: string;
  hexPlain?: string;
  crackerId?: number;
  timeCracked?: Date;
}

export interface HashcatSession {
  name: string;
  status: JobStatus;
  progress: number;
  speed: {
    current: number;
    average: number;
    unit: string;
  };
  eta: string;
  cracked: number;
  total: number;
  currentDictionary: string;
  error?: string;
}

// Tool execution types
export interface ToolExecutionOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
  retries?: number;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  data?: T;
  executionTime: number;
}

// File system types
export interface FileUploadOptions {
  maxSize: number;
  allowedExtensions: string[];
  generateChecksum: boolean;
  validateContent: boolean;
}

export interface DirectoryOptions {
  createIfMissing: boolean;
  permissions?: string;
  recursive?: boolean;
}

export interface HashcatDeviceInfo {
  deviceId: number;
  type: 'cpu' | 'gpu' | 'accelerator';
  name: string;
  version: string;
  memory: number;
  cores?: number;
  clockSpeed?: number;
  temperature?: number;
  utilization?: number;
}