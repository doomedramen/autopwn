import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// User schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['user', 'admin', 'superuser']),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.enum(['user', 'admin', 'superuser']).optional(),
  isActive: z.boolean().optional(),
});

// Capture schemas
export const uploadCaptureSchema = z.object({
  filename: z.string().min(1),
  fileSize: z.number().positive(),
});

// Dictionary schemas
export const uploadDictionarySchema = z.object({
  name: z.string().min(1).max(255),
});

export const generateDictionarySchema = z.object({
  name: z.string().min(1).max(255),
  keywords: z.array(z.string().min(1)).min(1).max(50),
  options: z.object({
    includeUppercase: z.boolean().default(true),
    includeLowercase: z.boolean().default(true),
    includeMixedCase: z.boolean().default(true),
    leetSpeak: z.boolean().default(false),
    specialCharPadding: z.boolean().default(false),
    specialChars: z.array(z.string()).default(['!', '@', '#', '$']),
    numberPadding: z.boolean().default(false),
    numberRange: z.tuple([z.number(), z.number()]).default([0, 999]),
    minLength: z.number().min(1).max(100).default(8),
    maxLength: z.number().min(1).max(100).default(20),
  }),
});

// Job schemas
export const createJobSchema = z.object({
  name: z.string().min(1).max(255),
  networkIds: z.array(z.string().uuid()).min(1, 'At least one network is required'),
  dictionaryIds: z.array(z.string().uuid()).min(1, 'At least one dictionary is required'),
  attackMode: z.enum(['straight', 'combinator', 'mask', 'hybrid']).default('straight'),
  hashcatOptions: z
    .object({
      workloadProfile: z.number().min(1).max(4).default(3),
      optimized: z.boolean().default(true),
      rules: z.array(z.string()).default([]),
    })
    .optional(),
});

// Config schemas
export const updateConfigSchema = z.object({
  maxConcurrentJobs: z.number().min(1).max(10).optional(),
  maxPcapSize: z.number().positive().optional(),
  maxDictionarySize: z.number().positive().optional(),
  maxGeneratedDictSize: z.number().positive().optional(),
  maxGenerationKeywords: z.number().min(1).max(100).optional(),
  hashcatDefaultWorkload: z.number().min(1).max(4).optional(),
  hashcatJobTimeout: z.number().min(0).optional(),
  allowUserRegistration: z.boolean().optional(),
});

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// Query schemas
export const capturesQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  sort: z.enum(['uploadedAt', 'filename']).default('uploadedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const networksQuerySchema = paginationSchema.extend({
  ssid: z.string().optional(),
  captureId: z.string().uuid().optional(),
  cracked: z.coerce.boolean().optional(),
});

export const dictionariesQuerySchema = paginationSchema.extend({
  type: z.enum(['uploaded', 'generated']).optional(),
  status: z.enum(['ready', 'generating', 'failed']).optional(),
});

export const jobsQuerySchema = paginationSchema.extend({
  status: z.enum(['waiting', 'active', 'completed', 'failed', 'cancelled']).optional(),
  sort: z.enum(['createdAt', 'startedAt', 'completedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const resultsQuerySchema = paginationSchema.extend({
  networkId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  sort: z.enum(['crackedAt', 'ssid']).default('crackedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const usersQuerySchema = paginationSchema.extend({
  role: z.enum(['user', 'admin', 'superuser']).optional(),
  search: z.string().optional(),
});
