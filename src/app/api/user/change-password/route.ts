import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accounts, userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateUserPassword, updateUserProfile } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";

// Schema for password change
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Schema for profile update
const updateProfileSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
});

/**
 * Change user password or update profile
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { type } = body;

    if (type === "password") {
      const validatedData = changePasswordSchema.parse(body);

      // Get current user's account to verify current password
      const currentAccount = await db.query.accounts.findFirst({
        where: eq(accounts.userId, session.user.id),
        with: {
          user: true,
        },
      });

      if (!currentAccount) {
        return NextResponse.json(
          { error: "User account not found" },
          { status: 404 }
        );
      }

      // Verify current password using better-auth
      // We'll use the internal validation method to check if current password matches
      try {
        // Try to sign in with current password to verify it's correct
        const signInResult = await auth.api.signInEmail({
          body: {
            email: currentAccount.user.email,
            password: validatedData.currentPassword,
          },
        });

        if (!signInResult?.user) {
          return NextResponse.json(
            { error: "Current password is incorrect" },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error("Password verification error:", error);
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      // Update password
      await updateUserPassword(
        session.user.id,
        validatedData.newPassword
      );

      // Get updated profile to check password change requirement
      const updatedProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, session.user.id),
      });

      return NextResponse.json({
        success: true,
        message: "Password updated successfully",
        data: {
          requirePasswordChange: updatedProfile?.requirePasswordChange || false,
        },
      });
    } else if (type === "profile") {
      const validatedData = updateProfileSchema.parse(body);

      // Check if email already exists (excluding current user)
      const existingUser = await db.query.users.findFirst({
        where: (users, { and, eq, ne }) =>
          and(
            eq(users.email, validatedData.email),
            ne(users.id, session.user.id)
          ),
      });

      if (existingUser) {
        return NextResponse.json(
          {
            error: "Email already registered",
            message: "Email already registered",
          },
          { status: 400 }
        );
      }

      // Check if username already exists in profiles (excluding current user)
      const existingProfile = await db.query.userProfiles.findFirst({
        where: (userProfiles, { and, eq, ne }) =>
          and(
            eq(userProfiles.username, validatedData.username),
            ne(userProfiles.userId, session.user.id)
          ),
      });

      if (existingProfile) {
        return NextResponse.json(
          {
            error: "Username already taken",
            message: "Username already taken",
          },
          { status: 400 }
        );
      }

      // Update profile
      const updatedUser = await updateUserProfile(session.user.id, validatedData);

      return NextResponse.json({
        success: true,
        message: "Profile updated successfully",
        data: updatedUser,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid request type" },
        { status: 400 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error("User update error:", error);
    return NextResponse.json(
      {
        error: "Failed to update user",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}