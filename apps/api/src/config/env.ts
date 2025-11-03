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
  MAX_FILE_SIZE: z.string().default('500MB'),
  MAX_DICTIONARY_SIZE: z.string().default('10GB'),

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
    const env = envSchema.parse(process.env)

    // Production-specific validations
    if (env.NODE_ENV === 'production') {
      const errors = []

      // Check for default/placeholder values that shouldn't be used in production
      const defaultSecrets = [
        'your-secret-key-here',
        'your-jwt-secret-here',
        'CHANGE_ME_IN_PRODUCTION',
        'CHANGE_ME_IN_PRODUCTION_MIN_32_CHARS',
        'password',
        'test_password',
        'default'
      ]

      const secretFields = ['AUTH_SECRET', 'JWT_SECRET', 'DATABASE_URL']
      secretFields.forEach(field => {
        const value = env[field as keyof typeof env]
        if (value && defaultSecrets.some(secret => value.includes(secret))) {
          errors.push(`❌ SECURITY: ${field} contains default/placeholder value in production`)
        }
      })

      // Check database URL for insecure defaults
      if (env.DATABASE_URL.includes('password') && env.DATABASE_URL.includes('localhost')) {
        errors.push('❌ SECURITY: Database URL appears to use default credentials in production')
      }

      // Check for weak authentication secrets
      if (env.AUTH_SECRET.length < 32) {
        errors.push('❌ SECURITY: AUTH_SECRET must be at least 32 characters in production')
      }

      if (env.JWT_SECRET.length < 32) {
        errors.push('❌ SECURITY: JWT_SECRET must be at least 32 characters in production')
      }

      if (errors.length > 0) {
        console.error('🚨 PRODUCTION SECURITY VALIDATION FAILED:')
        errors.forEach(error => console.error(error))
        console.error('\n💡 To fix:')
        console.error('1. Set secure random secrets in your environment')
        console.error('2. Use environment-specific .env files')
        console.error('3. Never commit secrets to version control')
        process.exit(1)
      }

      console.log('✅ Production environment security validation passed')
    }

    return env
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
  MAX_DICTIONARY_SIZE,
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