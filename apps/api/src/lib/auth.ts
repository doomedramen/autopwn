import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { env } from '@/config/env'
import { db } from '@/db'
import * as schema from '@/db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...schema,
      user: schema.users,
      account: schema.accounts,
      session: schema.sessions,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
    minPasswordLength: 8,
    sendEmailVerificationOnSignUp: true,
  },
  socialProviders: {
    // Add social providers if needed
  },
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // 1 day
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
    defaultCookieAttributes: {
      sameSite: 'lax', // Use 'lax' for same-origin, more reliable
      secure: env.NODE_ENV === 'production',
    },
  },
  // Include custom fields in the session
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
      },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
    },
  },
  email: {
    // Configure email settings
    enabled: true,
    from: "AutoPWN <noreply@autopwn.local>",
  },
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    env.NODE_ENV === 'production' ? 'https://your-production-domain.com' : null
  ].filter(Boolean),
})