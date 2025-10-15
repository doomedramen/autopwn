import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, userProfiles } from '@/lib/db/schema';
import { eq, and, or, ilike } from 'drizzle-orm';
import { createUserBySuperUser, getAllUsers } from '@/lib/auth';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Schema for user creation
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3),
  role: z.enum(['admin', 'user']),
});

// Schema for user update
const updateUserSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email().optional(),
  username: z.string().min(3).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Get all users (admin/superuser only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Normal auth flow
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, session.user.id),
      with: {
        user: true,
      },
    });

    if (
      !currentUser ||
      (currentUser.role !== 'admin' && currentUser.role !== 'superuser')
    ) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    let allUsers;

    if (search || role) {
      // Build query conditions
      const conditions = [];

      if (search) {
        conditions.push(
          or(
            ilike(userProfiles.username, `%${search}%`),
            ilike(users.email, `%${search}%`)
          )
        );
      }

      if (role) {
        conditions.push(
          eq(userProfiles.role, role as 'admin' | 'user' | 'superuser')
        );
      }

      // Add join condition to userProfiles and users
      const searchConditions = [
        eq(userProfiles.userId, users.id),
        ...conditions,
      ];

      allUsers = await db.query.userProfiles.findMany({
        where: and(...searchConditions),
        with: {
          user: true,
        },
        orderBy: (userProfiles, { desc }) => [desc(userProfiles.createdAt)],
      });
    } else {
      allUsers = await getAllUsers();
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = allUsers.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: paginatedUsers,
      pagination: {
        page,
        limit,
        total: allUsers.length,
        pages: Math.ceil(allUsers.length / limit),
      },
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Create a new user (admin/superuser only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Normal auth flow
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, session.user.id),
      with: {
        user: true,
      },
    });

    if (
      !currentUser ||
      (currentUser.role !== 'admin' && currentUser.role !== 'superuser')
    ) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Check if email or username already exists
    const existingUser = await db.query.users.findFirst({
      where: or(
        eq(users.email, validatedData.email),
        eq(users.name, validatedData.username)
      ),
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: 'User already exists',
          message:
            existingUser.email === validatedData.email
              ? 'Email already registered'
              : 'Username already taken',
        },
        { status: 400 }
      );
    }

    // Only superuser can create admin users
    if (validatedData.role === 'admin' && currentUser.role !== 'superuser') {
      return NextResponse.json(
        { error: 'Only superuser can create admin users' },
        { status: 403 }
      );
    }

    const newUser = await createUserBySuperUser(validatedData);

    return NextResponse.json({
      success: true,
      data: newUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('User creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create user',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Update user status (admin/superuser only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Normal auth flow
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, session.user.id),
      with: {
        user: true,
      },
    });

    if (
      !currentUser ||
      (currentUser.role !== 'admin' && currentUser.role !== 'superuser')
    ) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Get user to update
    const targetUser = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, validatedData.userId),
      with: {
        user: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Cannot modify superuser unless you are the superuser
    if (
      targetUser.role === 'superuser' &&
      currentUser.userId !== targetUser.userId
    ) {
      return NextResponse.json(
        { error: 'Cannot modify superuser account' },
        { status: 403 }
      );
    }

    // Cannot deactivate yourself
    if (
      validatedData.userId === currentUser.userId &&
      validatedData.isActive === false
    ) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await db
      .update(users)
      .set({
        ...(validatedData.email && { email: validatedData.email }),
        ...(validatedData.username && { username: validatedData.username }),
        ...(validatedData.isActive !== undefined && {
          isActive: validatedData.isActive,
        }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, validatedData.userId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedUser[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('User update error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update user',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
