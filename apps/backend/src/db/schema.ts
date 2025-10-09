import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  real,
  boolean,
  unique,
  index
} from 'drizzle-orm/pg-core';

// Users table for authentication (better-auth expects 'user' table name)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
}));

// Account table for authentication (better-auth stores passwords here)
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('accounts_user_id_idx').on(table.userId),
}));

// Sessions table for better-auth
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('sessions_user_id_idx').on(table.userId),
  tokenIdx: index('sessions_token_idx').on(table.token),
}));

// Jobs table with user ownership
export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  jobId: text('job_id'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  status: text('status').notNull().default('pending'),
  priority: integer('priority').notNull().default(0),
  paused: integer('paused').notNull().default(0),
  batchMode: integer('batch_mode').notNull().default(0),
  itemsTotal: integer('items_total'),
  itemsCracked: integer('items_cracked'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  currentDictionary: text('current_dictionary'),
  progress: real('progress'),
  hashCount: integer('hash_count'),
  speed: text('speed'),
  eta: text('eta'),
  error: text('error'),
  logs: text('logs'),
  captures: text('captures'),
  totalHashes: integer('total_hashes')
}, (table) => ({
  userIdIdx: index('jobs_user_id_idx').on(table.userId),
  statusIdx: index('jobs_status_idx').on(table.status),
  priorityIdx: index('jobs_priority_idx').on(table.priority.desc(), table.createdAt.asc()),
}));

// Job items table with user ownership
export const jobItems = pgTable('job_items', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  essid: text('essid'),
  bssid: text('bssid'),
  status: text('status').notNull().default('pending'),
  password: text('password'),
  crackedAt: timestamp('cracked_at'),
  pcapFilename: text('pcap_filename')
}, (table) => ({
  jobIdIdx: index('job_items_job_id_idx').on(table.jobId),
  userIdIdx: index('job_items_user_id_idx').on(table.userId),
}));

// Job dictionaries table (junction table)
export const jobDictionaries = pgTable('job_dictionaries', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  dictionaryId: integer('dictionary_id').notNull().references(() => dictionaries.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending')
}, (table) => ({
  jobIdDictionaryIdUnique: unique('job_dictionaries_job_id_dictionary_id_unique').on(table.jobId, table.dictionaryId),
  jobIdIdx: index('job_dictionaries_job_id_idx').on(table.jobId),
}));

// Results table with user ownership
export const results = pgTable('results', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  essid: text('essid').notNull(),
  password: text('password').notNull(),
  crackedAt: timestamp('cracked_at').defaultNow().notNull(),
  pcapFilename: text('pcap_filename')
}, (table) => ({
  jobIdIdx: index('results_job_id_idx').on(table.jobId),
  userIdIdx: index('results_user_id_idx').on(table.userId),
}));

// Dictionaries table with user ownership
export const dictionaries = pgTable('dictionaries', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  path: text('path').notNull(),
  size: integer('size').notNull()
}, (table) => ({
  userIdIdx: index('dictionaries_user_id_idx').on(table.userId),
  userIdNameUnique: unique('dictionaries_user_id_name_unique').on(table.userId, table.name),
}));

// PCAP ESSID mapping table with user ownership
export const pcapEssidMapping = pgTable('pcap_essid_mapping', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pcapFilename: text('pcap_filename').notNull(),
  essid: text('essid').notNull(),
  bssid: text('bssid'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('pcap_essid_mapping_user_id_idx').on(table.userId),
  userIdPcapFilenameEssidUnique: unique('pcap_essid_mapping_user_id_pcap_filename_essid_unique').on(table.userId, table.pcapFilename, table.essid),
  pcapFilenameIdx: index('pcap_essid_mapping_pcap_filename_idx').on(table.pcapFilename),
  essidIdx: index('pcap_essid_mapping_essid_idx').on(table.essid),
}));

// Export types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobItem = typeof jobItems.$inferSelect;
export type NewJobItem = typeof jobItems.$inferInsert;
export type JobDictionary = typeof jobDictionaries.$inferSelect;
export type NewJobDictionary = typeof jobDictionaries.$inferInsert;
export type Result = typeof results.$inferSelect;
export type NewResult = typeof results.$inferInsert;
export type Dictionary = typeof dictionaries.$inferSelect;
export type NewDictionary = typeof dictionaries.$inferInsert;
export type PcapEssidMapping = typeof pcapEssidMapping.$inferSelect;
export type NewPcapEssidMapping = typeof pcapEssidMapping.$inferInsert;