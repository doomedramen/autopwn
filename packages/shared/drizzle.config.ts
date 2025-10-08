import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: './src/drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://localhost/autopwn",
  },
} satisfies Config;