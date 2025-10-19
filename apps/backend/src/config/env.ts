import { z } from 'zod';

/**
 * Environment Configuration Schema
 *
 * CRITICAL: All configuration is read from environment variables at runtime
 * See docs/DEVELOPMENT.md for runtime configuration philosophy
 *
 * This module validates and provides type-safe access to environment variables
 */

const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server Configuration
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  // Database Configuration
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_IDLE_TIMEOUT: z.coerce.number().int().min(1000).default(30000),
  DATABASE_CONNECTION_TIMEOUT: z.coerce.number().int().min(500).default(2000),

  // Redis Configuration
  REDIS_URL: z.string().url(),
  REDIS_MAX_RETRIES: z.coerce.number().int().min(0).default(3),

  // Session Configuration
  SESSION_SECRET: z.string().min(32),
  SESSION_MAX_AGE: z.coerce.number().int().min(60).default(604800), // 7 days

  // File Storage
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_PCAP_SIZE: z.coerce.number().int().min(1024).default(104857600), // 100MB
  MAX_DICTIONARY_SIZE: z.coerce.number().int().min(1024).default(1073741824), // 1GB

  // Hashcat Configuration
  HASHCAT_BINARY_PATH: z.string().default('/usr/bin/hashcat'),
  HASHCAT_WORKLOAD_PROFILE: z.coerce.number().int().min(1).max(4).default(2),
  HASHCAT_JOB_TIMEOUT: z.coerce.number().int().min(60).default(86400), // 24 hours
  MAX_CONCURRENT_JOBS: z.coerce.number().int().min(1).default(2),

  // hcxpcapngtool Configuration
  HCXPCAPNGTOOL_BINARY_PATH: z.string().default('/usr/bin/hcxpcapngtool'),

  // Dictionary Generation
  CRUNCH_BINARY_PATH: z.string().default('/usr/bin/crunch'),
  MAX_GENERATED_DICT_SIZE: z.coerce.number().int().min(1024).default(104857600), // 100MB
  MAX_GENERATION_KEYWORDS: z.coerce.number().int().min(1).max(50).default(10),

  // Security
  CORS_ORIGIN: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim()))
    .default('http://localhost:3000'),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().int().min(1000).default(60000), // 1 minute

  // Optional: Frontend URL for CORS
  FRONTEND_URL: z.string().url().optional(),
});

/**
 * Validated Environment Configuration
 *
 * This is populated on first import and validated against the schema
 */
let config: z.infer<typeof envSchema>;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Environment validation failed:');
  if (error instanceof z.ZodError) {
    console.error(
      error.errors.map((err) => `  - ${err.path.join('.')}: ${err.message}`).join('\n')
    );
  } else {
    console.error(error);
  }
  process.exit(1);
}

/**
 * Type-safe environment configuration
 * All values are validated and have correct types
 */
export const env = config;

/**
 * Export type for use in other modules
 */
export type Env = typeof env;
