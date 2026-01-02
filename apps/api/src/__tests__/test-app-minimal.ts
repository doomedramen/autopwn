// Minimal test app for integration tests
// Focuses on dictionary and user management routes that need testing

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import "../config/env";

// Import test database helpers to use test-specific database connection
const { getTestDb } = require("./helpers/test-helpers");

const dictionaries = require("@/db/schema").dictionaries;
const users = require("@/db/schema").users;

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
    return next();
  }

  const database = getDb();
  const user = await database.query.users.findFirst({
    where: eq(users.email, testEmail as any),
  });

  c.set("user", user);
  c.set("userId", user?.id || testEmail);
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
    await require("fs/promises").mkdir(uploadDir, { recursive: true });

    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);
    const fileName = Date.now() + "-" + file.name;
    const filePath = `${uploadDir}/${fileName}`;

    await require("fs/promises").writeFile(filePath, buffer);

    const content = buffer.toString("utf-8");
    const wordCount = content.split("\n").filter((line) => line.trim()).length;

    const database = getDb();
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
        checksum: require("crypto")
          .createHash("sha256")
          .update(buffer)
          .digest("hex"),
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

  const database = getDb();
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
    const database = getDb();
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
        await require("fs/promises").unlink(dictionary.filePath);
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

export { app };
