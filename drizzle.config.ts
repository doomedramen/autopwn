import { defineConfig } from 'drizzle-kit';
import 'dotenv-flow/config';

export default defineConfig({
  schema: './src/lib/db/schema.ts',  // Use TypeScript schema in all environments
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});