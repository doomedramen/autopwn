import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile data including custom fields
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, session.user.id),
    });

    // Combine basic user data with profile data
    const userData = {
      ...session.user,
      requirePasswordChange: profile?.requirePasswordChange || false,
      role: profile?.role || "user",
      isActive: profile?.isActive || true,
      isEmailVerified: profile?.isEmailVerified || false,
      username: profile?.username || session.user.name,
    };

    return NextResponse.json({
      user: userData,
      session: session
    });
  } catch (error) {
    console.error("Error getting user session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}