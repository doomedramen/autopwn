import { defineConfig } from 'drizzle-kit';
import 'dotenv-flow/config';

// Handle both development (TypeScript) and production (JavaScript) environments
const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  schema: isProduction
    ? './dist/lib/db/schema.js'  // Production: compiled JavaScript
    : './src/lib/db/schema.ts',  // Development: TypeScript source
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});