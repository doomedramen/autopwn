import type { Config } from 'drizzle-kit';

export default {
  dialect: 'postgresql',
  schema: './packages/shared/src/schema.ts',
  out: './packages/shared/src/drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://localhost/autopwn"
  },
  verbose: true,
  strict: true
} satisfies Config;