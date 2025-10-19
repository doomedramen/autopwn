// User types
export type UserRole = 'user' | 'admin' | 'superuser';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  isActive: boolean;
}

// Capture types
export type CaptureStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Capture {
  id: string;
  userId: string;
  filename: string;
  originalFilename: string;
  filePath: string; // Original PCAP file
  hc22000FilePath: string | null; // Converted hc22000 file
  fileSize: number;
  status: CaptureStatus;
  errorMessage: string | null;
  uploadedAt: Date;
  processedAt: Date | null;
  networkCount: number;
}

// Network types
export interface Network {
  id: string;
  captureId: string;
  userId: string;
  ssid: string;
  bssid: string;
  handshakeType: string | null;
  hc22000FilePath: string;
  extractedAt: Date;
  isCracked: boolean;
  crackedAt: Date | null;
}

// Dictionary types
export type DictionaryType = 'uploaded' | 'generated';
export type DictionaryStatus = 'ready' | 'generating' | 'failed';

export interface DictionaryGenerationOptions {
  keywords: string[];
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeMixedCase: boolean;
  leetSpeak: boolean;
  specialCharPadding: boolean;
  specialChars: string[];
  numberPadding: boolean;
  numberRange: [number, number];
  minLength: number;
  maxLength: number;
}

export interface Dictionary {
  id: string;
  userId: string;
  name: string;
  type: DictionaryType;
  status: DictionaryStatus;
  filePath: string | null;
  fileSize: number | null;
  lineCount: number | null;
  generationOptions: DictionaryGenerationOptions | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

// Job types
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'cancelled';
export type AttackMode = 'straight' | 'combinator' | 'mask' | 'hybrid';

export interface HashcatOptions {
  workloadProfile: number;
  optimized: boolean;
  rules: string[];
}

export interface Job {
  id: string;
  userId: string;
  name: string;
  status: JobStatus;
  attackMode: AttackMode;
  hashcatOptions: HashcatOptions | null;
  progress: number;
  currentSpeed: string | null;
  timeRemaining: number | null;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  duration: number | null;
  queuePosition: number | null;
  crackedCount: number;
  totalNetworks: number;
  totalDictionaries: number;
}

// Result types
export interface Result {
  id: string;
  networkId: string;
  jobId: string | null;
  dictionaryId: string | null;
  userId: string;
  password: string;
  crackedAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// Config types
export interface Config {
  maxConcurrentJobs: number;
  maxPcapSize: number;
  maxDictionarySize: number;
  maxGeneratedDictSize: number;
  maxGenerationKeywords: number;
  hashcatDefaultWorkload: number;
  hashcatJobTimeout: number;
  allowUserRegistration: boolean;
}

// Audit log types
export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

// API Key types (for Pwnagotchi integration - v0.8.0+)
export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string; // First 8 chars for identification (e.g., "autopwn_")
  keyHash: string; // bcrypt hash of full key
  scopes: string[]; // ['upload:captures', 'read:results', etc.]
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}

export interface ApiKeyWithPlaintext extends ApiKey {
  plaintext: string; // Only returned on creation, never stored
}
