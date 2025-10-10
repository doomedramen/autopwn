import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';
import dotenvFlow from 'dotenv-flow';

// Load environment variables using dotenv-flow
// This loads .env, .env.local, .env.{NODE_ENV}, .env.{NODE_ENV}.local in order
dotenvFlow.config();

// List of insecure/default secrets that should never be used in production
const INSECURE_SECRETS = [
  'dev-secret-key-local-development-only-change-in-production',
  'your-secret-key-here',
  'change-this-secret-key-in-production',
  'secret',
  'password',
  '123456',
];

export const env = createEnv({
  server: {
    // Node environment
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // Server configuration
    PORT: z.coerce.number().positive().default(3001),

    // Database configuration
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').refine(
      (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
      'DATABASE_URL must be a valid PostgreSQL connection string'
    ),

    // Better Auth configuration with strong validation
    BETTER_AUTH_SECRET: z.string()
      .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters long')
      .refine(
        (secret) => {
          const nodeEnv = process.env.NODE_ENV || 'development';
          // In production, reject insecure secrets
          if (nodeEnv === 'production') {
            return !INSECURE_SECRETS.includes(secret);
          }
          return true;
        },
        {
          message: 'BETTER_AUTH_SECRET is using a default/insecure value. Generate a secure secret with: openssl rand -base64 32'
        }
      ),

    BETTER_AUTH_URL: z.string().url().default('http://localhost:3001'),

    // File paths
    PCAPS_PATH: z.string().min(1).default('./volumes/pcaps'),
    DICTIONARIES_PATH: z.string().min(1).default('./volumes/dictionaries'),
    JOBS_PATH: z.string().min(1).default('./volumes/jobs'),

    // GPU configuration (optional)
    HASHCAT_DEVICE_TYPE: z.enum(['cpu', 'nvidia', 'amd', 'intel']).default('cpu'),

    // Job timeout configuration (maximum runtime in hours)
    JOB_TIMEOUT_HOURS: z.coerce.number().positive().default(24),
  },

  /**
   * What object holds the environment variables at runtime.
   */
  runtimeEnv: process.env,

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   */
  skipValidation: false,

  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,

  /**
   * Called when validation fails. By default the error is logged and
   * process.exit(1) is called.
   */
  onValidationError: (issues) => {
    console.error('❌ Invalid environment variables:');
    console.error(issues);
    throw new Error('Invalid environment variables');
  },

  /**
   * Called when a server-side environment variable is accessed on the client.
   */
  onInvalidAccess: (variable: string) => {
    throw new Error(
      `❌ Attempted to access server-side environment variable '${variable}' on the client`
    );
  },
});