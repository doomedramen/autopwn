// User roles
export const USER_ROLES = {
  USER: 'user' as const,
  ADMIN: 'admin' as const,
  SUPERUSER: 'superuser' as const,
};

// Capture statuses
export const CAPTURE_STATUSES = {
  PENDING: 'pending' as const,
  PROCESSING: 'processing' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
};

// Dictionary types
export const DICTIONARY_TYPES = {
  UPLOADED: 'uploaded' as const,
  GENERATED: 'generated' as const,
};

// Dictionary statuses
export const DICTIONARY_STATUSES = {
  READY: 'ready' as const,
  GENERATING: 'generating' as const,
  FAILED: 'failed' as const,
};

// Job statuses
export const JOB_STATUSES = {
  WAITING: 'waiting' as const,
  ACTIVE: 'active' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
  CANCELLED: 'cancelled' as const,
};

// Attack modes
export const ATTACK_MODES = {
  STRAIGHT: 'straight' as const,
  COMBINATOR: 'combinator' as const,
  MASK: 'mask' as const,
  HYBRID: 'hybrid' as const,
};

// Error codes
export const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  JOB_RUNNING: 'JOB_RUNNING',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Audit log actions
export const AUDIT_ACTIONS = {
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_FAILED_LOGIN: 'auth.failed_login',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  CAPTURE_UPLOADED: 'capture.uploaded',
  CAPTURE_DELETED: 'capture.deleted',
  JOB_CREATED: 'job.created',
  JOB_STARTED: 'job.started',
  JOB_COMPLETED: 'job.completed',
  JOB_CANCELLED: 'job.cancelled',
  CONFIG_UPDATED: 'config.updated',
  RESULT_FOUND: 'result.found',
} as const;

// Default configuration values
export const DEFAULT_CONFIG = {
  maxConcurrentJobs: 2,
  maxPcapSize: 524288000, // 500MB
  maxDictionarySize: 10737418240, // 10GB
  maxGeneratedDictSize: 21474836480, // 20GB
  maxGenerationKeywords: 50,
  hashcatDefaultWorkload: 3,
  hashcatJobTimeout: 86400, // 24 hours
  allowUserRegistration: false,
};

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  PCAP: 524288000, // 500MB
  DICTIONARY: 10737418240, // 10GB
  GENERATED_DICTIONARY: 21474836480, // 20GB
};

// Pagination defaults
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
};

// Rate limiting
export const RATE_LIMITS = {
  GLOBAL: {
    MAX: 100,
    WINDOW: 60000, // 1 minute
  },
  UPLOAD: {
    MAX: 5,
    WINDOW: 60000, // 1 minute
  },
  AUTH: {
    MAX: 5,
    WINDOW: 300000, // 5 minutes
  },
};

// Job queue names
export const QUEUE_NAMES = {
  CONVERSION: 'conversion-queue',
  GENERATION: 'generation-queue',
  HASHCAT: 'hashcat-queue',
} as const;

// Special characters for dictionary generation
export const DEFAULT_SPECIAL_CHARS = ['!', '@', '#', '$', '%', '^', '&', '*'];

// Leet speak replacements
export const LEET_REPLACEMENTS: Record<string, string[]> = {
  a: ['4', '@'],
  e: ['3'],
  i: ['1', '!'],
  o: ['0'],
  s: ['5', '$'],
  t: ['7'],
  l: ['1'],
  g: ['9'],
  b: ['8'],
};
