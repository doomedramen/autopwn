import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/db";
import { jobs, selectJobSchema } from "@/db/schema";
import { eq, desc, and, isNull, inArray, sql } from "drizzle-orm";
import {
  createNotFoundError,
  createValidationError,
} from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import { auditService } from "@/services/audit.service";
import { getUserId } from "@/lib/auth";
import { getHashcatJob, removeHashcatJob } from "@/lib/queue";

const jobManagementRoutes = new Hono();

jobManagementRoutes.use("*", async (c, next) => {
  const userId = c.get("userId");
  c.set("userId", userId);
  await next();
});

/**
 * GET /api/jobs - Get all jobs with filtering and pagination
 */
jobManagementRoutes.get("/", async (c) => {
  try {
    const userId = c.get("userId");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "20");
    const status = c.req.query("status") as string;
    const priority = c.req.query("priority") as string;
    const tags = c.req.query("tags") as string;
    const networkId = c.req.query("networkId") as string;
    const dictionaryId = c.req.query("dictionaryId") as string;
    const search = c.req.query("search") as string;
    const sortBy = (c.req.query("sortBy") as string) || "createdAt";
    const sortOrder = (c.req.query("sortOrder") as string) || "desc";
    const offset = (page - 1) * limit;

    let whereConditions = [eq(jobs.userId, userId)];

    if (status) {
      whereConditions.push(eq(jobs.status, status));
    }

    if (priority) {
      whereConditions.push(eq(jobs.priority, priority));
    }

    if (tags && tags.length > 0) {
      const tagList = tags.split(",");
      whereConditions.push(
        sql`jsonb_array_contains(${jobs.tags}, ?${tagList.map(() => "?").join(",")})`,
      );
    }

    if (networkId) {
      whereConditions.push(eq(jobs.networkId, networkId));
    }

    if (dictionaryId) {
      whereConditions.push(eq(jobs.dictionaryId, dictionaryId));
    }

    if (search) {
      const searchTerm = `%${search}%`;
      whereConditions.push(sql`name ILIKE ?${searchTerm}`);
    }

    const allJobs = await db.query.jobs.findMany({
      where:
        whereConditions.length > 1
          ? and(...whereConditions)
          : whereConditions[0],
      orderBy: sortOrder === "asc" ? [asc(jobs[sortBy])] : [desc(jobs[sortBy])],
      with: {
        network: true,
        dictionary: true,
      },
      limit,
      offset,
    });

    const totalCount = await db.query.jobs.findMany({
      where:
        whereConditions.length > 1
          ? and(...whereConditions)
          : whereConditions[0],
    });

    const totalPages = Math.ceil(totalCount.length / limit);

    return c.json({
      success: true,
      data: allJobs,
      meta: {
        page,
        limit,
        total: totalCount.length,
        totalPages,
      },
    });
  } catch (error) {
    logger.error("get_jobs_error", "jobs", {
      error: error.message,
      userId: c.get("userId"),
    });

    return c.json(
      {
        success: false,
        error: "Failed to get jobs",
        message: error.message,
      },
      500,
    );
  }
});

export { jobManagementRoutes };
