import { pgTable, text, integer, decimal, jsonb, uuid, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { user } from './auth';

/**
 * Captures Table
 *
 * Stores uploaded PCAP files
 * Note: Uses UUID for id, but text for userId (foreign key to user table)
 */
export const captures = pgTable(
  'captures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    originalFilename: text('originalFilename').notNull(),
    filePath: text('filePath').notNull(),
    fileSize: integer('fileSize').notNull(),
    status: text('status', {
      enum: ['pending', 'processing', 'completed', 'failed'],
    })
      .notNull()
      .default('pending'),
    errorMessage: text('errorMessage'),
    uploadedAt: timestamp('uploadedAt').notNull().defaultNow(),
    processedAt: timestamp('processedAt'),
    networkCount: integer('networkCount').notNull().default(0),
    deletedAt: timestamp('deletedAt'),
  },
  (table) => ({
    userIdIdx: index('captures_user_id_idx').on(table.userId),
    statusIdx: index('captures_status_idx').on(table.status),
    uploadedAtIdx: index('captures_uploaded_at_idx').on(table.uploadedAt),
  })
);

/**
 * Networks Table
 *
 * Stores extracted WiFi networks from PCAP files
 * Each network represents a unique SSID/BSSID combination with a handshake
 */
export const networks = pgTable(
  'networks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    captureId: uuid('captureId')
      .notNull()
      .references(() => captures.id, { onDelete: 'cascade' }),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ssid: text('ssid').notNull(),
    bssid: text('bssid').notNull(),
    handshakeType: text('handshakeType'),
    hc22000FilePath: text('hc22000FilePath').notNull(),
    extractedAt: timestamp('extractedAt').notNull().defaultNow(),
    isCracked: boolean('isCracked').notNull().default(false),
    crackedAt: timestamp('crackedAt'),
  },
  (table) => ({
    captureIdIdx: index('networks_capture_id_idx').on(table.captureId),
    userIdIdx: index('networks_user_id_idx').on(table.userId),
    bssidIdx: index('networks_bssid_idx').on(table.bssid),
    isCrackedIdx: index('networks_is_cracked_idx').on(table.isCracked),
  })
);

/**
 * Dictionaries Table
 *
 * Stores uploaded or generated wordlists for password cracking
 */
export const dictionaries = pgTable(
  'dictionaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', { enum: ['uploaded', 'generated'] }).notNull(),
    status: text('status', { enum: ['ready', 'generating', 'failed'] })
      .notNull()
      .default('ready'),
    filePath: text('filePath'),
    fileSize: integer('fileSize'),
    lineCount: integer('lineCount'),
    generationOptions: jsonb('generationOptions'),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    completedAt: timestamp('completedAt'),
  },
  (table) => ({
    userIdIdx: index('dictionaries_user_id_idx').on(table.userId),
    typeIdx: index('dictionaries_type_idx').on(table.type),
    statusIdx: index('dictionaries_status_idx').on(table.status),
  })
);

/**
 * Jobs Table
 *
 * Stores hashcat cracking jobs
 */
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status', {
      enum: ['waiting', 'active', 'completed', 'failed', 'cancelled'],
    })
      .notNull()
      .default('waiting'),
    attackMode: text('attackMode', {
      enum: ['straight', 'combinator', 'mask', 'hybrid'],
    }).notNull(),
    hashcatOptions: jsonb('hashcatOptions'),
    progress: decimal('progress', { precision: 5, scale: 2 }).notNull().default('0'),
    currentSpeed: text('currentSpeed'),
    timeRemaining: integer('timeRemaining'),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    startedAt: timestamp('startedAt'),
    completedAt: timestamp('completedAt'),
    duration: integer('duration'),
    queuePosition: integer('queuePosition'),
    crackedCount: integer('crackedCount').notNull().default(0),
    totalNetworks: integer('totalNetworks').notNull().default(0),
    totalDictionaries: integer('totalDictionaries').notNull().default(0),
  },
  (table) => ({
    userIdIdx: index('jobs_user_id_idx').on(table.userId),
    statusIdx: index('jobs_status_idx').on(table.status),
    createdAtIdx: index('jobs_created_at_idx').on(table.createdAt),
  })
);

