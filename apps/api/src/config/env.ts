import { z } from 'zod'
import dotenvFlow from 'dotenv-flow'

// Load environment variables
const result = dotenvFlow.config()
if (result.error) {
  console.error('Error loading .env file:', result.error)
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),

  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required'),

  // Redis (for Bull queues)
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // Authentication
  AUTH_SECRET: z.string().min(32, 'Auth secret must be at least 32 characters'),
  AUTH_URL: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),

  // File Upload
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().default('100MB'),

  // Email (for password reset, etc.)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Frontend URL
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Background Jobs
  DEFAULT_JOB_TIMEOUT: z.string().default('300000'), // 5 minutes in ms
  MAX_CONCURRENT_JOBS: z.string().default('5'),

  // Security
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW: z.string().default('900000'), // 15 minutes in ms
  RATE_LIMIT_MAX: z.string().default('100'),
})

function validateEnv() {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment variables:')
    console.error(error)
    process.exit(1)
  }
}

// Validate environment variables after loading them
export const env = validateEnv()

// Export individual env vars for convenience
export const {
  NODE_ENV,
  PORT,
  DATABASE_URL,
  REDIS_URL,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD,
  AUTH_SECRET,
  AUTH_URL,
  JWT_SECRET,
  UPLOAD_DIR,
  MAX_FILE_SIZE,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  FRONTEND_URL,
  DEFAULT_JOB_TIMEOUT,
  MAX_CONCURRENT_JOBS,
  CORS_ORIGIN,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_MAX,
} = env

// Development warnings
if (NODE_ENV === 'development') {
  if (AUTH_SECRET === 'your-secret-key-here') {
    console.warn('⚠️  Using default AUTH_SECRET in development. Set a proper secret in production!')
  }
  if (JWT_SECRET === 'your-jwt-secret-here') {
    console.warn('⚠️  Using default JWT_SECRET in development. Set a proper secret in production!')
  }
}