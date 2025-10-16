import { NextResponse } from 'next/server';
import { createSuperUserIfNotExists } from '@/lib/auth';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Initialize the application by creating a superuser if none exists
 * This should only be called during initial setup
 */
export async function POST() {
  try {
    // Check if any users already exist
    const existingUsers = await db.query.users.findMany();
    if (existingUsers.length > 0) {
      return NextResponse.json(
        {
          error: 'Application already initialized',
          message: 'Users already exist in the system',
        },
        { status: 400 }
      );
    }

    // Create the initial superuser
    const superUser = await createSuperUserIfNotExists();

    if (!superUser) {
      return NextResponse.json(
        {
          error: 'Failed to create superuser',
          message: 'Unable to create initial superuser account',
        },
        { status: 500 }
      );
    }

    // Handle both cases: newly created user (with user and profile) or existing superuser (just profile)
    const userId = 'user' in superUser ? superUser.user.id : superUser.userId;
    const username =
      'user' in superUser ? superUser.profile.username : superUser.username;
    const email =
      'user' in superUser
        ? superUser.user.email
        : 'Email not available for existing user';
    const password =
      'plainPassword' in superUser
        ? superUser.plainPassword
        : 'Password not available for existing user';
    const role = 'user' in superUser ? superUser.profile.role : superUser.role;
    const requirePasswordChange =
      'user' in superUser
        ? superUser.profile.requirePasswordChange
        : superUser.requirePasswordChange;

    return NextResponse.json({
      success: true,
      message: 'Application initialized successfully',
      data: {
        userId,
        username,
        email,
        password, // Only available for newly created users
        role,
        requirePasswordChange,
      },
    });
  } catch (error) {
    logError('Initialization error:', error);
    return NextResponse.json(
      {
        error: 'Initialization failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Check if the application has been initialized
 */
export async function GET() {
  try {
    const superUserProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.role, 'superuser'),
    });

    const isInitialized = !!superUserProfile;

    return NextResponse.json({
      initialized: isInitialized,
      hasSuperUser: isInitialized,
    });
  } catch (error) {
    logError('Init check error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check initialization status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
