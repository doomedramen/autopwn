import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import {
  users,
  accounts,
  sessions,
  verifications,
  userProfiles,
} from './db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { logInfo } from '@/lib/logger';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users, // Map better-auth's 'user' to our 'users' table
      account: accounts, // Map better-auth's 'account' to our 'accounts' table
      session: sessions, // Map better-auth's 'session' to our 'sessions' table
      verification: verifications, // Map better-auth's 'verification' to our 'verifications' table
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Will be handled manually
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  account: {
    accountLinking: {
      enabled: false,
    },
  },
  socialProviders: {
    // Disable social providers for now
  },
  advanced: {
    database: {
      generateId: () => {
        // Use crypto.randomUUID on server, fallback on client
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
        }
        // Fallback implementation
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      },
    },
  },
  // Runtime-only configuration - use lazy evaluation
  secret:
    process.env.BETTER_AUTH_SECRET || 'default-secret-change-in-production',
  // Modern Next.js 15+ configuration - use dynamic baseURL
  baseURL:
    process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_APP_URL || ''
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
});

export type Session = typeof auth.$Infer.Session;

// AuthUser type based on what /api/auth/me returns
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  username: string;
  role: 'superuser' | 'admin' | 'user';
  isActive: boolean;
  isEmailVerified: boolean;
  requirePasswordChange: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Helper functions for user management
export async function createUser({
  email,
  password,
  username,
  role = 'user',
  requirePasswordChange = false,
}: {
  email: string;
  password: string;
  username: string;
  role?: 'superuser' | 'admin' | 'user';
  requirePasswordChange?: boolean;
}) {
  // Create user through better-auth sign-up to handle password hashing correctly
  const result = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: username,
    },
  });

  if (!result || !result.user) {
    throw new Error('Failed to create user through better-auth');
  }

  // Create user profile with custom fields
  const [profile] = await db
    .insert(userProfiles)
    .values({
      userId: result.user.id,
      username,
      role,
      isActive: true,
      isEmailVerified: false,
      requirePasswordChange,
    })
    .returning();

  return { user: result.user, profile };
}

export async function createSuperUserIfNotExists() {
  // Check if superuser already exists
  const existingSuperUser = await db.query.userProfiles.findFirst({
    where: (userProfiles, { eq }) => eq(userProfiles.role, 'superuser'),
  });

  if (existingSuperUser) {
    return existingSuperUser;
  }

  // Generate secure random credentials for initial superuser
  // In test environments (Playwright), use predictable credentials
  const isTestEnvironment = !!process.env.PLAYWRIGHT;

  const randomPassword = isTestEnvironment
    ? 'TestPassword123!'
    : generateSecurePassword();
  const randomEmail = `superuser@autopwn.local`;
  const username = `superuser`;

  const superUser = await createUser({
    email: randomEmail,
    password: randomPassword,
    username,
    role: 'superuser',
    requirePasswordChange: !isTestEnvironment, // Always require password change in production
  });

  logInfo('Initial Superuser Created:', {
    email: randomEmail,
    username: username,
    passwordLength: randomPassword.length,
    warning:
      'CRITICAL: Save these credentials! They will only be shown once during setup.',
  });

  return { ...superUser, plainPassword: randomPassword };
}

function generateSecurePassword(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function updateUserPassword(userId: string, newPassword: string) {
  // Hash the new password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  // Update password directly in the accounts table
  const [updatedAccount] = await db
    .update(accounts)
    .set({
      password: hashedPassword,
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, userId))
    .returning();

  if (!updatedAccount) {
    throw new Error('Failed to update password');
  }

  // Update user profile to remove password change requirement
  await db
    .update(userProfiles)
    .set({
      requirePasswordChange: false,
    })
    .where(eq(userProfiles.userId, userId));

  return updatedAccount;
}

export async function updateUserProfile(
  userId: string,
  data: {
    email?: string;
    username?: string;
  }
) {
  const [user] = await db
    .update(users)
    .set({
      email: data.email,
      name: data.username,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  // Also update user profile if username is provided
  if (data.username) {
    await db
      .update(userProfiles)
      .set({
        username: data.username,
      })
      .where(eq(userProfiles.userId, userId));
  }

  return user;
}

export async function getUsersByRole(role: 'superuser' | 'admin' | 'user') {
  return db.query.userProfiles.findMany({
    where: (userProfiles, { eq }) => eq(userProfiles.role, role),
    with: {
      user: true,
    },
    orderBy: (userProfiles, { desc }) => [desc(userProfiles.createdAt)],
  });
}

export async function getAllUsers() {
  return db.query.userProfiles.findMany({
    with: {
      user: true,
    },
    orderBy: (userProfiles, { desc }) => [desc(userProfiles.createdAt)],
  });
}

export async function createUserBySuperUser(data: {
  email: string;
  password: string;
  username: string;
  role: 'admin' | 'user';
}) {
  // Normal auth flow
  return createUser(data);
}

export async function deactivateUser(userId: string) {
  const [profile] = await db
    .update(userProfiles)
    .set({
      isActive: false,
    })
    .where(eq(userProfiles.userId, userId))
    .returning();

  return profile;
}

export async function activateUser(userId: string) {
  const [profile] = await db
    .update(userProfiles)
    .set({
      isActive: true,
    })
    .where(eq(userProfiles.userId, userId))
    .returning();

  return profile;
}
