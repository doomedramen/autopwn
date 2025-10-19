import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';

/**
 * Better Auth User Table
 *
 * IMPORTANT: This schema MUST follow Better Auth requirements:
 * - id must be text (Better Auth generates string IDs, NOT UUIDs)
 * - Required fields: id, name, email, emailVerified, image, createdAt, updatedAt
 * - Custom fields are registered in Better Auth config via additionalFields
 *
 * See docs/BETTER_AUTH_SCHEMA.md for complete documentation
 */
export const user = pgTable('user', {
  // ============================================
  // Better Auth Required Fields - DO NOT MODIFY
  // ============================================
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),

  // ============================================
  // Our Custom Fields
  // ============================================
  role: text('role', { enum: ['user', 'admin', 'superuser'] })
    .notNull()
    .default('user'),
  passwordHash: text('passwordHash').notNull(),
  isActive: boolean('isActive').notNull().default(true),
  lastLoginAt: timestamp('lastLoginAt'),
  deletedAt: timestamp('deletedAt'),
});

/**
 * Better Auth Session Table
 *
 * IMPORTANT: This schema MUST follow Better Auth requirements:
 * - All fields are required by Better Auth
 * - userId must reference user.id with cascade delete
 * - token must be unique
 *
 * See docs/BETTER_AUTH_SCHEMA.md for complete documentation
 */
export const session = pgTable('session', {
  // ============================================
  // Better Auth Required Fields - DO NOT MODIFY
  // ============================================
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expiresAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

// Type exports for TypeScript
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
