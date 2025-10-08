import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3001"),
  PCAPS_PATH: z.string().default("./volumes/pcaps"),
  DICTIONARIES_PATH: z.string().default("./volumes/dictionaries"),
  JOBS_PATH: z.string().default("./volumes/jobs"),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);