/**
 * Job Networks Junction Table
 *
 * Many-to-many relationship between jobs and networks
 */
export const jobNetworks = pgTable(
  'job_networks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('jobId')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    networkId: uuid('networkId')
      .notNull()
      .references(() => networks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: index('job_networks_job_id_idx').on(table.jobId),
    networkIdIdx: index('job_networks_network_id_idx').on(table.networkId),
  })
);

/**
 * Job Dictionaries Junction Table
 *
 * Many-to-many relationship between jobs and dictionaries
 */
export const jobDictionaries = pgTable(
  'job_dictionaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('jobId')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    dictionaryId: uuid('dictionaryId')
      .notNull()
      .references(() => dictionaries.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: index('job_dictionaries_job_id_idx').on(table.jobId),
    dictionaryIdIdx: index('job_dictionaries_dictionary_id_idx').on(table.dictionaryId),
  })
);

/**
 * Results Table
 *
 * Stores cracked passwords
 */
export const results = pgTable(
  'results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    networkId: uuid('networkId')
      .notNull()
      .references(() => networks.id, { onDelete: 'cascade' }),
    jobId: uuid('jobId').references(() => jobs.id, { onDelete: 'set null' }),
    dictionaryId: uuid('dictionaryId').references(() => dictionaries.id, {
      onDelete: 'set null',
    }),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    password: text('password').notNull(),
    crackedAt: timestamp('crackedAt').notNull().defaultNow(),
  },
  (table) => ({
    networkIdIdx: index('results_network_id_idx').on(table.networkId),
    jobIdIdx: index('results_job_id_idx').on(table.jobId),
    userIdIdx: index('results_user_id_idx').on(table.userId),
  })
);

/**
 * Config Table
 *
 * System-wide configuration (single row)
 */
export const config = pgTable('config', {
  id: integer('id').primaryKey().default(1),
  maxConcurrentJobs: integer('maxConcurrentJobs').notNull().default(2),
  maxPcapSize: integer('maxPcapSize').notNull().default(104857600), // 100MB
  maxDictionarySize: integer('maxDictionarySize').notNull().default(1073741824), // 1GB
  maxGeneratedDictSize: integer('maxGeneratedDictSize').notNull().default(104857600), // 100MB
  maxGenerationKeywords: integer('maxGenerationKeywords').notNull().default(10),
  hashcatDefaultWorkload: integer('hashcatDefaultWorkload').notNull().default(2),
  hashcatJobTimeout: integer('hashcatJobTimeout').notNull().default(86400), // 24 hours
  allowUserRegistration: boolean('allowUserRegistration').notNull().default(false),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

/**
 * Audit Logs Table
 *
 * Tracks important system actions for security and compliance
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').references(() => user.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    resourceType: text('resourceType'),
    resourceId: text('resourceId'),
    details: jsonb('details'),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  })
);

/**
 * API Keys Table
 *
 * For Pwnagotchi integration (v0.8.0+)
 * Stores API keys for programmatic access
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyPrefix: text('keyPrefix').notNull(), // e.g., "autopwn_live_"
    keyHash: text('keyHash').notNull(), // bcrypt hash of full key
    scopes: jsonb('scopes').notNull(), // ['upload:captures', 'read:results', etc.]
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    lastUsedAt: timestamp('lastUsedAt'),
    expiresAt: timestamp('expiresAt'),
  },
  (table) => ({
    userIdIdx: index('api_keys_user_id_idx').on(table.userId),
    keyPrefixIdx: index('api_keys_key_prefix_idx').on(table.keyPrefix),
  })
);

// Type exports for TypeScript
export type Capture = typeof captures.$inferSelect;
export type NewCapture = typeof captures.$inferInsert;
export type Network = typeof networks.$inferSelect;
export type NewNetwork = typeof networks.$inferInsert;
export type Dictionary = typeof dictionaries.$inferSelect;
export type NewDictionary = typeof dictionaries.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobNetwork = typeof jobNetworks.$inferSelect;
export type NewJobNetwork = typeof jobNetworks.$inferInsert;
export type JobDictionary = typeof jobDictionaries.$inferSelect;
export type NewJobDictionary = typeof jobDictionaries.$inferInsert;
export type Result = typeof results.$inferSelect;
export type NewResult = typeof results.$inferInsert;
export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
