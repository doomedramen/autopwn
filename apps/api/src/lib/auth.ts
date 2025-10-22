import { betterAuth } from 'better-auth'
import { admin, twoFactor } from 'better-auth/plugins'
import { Pool } from 'pg'
import { env } from '@/config/env'

// Create PostgreSQL connection pool for Better Auth
export const authClient = betterAuth({
  database: new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000, // 10 seconds timeout
    idleTimeoutMillis: 30000,       // 30 seconds idle timeout
  }),

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true if you want email verification
    // Disable public sign-up - only admins can create users
    disableSignUp: true,
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Account management
  account: {
    accountLinking: {
      enabled: true,
      allowDifferentEmails: false,
      trustedProviders: ['google', 'github', 'microsoft'],
    },
  },

  // Social providers (optional - uncomment as needed)
  // socialProviders: {
  //   google: {
  //     clientId: env.GOOGLE_CLIENT_ID,
  //     clientSecret: env.GOOGLE_CLIENT_SECRET,
  //   },
  //   github: {
  //     clientId: env.GITHUB_CLIENT_ID,
  //     clientSecret: env.GITHUB_CLIENT_SECRET,
  //   },
  // },

  // Verification for email verification, password reset, etc.
  verification: {
    modelName: 'verifications',
    fields: {
      userId: 'user_id',
    },
    disableCleanup: false,
  },

  // Custom user schema with role field
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
        required: false,
      },
    },
  },

  // Session schema
  session: {
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

  // Account schema
  account: {
    modelName: 'accounts',
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

  // Advanced options
  advanced: {
    generateId: false, // We're using text IDs, not UUIDs
    crossSubDomainCookies: {
      enabled: false,
    },
    secureCookies: env.NODE_ENV === 'production',
    prefixedCookies: false,
  },

  // Plugins
  plugins: [
    // Admin plugin for admin functionality
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),

    // Two-factor authentication plugin (optional)
    // twoFactor({
    //   issuer: 'AutoPWN',
    // }),
  ],

  // Base URLs
  baseURL: env.AUTH_URL,
  baseURL: env.FRONTEND_URL,
})