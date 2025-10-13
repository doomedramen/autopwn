import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Get current user information
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user and profile data
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, session.user.id),
    });

    if (!user || !profile) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Return combined user data
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      username: profile.username,
      role: profile.role,
      isActive: profile.isActive,
      isEmailVerified: profile.isEmailVerified,
      requirePasswordChange: profile.requirePasswordChange,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      {
        error: "Failed to get user information",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}