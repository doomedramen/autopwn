import {
  pgTable,
  uuid,
  varchar,
  bigint,
  boolean,
  timestamp,
  text,
  integer,
  decimal,
  jsonb,
  primaryKey,
  unique,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  usernameIdx: index('users_username_idx').on(table.username),
  emailIdx: index('users_email_idx').on(table.email),
}));

// Uploaded files (PCAPs + Dictionaries)
export const uploads = pgTable('uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  fileChecksum: varchar('file_checksum', { length: 64 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  uploadType: varchar('upload_type', { length: 20 }).notNull(), // 'pcap' | 'dictionary'
  metadata: jsonb('metadata'), // file-specific metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userUploadTypeIdx: index('uploads_user_type_idx').on(table.userId, table.uploadType),
  checksumIdx: index('uploads_checksum_idx').on(table.fileChecksum),
  uploadTypeIdx: index('uploads_type_idx').on(table.uploadType),
}));

// Networks discovered from PCAPs
export const networks = pgTable('networks', {
  id: uuid('id').primaryKey().defaultRandom(),
  uploadId: uuid('upload_id').references(() => uploads.id, { onDelete: 'cascade' }),
  essid: varchar('essid', { length: 255 }),
  bssid: varchar('bssid', { length: 17 }).notNull(),
  channel: integer('channel'),
  encryption: varchar('encryption', { length: 50 }),
  hasHandshake: boolean('has_handshake').default(false),
  firstSeen: timestamp('first_seen'),
  lastSeen: timestamp('last_seen'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uploadBssidUnique: unique('networks_upload_bssid_unique').on(table.uploadId, table.bssid),
  bssidIdx: index('networks_bssid_idx').on(table.bssid),
  handshakeIdx: index('networks_handshake_idx').on(table.hasHandshake),
  uploadIdx: index('networks_upload_idx').on(table.uploadId),
}));

// Jobs
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  progress: integer('progress').default(0),
  cracked: integer('cracked').default(0),
  totalHashes: integer('total_hashes').default(0),
  speedCurrent: decimal('speed_current', { precision: 10, scale: 2 }),
  speedAverage: decimal('speed_average', { precision: 10, scale: 2 }),
  speedUnit: varchar('speed_unit', { length: 10 }).default('H/s'),
  eta: varchar('eta', { length: 50 }),
  hashcatSession: varchar('hashcat_session', { length: 255 }),
  consolidatedFilePath: text('consolidated_file_path'),
  jobOptions: jsonb('job_options').notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userStatusIdx: index('jobs_user_status_idx').on(table.userId, table.status),
  statusIdx: index('jobs_status_idx').on(table.status),
  sessionIdx: index('jobs_session_idx').on(table.hashcatSession),
  createdAtIdx: index('jobs_created_at_idx').on(table.createdAt),
}));

// Job PCAPs (many-to-many relationship)
export const jobPcaps = pgTable('job_pcaps', {
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
  uploadId: uuid('upload_id').references(() => uploads.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.jobId, table.uploadId] }),
  jobIdx: index('job_pcaps_job_idx').on(table.jobId),
  uploadIdx: index('job_pcaps_upload_idx').on(table.uploadId),
}));

// Job networks (many-to-many relationship)
export const jobNetworks = pgTable('job_networks', {
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
  networkId: uuid('network_id').references(() => networks.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.jobId, table.networkId] }),
  jobIdx: index('job_networks_job_idx').on(table.jobId),
  networkIdx: index('job_networks_network_idx').on(table.networkId),
}));

// Job dictionaries (many-to-many relationship)
export const jobDictionaries = pgTable('job_dictionaries', {
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
  uploadId: uuid('upload_id').references(() => uploads.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.jobId, table.uploadId] }),
  jobIdx: index('job_dictionaries_job_idx').on(table.jobId),
  uploadIdx: index('job_dictionaries_upload_idx').on(table.uploadId),
}));

// Cracked passwords results
export const crackedPasswords = pgTable('cracked_passwords', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
  networkId: uuid('network_id').references(() => networks.id, { onDelete: 'set null' }),
  hash: text('hash').notNull(),
  plainPassword: text('plain_password').notNull(),
  salt: text('salt'),
  hexPlain: text('hex_plain'),
  crackedAt: timestamp('cracked_at').defaultNow().notNull(),
}, (table) => ({
  jobIdx: index('cracked_passwords_job_idx').on(table.jobId),
  networkIdx: index('cracked_passwords_network_idx').on(table.networkId),
  hashIdx: index('cracked_passwords_hash_idx').on(table.hash),
}));

// Type exports for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;

export type Network = typeof networks.$inferSelect;
export type NewNetwork = typeof networks.$inferInsert;

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export type JobPcap = typeof jobPcaps.$inferSelect;
export type NewJobPcap = typeof jobPcaps.$inferInsert;

export type JobNetwork = typeof jobNetworks.$inferSelect;
export type NewJobNetwork = typeof jobNetworks.$inferInsert;

export type JobDictionary = typeof jobDictionaries.$inferSelect;
export type NewJobDictionary = typeof jobDictionaries.$inferInsert;

export type CrackedPassword = typeof crackedPasswords.$inferSelect;
export type NewCrackedPassword = typeof crackedPasswords.$inferInsert;

// Relations
export const crackedPasswordsRelations = relations(crackedPasswords, ({ one }) => ({
  job: one(jobs, {
    fields: [crackedPasswords.jobId],
    references: [jobs.id]
  }),
  network: one(networks, {
    fields: [crackedPasswords.networkId],
    references: [networks.id]
  })
}));

export const networksRelations = relations(networks, ({ many, one }) => ({
  crackedPasswords: many(crackedPasswords),
  upload: one(uploads, {
    fields: [networks.uploadId],
    references: [uploads.id]
  })
}));

export const jobsRelations = relations(jobs, ({ many }) => ({
  crackedPasswords: many(crackedPasswords)
}));