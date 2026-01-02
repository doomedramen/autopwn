// Minimal test app for integration tests
// Focuses on dictionary and user management routes that need testing

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { promises as fs } from "fs";
import { createHash } from "crypto";
import "../config/env";
import { getTestDb } from "./helpers/test-helpers";
import { dictionaries, users, accounts } from "@/db/schema";

// Simple logger mock
const logger = {
  info: (msg: string, category: string, data?: any) => {
    if (process.env.DEBUG) {
      console.log(`[${category}] ${msg}`, data || "");
    }
  },
  error: (msg: string, category: string, error: Error | any, data?: any) => {
    console.error(`[${category}] ${msg}`, error, data || "");
  },
  warn: (msg: string, category: string, data?: any) => {
    console.warn(`[${category}] ${msg}`, data || "");
  },
};

const app = new Hono();

// Minimal auth middleware for testing
app.use("*", async (c, next) => {
  const testEmail = c.req.header("X-Test-Email");
  const testAuth = c.req.header("X-Test-Auth");

  if (testAuth !== "true" || !testEmail) {
    // Not authenticated - proceed anyway for some routes
    c.set("userId", testEmail || "anonymous");
    c.set("userRole", "user");
    return next();
  }

  const database = getTestDb();
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.email, testEmail as any))
    .limit(1);

  if (!user) {
    c.set("userId", testEmail);
    c.set("userRole", "user");
    return next();
  }

  c.set("user", user);
  c.set("userId", user.id);
  c.set("userRole", user.role);
  await next();
});

