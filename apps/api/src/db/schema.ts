import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  varchar,
  uuid,
  pgEnum,
  jsonb,
  bigint
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import {
  dictionaryProcessingConfigSchema,
  jobConfigSchema,
  jobResultSchema,
  jobResultDataSchema,
} from './jsonb-schemas'

// Enums
export const roleEnum = pgEnum('role', ['user', 'admin', 'superuser'])
export const jobStatusEnum = pgEnum('job_status', ['pending', 'running', 'completed', 'failed', 'cancelled'])
export const networkStatusEnum = pgEnum('network_status', ['ready', 'processing', 'failed'])
export const dictionaryStatusEnum = pgEnum('dictionary_status', ['ready', 'uploading', 'processing', 'failed'])
export const dictionaryTypeEnum = pgEnum('dictionary_type', ['uploaded', 'generated'])

// Users table (Better Auth compatible)
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  emailVerified: boolean('email_verified').default(false),
  image: varchar('image', { length: 500 }),
  role: roleEnum('role').default('user').notNull(), // AutoPWN custom field
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Sessions table for Better Auth
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Accounts table for OAuth providers (Better Auth compatible)
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  provider: varchar('provider', { length: 50 }).notNull().default('credential'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Networks table
export const networks = pgTable('networks', {
  id: uuid('id').primaryKey().defaultRandom(),
  ssid: varchar('ssid', { length: 255 }),
  bssid: varchar('bssid', { length: 17 }).notNull(),
  encryption: varchar('encryption', { length: 50 }).notNull(),
  status: networkStatusEnum('status').default('ready').notNull(),
  channel: integer('channel'),
  frequency: integer('frequency'),
  signalStrength: integer('signal_strength'),
  captureDate: timestamp('capture_date').defaultNow().notNull(),
  location: text('location'),
  notes: text('notes'),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Dictionaries table
export const dictionaries = pgTable('dictionaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  filename: varchar('filename', { length: 500 }).notNull(),
  type: dictionaryTypeEnum('type').notNull(),
  status: dictionaryStatusEnum('status').default('uploading').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  wordCount: integer('word_count'),
  encoding: varchar('encoding', { length: 50 }).default('utf-8'),
  checksum: varchar('checksum', { length: 64 }),
  filePath: varchar('file_path', { length: 1000 }),
  processingConfig: jsonb('processing_config'),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Jobs table
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: jobStatusEnum('status').default('pending').notNull(),
  networkId: uuid('network_id').references(() => networks.id, { onDelete: 'cascade' }).notNull(),
  dictionaryId: uuid('dictionary_id').references(() => dictionaries.id, { onDelete: 'cascade' }).notNull(),
  config: jsonb('config').notNull(),
  progress: integer('progress').default(0),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  result: jsonb('result'),
  errorMessage: text('error_message'),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Job results table for captured handshakes/cracked passwords
export const jobResults = pgTable('job_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'handshake', 'password', 'error'
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Verifications table (Better Auth compatible)
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users)
export const selectUserSchema = createSelectSchema(users)
export const insertNetworkSchema = createInsertSchema(networks)
export const selectNetworkSchema = createSelectSchema(networks)

// Dictionary schemas with JSONB validation
export const insertDictionarySchema = createInsertSchema(dictionaries)
export const selectDictionarySchema = createSelectSchema(dictionaries)

// Job schemas with JSONB validation
export const insertJobSchema = createInsertSchema(jobs)
export const selectJobSchema = createSelectSchema(jobs)

// Job result schemas with JSONB validation
export const insertJobResultSchema = createInsertSchema(jobResults)
export const selectJobResultSchema = createSelectSchema(jobResults)

// Types
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
export type Network = typeof networks.$inferSelect
export type NewNetwork = typeof networks.$inferInsert
export type Dictionary = typeof dictionaries.$inferSelect
export type NewDictionary = typeof dictionaries.$inferInsert
export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert
export type JobResult = typeof jobResults.$inferSelect
export type NewJobResult = typeof jobResults.$inferInsert
export type Verification = typeof verifications.$inferSelect
export type NewVerification = typeof verifications.$inferInsert