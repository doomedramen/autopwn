# Better Auth + Drizzle Schema Requirements

This document outlines the schema requirements for Better Auth when using Drizzle ORM with PostgreSQL.

## Core Better Auth Schema

Better Auth has specific requirements for user and session tables that we must follow.

### Base User Table (Required by Better Auth)

```typescript
// apps/backend/src/db/schema/auth.ts
import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  // Required fields by Better Auth
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),

  // Our custom fields (additionalFields in Better Auth config)
  role: text('role', { enum: ['user', 'admin', 'superuser'] }).notNull().default('user'),
  passwordHash: text('passwordHash').notNull(),
  isActive: boolean('isActive').notNull().default(true),
  lastLoginAt: timestamp('lastLoginAt'),
  deletedAt: timestamp('deletedAt'),
});
```

### Base Session Table (Required by Better Auth)

```typescript
export const session = pgTable('session', {
  // Required fields by Better Auth
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
```

## Better Auth Configuration

### Backend Auth Setup

```typescript
// apps/backend/src/lib/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg', // PostgreSQL
  }),

  // Customize user table
  user: {
    modelName: 'user', // Default table name
    additionalFields: {
      // Add our custom fields to Better Auth's type system
      role: {
        type: 'string',
        required: true,
        defaultValue: 'user',
        input: false, // Not exposed in signup
      },
      passwordHash: {
        type: 'string',
        required: true,
        input: false, // Never expose password hash
      },
      isActive: {
        type: 'boolean',
        required: true,
        defaultValue: true,
        input: false,
      },
      lastLoginAt: {
        type: 'date',
        required: false,
        input: false,
      },
      deletedAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
  },

  // Session configuration
  session: {
    modelName: 'session',
    expiresIn: 604800, // 7 days in seconds
    updateAge: 86400, // Update session every 24 hours
  },

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Can enable later
  },
});
```

## Full Schema Structure

Here's how our schema integrates with Better Auth:

```typescript
// apps/backend/src/db/schema/index.ts
import { pgTable, text, boolean, timestamp, integer, decimal, jsonb, uuid } from 'drizzle-orm/pg-core';

// ============================================
// Better Auth Tables (REQUIRED - DO NOT MODIFY BASE STRUCTURE)
// ============================================

export const user = pgTable('user', {
  // Better Auth required fields - DO NOT CHANGE
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),

  // Our custom fields
  role: text('role', { enum: ['user', 'admin', 'superuser'] }).notNull().default('user'),
  passwordHash: text('passwordHash').notNull(),
  isActive: boolean('isActive').notNull().default(true),
  lastLoginAt: timestamp('lastLoginAt'),
  deletedAt: timestamp('deletedAt'),
});

export const session = pgTable('session', {
  // Better Auth required fields - DO NOT CHANGE
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

// ============================================
// Our Custom Tables
// ============================================

export const captures = pgTable('captures', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  originalFilename: text('originalFilename').notNull(),
  filePath: text('filePath').notNull(),
  fileSize: integer('fileSize').notNull(),
  status: text('status', {
    enum: ['pending', 'processing', 'completed', 'failed']
  }).notNull().default('pending'),
  errorMessage: text('errorMessage'),
  uploadedAt: timestamp('uploadedAt').notNull().defaultNow(),
  processedAt: timestamp('processedAt'),
  networkCount: integer('networkCount').notNull().default(0),
  deletedAt: timestamp('deletedAt'),
});

// ... rest of our tables (networks, dictionaries, jobs, etc.)
```

## Important Notes

### ✅ DO:

1. **Keep Better Auth base fields unchanged:**
   - `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt` for user
   - `id`, `userId`, `token`, `expiresAt`, `ipAddress`, `userAgent`, `createdAt`, `updatedAt` for session

2. **Use text('id') for user.id:**
   - Better Auth generates string IDs, not UUIDs
   - Our other tables can use UUID

3. **Declare custom fields in Better Auth config:**
   - Use `additionalFields` to register our custom columns
   - This ensures type safety across Better Auth

4. **Use text('userId') for foreign keys to user:**
   - Must match the type of user.id (text, not UUID)

