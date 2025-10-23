import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { env } from '@/config/env'
import { db } from '@/db'
import { emailService } from '@/lib/email'

export const authClient: any = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: env.NODE_ENV === 'production', // Enable in production only
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendVerificationEmail: async ({ user, url, token }) => {
      try {
        const sent = await emailService.sendVerificationEmail(user.email, url)

        if (!sent) {
          // In development or when SMTP is not configured, log to console
          console.log(`
╔══════════════════════════════════════════════════════════════╗
║            📧 EMAIL VERIFICATION (Development Mode)          ║
╠══════════════════════════════════════════════════════════════╣
║ User: ${user.email.padEnd(54)} ║
║ Verification URL:                                            ║
║ ${url.padEnd(60)} ║
║ Token: ${token.substring(0, 30).padEnd(54)}... ║
╠══════════════════════════════════════════════════════════════╣
║ ⚠️  SMTP not configured - email not sent                    ║
║ In production, configure SMTP to enable email verification  ║
╚══════════════════════════════════════════════════════════════╝
          `)
        }
      } catch (error) {
        console.error('Failed to send verification email:', error)
        // Don't throw error in development to allow testing
        if (env.NODE_ENV === 'production') {
          throw error
        }
      }
    },
  },
  // Note: Social providers disabled for now - can be configured later
  // socialProviders: {},
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
    modelName: 'sessions',
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
    },
  },
  account: {
    modelName: 'accounts',
    accountLinking: {
      enabled: true,
      allowDifferentEmails: false,
      trustedProviders: ['google', 'github', 'microsoft'],
    },
    fields: {
      userId: 'user_id',
      accountId: 'account_id',
      providerId: 'provider_id',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  user: {
    modelName: 'users',
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
      },
    },
  },
  verification: {
    modelName: 'verifications',
    disableCleanup: false,
  },
  advanced: {
    generateId: false, // We're using text IDs, not UUIDs
    crossSubDomainCookies: {
      enabled: false,
    },
    useSecureCookies: env.NODE_ENV === 'production',
  },
  plugins: [
    // Admin plugin for admin functionality
    {
      id: 'admin',
      // Add admin-specific configuration here
    },
  ],
})