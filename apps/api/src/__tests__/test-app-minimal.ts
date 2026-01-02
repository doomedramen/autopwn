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
    c.set("userId", null);
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

// GET /api/dictionaries/:id/statistics - Get dictionary statistics
app.get("/api/dictionaries/:id/statistics", async (c) => {
  const userId = c.get("userId") as string;
  const dictionaryId = c.req.param("id");

  try {
    const database = getTestDb();
    const [dictionary] = await database
      .select()
      .from(dictionaries)
      .where(eq(dictionaries.id, dictionaryId))
      .limit(1);

    if (!dictionary) {
      return c.json({ success: false, error: "Dictionary not found" }, 404);
    }

    if (dictionary.userId !== userId) {
      return c.json({ success: false, error: "Access denied" }, 403);
    }

    // Calculate statistics
    let content = "";
    if (dictionary.filePath) {
      try {
        content = await fs.readFile(dictionary.filePath, "utf-8");
      } catch (e) {
        // File might not exist, continue with empty content
      }
    }

    const lines = content.split("\n").filter((line) => line.trim());
    const wordCount = lines.length;
    const uniqueWords = new Set(lines).size;
    const averageLength =
      lines.length > 0
        ? lines.reduce((sum, word) => sum + word.length, 0) / lines.length
        : 0;

    const frequency = lines.reduce((acc: any, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

    const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
    const entropy =
      sorted.reduce((sum: number, [, count]: any) => {
        const p = count / lines.length;
        return sum - p * Math.log2(p);
      }, 0) / Math.log2(uniqueWords) || 0;

    const topWords = sorted.slice(0, 10).map(([word, count]: any) => ({
      word,
      count,
    }));

    const lengthDistribution = lines.reduce(
      (acc: any, word) => {
        const len = word.length;
        const bucket = len <= 4 ? 4 : len <= 8 ? 8 : len <= 12 ? 12 : 16;
        acc[bucket] = (acc[bucket] || 0) + 1;
        return acc;
      },
      { 4: 0, 8: 0, 12: 0, 16: 0 },
    );

    return c.json({
      success: true,
      data: {
        basic: {
          wordCount,
          uniqueWords,
          averageLength,
        },
        frequency: {
          entropy,
          topWords,
          lengthDistribution: Object.entries(lengthDistribution).map(
            ([length, count]: any) => ({ length: Number(length), count }),
          ),
        },
        size: {
          bytes: dictionary.size,
        },
      },
    });
  } catch (error) {
    logger.error("Dictionary statistics error", "dictionaries", error as Error);
    return c.json(
      {
        success: false,
        error: "Failed to get statistics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// POST /api/dictionaries/merge - Merge multiple dictionaries
app.post(
  "/api/dictionaries/merge",
  zValidator(
    "json",
    z.object({
      name: z.string(),
      dictionaryIds: z.array(z.string()),
      removeDuplicates: z.boolean().optional(),
      validationRules: z
        .object({
          minLength: z.number().optional(),
          maxLength: z.number().optional(),
          excludePatterns: z.array(z.string()).optional(),
        })
        .optional(),
    }),
  ),
  async (c) => {
    const userId = c.get("userId") as string;
    const { name, dictionaryIds, removeDuplicates, validationRules } =
      c.req.valid("json");

    try {
      // Custom validation to return better error messages
      if (dictionaryIds.length < 2) {
        return c.json(
          {
            success: false,
            error: "At least 2 dictionaries are required for merging",
          },
          400,
        );
      }

      if (dictionaryIds.length > 10) {
        return c.json(
          {
            success: false,
            error: "Cannot merge more than 10 dictionaries",
          },
          400,
        );
      }

      const database = getTestDb();

      // Get source dictionaries
      const sourceDicts = await database
        .select()
        .from(dictionaries)
        .where(eq(dictionaries.userId, userId));

      const matchedDicts = sourceDicts.filter((d) =>
        dictionaryIds.includes(d.id),
      );

      if (matchedDicts.length !== dictionaryIds.length) {
        return c.json({ success: false, error: "Dictionary not found" }, 404);
      }

      // Read and merge content
      let words: string[] = [];
      for (const dict of matchedDicts) {
        if (dict.filePath) {
          try {
            const content = await fs.readFile(dict.filePath, "utf-8");
            words.push(...content.split("\n").filter((line) => line.trim()));
          } catch (e) {
            logger.warn(
              `Failed to read dictionary file: ${dict.filePath}`,
              "dictionaries",
            );
          }
        }
      }

      // Apply validation rules
      if (validationRules) {
        const { minLength, maxLength, excludePatterns } = validationRules;
        words = words.filter((word) => {
          if (minLength && word.length < minLength) return false;
          if (maxLength && word.length > maxLength) return false;
          if (excludePatterns) {
            for (const pattern of excludePatterns) {
              if (new RegExp(pattern).test(word)) return false;
            }
          }
          return true;
        });
      }

      const originalCount = words.length;

      // Remove duplicates if requested
      let removedDuplicates = 0;
      if (removeDuplicates) {
        const unique = new Set(words);
        removedDuplicates = words.length - unique.size;
        words = Array.from(unique);
      }

      const wordCount = words.length;
      const content = words.join("\n");
      const buffer = Buffer.from(content);

      // Create merged dictionary
      const mergedId = crypto.randomUUID();
      const uploadDir = `/tmp/test-dictionaries/${userId}`;
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${name.replace(/\s+/g, "-").toLowerCase()}.txt`;
      const filePath = `${uploadDir}/${fileName}`;
      await fs.writeFile(filePath, buffer);

      const [mergedDict] = await database
        .insert(dictionaries)
        .values({
          id: mergedId,
          name,
          filename: fileName,
          type: "generated",
          status: "ready",
          size: buffer.length,
          wordCount,
          encoding: "utf-8",
          checksum: createHash("sha256").update(buffer).digest("hex"),
          filePath,
          userId,
          processingConfig: {
            merge: {
              sourceDictionaries: dictionaryIds,
              removeDuplicates,
              removedDuplicates,
              mergedAt: new Date().toISOString(),
              validationRules,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return c.json({
        success: true,
        data: { ...mergedDict, wordCount },
      });
    } catch (error) {
      logger.error("Dictionary merge error", "dictionaries", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to merge dictionaries",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

// POST /api/dictionaries/:id/validate - Validate dictionary
app.post("/api/dictionaries/:id/validate", async (c) => {
  const userId = c.get("userId") as string;
  const dictionaryId = c.req.param("id");

  try {
    const database = getTestDb();
    const [sourceDict] = await database
      .select()
      .from(dictionaries)
      .where(eq(dictionaries.id, dictionaryId))
      .limit(1);

    if (!sourceDict) {
      return c.json({ success: false, error: "Dictionary not found" }, 404);
    }

    if (sourceDict.userId !== userId) {
      return c.json({ success: false, error: "Access denied" }, 403);
    }

    // Read and validate content
    let content = "";
    if (sourceDict.filePath) {
      content = await fs.readFile(sourceDict.filePath, "utf-8");
    }

    const lines = content.split("\n").filter((line) => line.trim());
    const words = lines;

    const validChars = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]+$/;
    const validWords: string[] = [];
    const invalidWords: string[] = [];
    const duplicates: Set<string> = new Set();

    for (const word of words) {
      if (duplicates.has(word)) {
        continue;
      }
      if (validChars.test(word) && word.length >= 1 && word.length <= 64) {
        validWords.push(word);
      } else {
        invalidWords.push(word);
      }
      duplicates.add(word);
    }

    const duplicateWordCount = words.length - duplicates.size;
    const validWordCount = validWords.length;
    const invalidWordCount = invalidWords.length;
    const originalWords = words.length;

    const validContent = validWords.join("\n");
    const validBuffer = Buffer.from(validContent);

    // Create validated dictionary
    const validatedId = crypto.randomUUID();
    const validatedName = `${sourceDict.name}-validated`;
    const uploadDir = `/tmp/test-dictionaries/${userId}`;
    const fileName = `${validatedName.replace(/\s+/g, "-").toLowerCase()}.txt`;
    const filePath = `${uploadDir}/${fileName}`;
    await fs.writeFile(filePath, validBuffer);

    const [validatedDict] = await database
      .insert(dictionaries)
      .values({
        id: validatedId,
        name: validatedName,
        filename: fileName,
        type: "generated",
        status: "ready",
        size: validBuffer.length,
        wordCount: validWordCount,
        encoding: "utf-8",
        checksum: createHash("sha256").update(validBuffer).digest("hex"),
        filePath,
        userId,
        processingConfig: {
          validation: {
            sourceDictionaryId: dictionaryId,
            validWordCount,
            invalidWordCount,
            duplicateWordCount,
            validatedAt: new Date().toISOString(),
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return c.json({
      success: true,
      data: validatedDict,
      stats: {
        originalWords,
        validWords: validWordCount,
      },
    });
  } catch (error) {
    logger.error("Dictionary validation error", "dictionaries", error as Error);
    return c.json(
      {
        success: false,
        error: "Failed to validate dictionary",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

export { app };