5. **Use table names 'user' and 'session':**
   - These are Better Auth defaults
   - Can customize with `modelName` if needed

### ❌ DON'T:

1. **Don't change Better Auth required field types**
   - Changing `id` from text to uuid will break Better Auth
   - Changing field names requires configuration

2. **Don't rename core tables without updating config**
   - If you want 'users' instead of 'user', must set `modelName: 'users'`

3. **Don't add NOT NULL constraints to Better Auth optional fields**
   - `image`, `ipAddress`, `userAgent` are optional

4. **Don't use UUID for user.id**
   - Better Auth uses string IDs
   - Use UUID for our other tables only

## Using Better Auth CLI

Better Auth provides a CLI to generate schema:

```bash
# Generate schema (will create migration files)
npx @better-auth/cli generate

# This will analyze your Better Auth config and generate the correct Drizzle schema
```

**However**, since we're manually defining our schema with custom fields, we should:

1. Define the schema as shown above
2. Run Drizzle migrations ourselves
3. Ensure Better Auth config matches our schema

## Migration Strategy

```bash
# 1. Create schema files
# apps/backend/src/db/schema/auth.ts (user, session tables)
# apps/backend/src/db/schema/app.ts (our custom tables)

# 2. Generate migration
pnpm --filter @autopwn/backend db:generate

# 3. Run migration
pnpm --filter @autopwn/backend db:migrate
```

## Type Safety

Better Auth will automatically infer types from our config:

```typescript
// In your code, you'll have proper types:
import { auth } from './lib/auth';

// session.user will have our custom fields typed!
const session = await auth.api.getSession({ headers });

if (session?.user) {
  console.log(session.user.role); // TypeScript knows this exists!
  console.log(session.user.email); // Standard Better Auth field
  console.log(session.user.isActive); // Our custom field
}
```

## References vs UUID

**Important distinction:**

```typescript
// User table - uses TEXT id (Better Auth requirement)
export const user = pgTable('user', {
  id: text('id').primaryKey(), // Better Auth generates string IDs
  // ...
});

// Our tables - use UUID
export const captures = pgTable('captures', {
  id: uuid('id').primaryKey().defaultRandom(), // We can use UUID
  userId: text('userId') // BUT foreign key to user must be TEXT
    .notNull()
    .references(() => user.id),
  // ...
});
```

## Initial Superuser Creation

We need to work with Better Auth's user creation:

```typescript
// apps/backend/src/db/seed.ts
import { auth } from '../lib/auth';
import { db } from './index';
import { user } from './schema/auth';
import bcrypt from 'bcrypt';

export async function seed() {
  // Check if superuser exists
  const existingSuperuser = await db.query.user.findFirst({
    where: (users, { eq }) => eq(users.role, 'superuser'),
  });

  if (!existingSuperuser) {
    // Create initial superuser
    const email = process.env.INITIAL_SUPERUSER_EMAIL || 'admin@autopwn.local';
    const password = process.env.INITIAL_SUPERUSER_PASSWORD || generateRandomPassword();
    const passwordHash = await bcrypt.hash(password, 12);

    // Better Auth generates the ID for us
    const betterAuthUser = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: 'Superuser',
      },
    });

    // Update the user with our custom fields
    await db.update(user)
      .set({
        role: 'superuser',
        passwordHash, // Update with our hash
      })
      .where(eq(user.id, betterAuthUser.user.id));

    console.log('✅ Initial superuser created');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY');
  }
}
```

## Summary

**Key Requirements:**
1. ✅ User table must have Better Auth required fields
2. ✅ Session table must have Better Auth required fields
3. ✅ Use `text('id')` for user.id (not UUID)
4. ✅ Foreign keys to user must be `text('userId')`
5. ✅ Declare custom fields in Better Auth config
6. ✅ Our other tables can use UUID for their IDs

**Integration Points:**
- Better Auth handles authentication/session management
- We add custom fields (role, passwordHash, etc.) to user table
- Our app tables (captures, networks, etc.) reference user via text foreign key
- Type safety maintained throughout

This approach gives us the best of both worlds: Better Auth's robust authentication system + our custom schema requirements.
