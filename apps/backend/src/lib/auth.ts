import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db';
import { env } from '../config';

/**
 * Better Auth Configuration
 *
 * Integrates with Drizzle ORM and PostgreSQL
 * See docs/BETTER_AUTH_SCHEMA.md for schema requirements
 */

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),

  // User model configuration
  user: {
    modelName: 'user',
    additionalFields: {
      // Custom fields registered with Better Auth
      // These must match the fields in our Drizzle schema
      role: {
        type: 'string',
        required: true,
        defaultValue: 'user',
        input: false, // Not exposed in signup
      },
      passwordHash: {
        type: 'string',
        required: true,
        input: false, // Never expose password hash
      },
      isActive: {
        type: 'boolean',
        required: true,
        defaultValue: true,
        input: false,
      },
      lastLoginAt: {
        type: 'date',
        required: false,
        input: false,
      },
      deletedAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
  },

  // Session configuration
  session: {
    modelName: 'session',
    expiresIn: env.SESSION_MAX_AGE,
    updateAge: 86400, // Update session every 24 hours
  },

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Can enable later
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  // Security
  secret: env.SESSION_SECRET,
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
    useSecureCookies: env.NODE_ENV === 'production',
  },
});

/**
 * Export types for Better Auth
 */
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