// Simple health check
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// Dictionary upload route (simplified for testing)
app.post("/api/dictionaries/upload", async (c) => {
  const userId = c.get("userId") as string;

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string | null;

    if (!file) {
      return c.json({ success: false, error: "No file provided" }, 400);
    }

    const dictionaryName = name || file.name.replace(/\.[^/.]+$/, "");
    const uploadDir = `/tmp/test-dictionaries/${userId}`;
    await fs.mkdir(uploadDir, { recursive: true });

    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);
    const fileName = Date.now() + "-" + file.name;
    const filePath = `${uploadDir}/${fileName}`;

    await fs.writeFile(filePath, buffer);

    const content = buffer.toString("utf-8");
    const wordCount = content.split("\n").filter((line) => line.trim()).length;

    const database = getTestDb();
    const [dictionaryRecord] = await database
      .insert(dictionaries)
      .values({
        name: dictionaryName,
        filename: fileName,
        type: "uploaded" as const,
        status: "ready" as const,
        size: file.size,
        wordCount,
        encoding: "utf-8",
        checksum: createHash("sha256").update(buffer).digest("hex"),
        filePath,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    logger.info("Dictionary created in test", "dictionaries", {
      dictionaryId: dictionaryRecord.id,
      userId,
      name: dictionaryName,
      wordCount,
    });

    return c.json({
      success: true,
      message: "Dictionary uploaded successfully",
      data: dictionaryRecord,
    });
  } catch (error) {
    logger.error("Dictionary upload error", "dictionaries", error as Error, {
      userId,
    });
    return c.json(
      {
        success: false,
        error: "Dictionary upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Get dictionary by ID
app.get("/api/dictionaries/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");

  const database = getTestDb();
  const [dictionary] = await database
    .select()
    .from(dictionaries)
    .where(eq(dictionaries.id, id))
    .limit(1);

  if (!dictionary) {
    return c.json({ success: false, error: "Dictionary not found" }, 404);
  }

  if (dictionary.userId !== userId) {
    return c.json({ success: false, error: "Access denied" }, 403);
  }

  return c.json({ success: true, data: dictionary });
});

// Delete dictionary
app.delete("/api/dictionaries/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");

  try {
    const database = getTestDb();
    const [dictionary] = await database
      .select()
      .from(dictionaries)
      .where(eq(dictionaries.id, id))
      .limit(1);

    if (!dictionary) {
      return c.json({ success: false, error: "Dictionary not found" }, 404);
    }

    if (dictionary.userId !== userId) {
      return c.json({ success: false, error: "Access denied" }, 403);
    }

    if (dictionary.filePath) {
      try {
        await fs.unlink(dictionary.filePath);
      } catch (fileError) {
        logger.warn("Failed to delete dictionary file", "dictionaries", {
          error:
            fileError instanceof Error ? fileError.message : "Unknown error",
        });
      }
    }

    await database.delete(dictionaries).where(eq(dictionaries.id, id));

    return c.json({
      success: true,
      message: "Dictionary deleted successfully",
    });
  } catch (error) {
    logger.error("Delete dictionary error", "dictionaries", error as Error);
    return c.json(
      { success: false, error: "Failed to delete dictionary" },
      500,
    );
  }
});

// User management routes for testing

// POST /api/users - Create new user
app.post(
  "/api/users",
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      name: z.string().optional(),
      password: z.string().min(8),
      role: z.enum(["user", "admin", "superuser"]).optional(),
    }),
  ),
  async (c) => {
    const userId = c.get("userId") as string;
    const userRole = c.get("userRole") as string;
    const userData = c.req.valid("json");

    try {
      // Check permissions
      if (userRole !== "superuser" && userRole !== "admin") {
        return c.json({ success: false, error: "Access denied" }, 403);
      }

      // Prevent admin from creating superuser
      if (userRole === "admin" && userData.role === "superuser") {
        return c.json({ success: false, error: "Access denied" }, 403);
      }

      // Check for duplicate email
      const database = getTestDb();
      const existingUser = await database
        .select()
        .from(users)
        .where(eq(users.email, userData.email))
        .limit(1);

      if (existingUser.length > 0) {
        return c.json({ success: false, error: "Email already exists" }, 409);
      }

      // Create user
      const newUserId = `test-${crypto.randomUUID()}`;
      const name = userData.name || userData.email.split("@")[0];
      const role = userData.role || "user";

      const [newUser] = await database
        .insert(users)
        .values({
          id: newUserId,
          email: userData.email,
          name,
          role,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Create account record
      await database.insert(accounts).values({
        id: crypto.randomUUID(),
        userId: newUserId,
        accountId: newUserId,
        providerId: "credential",
        provider: "credential",
        password: userData.password,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      logger.info("User created in test", "users", {
        userId: newUserId,
        email: userData.email,
        role,
      });

      return c.json({
        success: true,
        message: "User created successfully",
        data: newUser,
      });
    } catch (error) {
      logger.error("User creation error", "users", error as Error);
      return c.json(
        {
          success: false,
          error: "User creation failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

// PATCH /api/users/:id - Update user
app.patch(
  "/api/users/:id",
  zValidator(
    "json",
    z
      .object({
        email: z.string().email().optional(),
        name: z.string().optional(),
        role: z.enum(["user", "admin", "superuser"]).optional(),
      })
      .partial(),
  ),
  async (c) => {
    const userId = c.get("userId") as string;
    const userRole = c.get("userRole") as string;
    const targetUserId = c.req.param("id");
    const updateData = c.req.valid("json");

    try {
      const database = getTestDb();
      const [targetUser] = await database
        .select()
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (!targetUser) {
        return c.json({ success: false, error: "User not found" }, 404);
      }

      // Check permissions
      const isOwnProfile = userId === targetUserId;
      const canUpdateAny = userRole === "admin" || userRole === "superuser";

      if (!isOwnProfile && !canUpdateAny) {
        return c.json({ success: false, error: "Access denied" }, 403);
      }

      // Prevent admin from modifying superuser role
      if (
        userRole === "admin" &&
        (updateData.role === "superuser" ||
          (targetUser.role === "superuser" && updateData.role))
      ) {
        return c.json({ success: false, error: "Access denied" }, 403);
      }

      // Regular users can't change role
      if (isOwnProfile && !canUpdateAny && updateData.role !== undefined) {
        return c.json({ success: false, error: "Access denied" }, 403);
      }

      // Update user
      const [updatedUser] = await database
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUserId))
        .returning();

      logger.info("User updated in test", "users", {
        targetUserId,
        updatedBy: userId,
      });

      return c.json({
        success: true,
        message: "User updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      logger.error("User update error", "users", error as Error);
      return c.json(
        {
          success: false,
          error: "User update failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

// DELETE /api/users/:id - Delete user
app.delete("/api/users/:id", async (c) => {
  const userId = c.get("userId") as string;
  const userRole = c.get("userRole") as string;
  const targetUserId = c.req.param("id");

  try {
    const database = getTestDb();
    const [targetUser] = await database
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    // Check permissions
    if (userRole !== "superuser") {
      return c.json({ success: false, error: "Access denied" }, 403);
    }

    // Prevent deleting last superuser
    if (targetUser.role === "superuser") {
      const superuserCount = await database
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.role, "superuser"));

      if (superuserCount[0].count <= 1) {
        return c.json(
          { success: false, error: "Cannot delete last superuser" },
          403,
        );
      }
    }

    // Delete user and cascade delete will handle accounts
    await database.delete(users).where(eq(users.id, targetUserId));

    logger.info("User deleted in test", "users", {
      targetUserId,
      deletedBy: userId,
    });

    return c.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    logger.error("User deletion error", "users", error as Error);
    return c.json(
      {
        success: false,
        error: "User deletion failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// GET /api/users/:id - Get user by ID
app.get("/api/users/:id", async (c) => {
  const userId = c.get("userId") as string;
  const userRole = c.get("userRole") as string;
  const targetUserId = c.req.param("id");

  try {
    const database = getTestDb();
    const [targetUser] = await database
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    // Check permissions
    const isOwnProfile = userId === targetUserId;
    const canViewAny = userRole === "admin" || userRole === "superuser";

    if (!isOwnProfile && !canViewAny) {
      return c.json({ success: false, error: "Access denied" }, 403);
    }

    return c.json({ success: true, data: targetUser });
  } catch (error) {
    logger.error("User fetch error", "users", error as Error);
    return c.json(
      {
        success: false,
        error: "User fetch failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

export { app };
