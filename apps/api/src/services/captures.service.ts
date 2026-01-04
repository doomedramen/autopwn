import { db } from "../db";
import { captures, selectCaptureSchema } from "../db/schema";
import { eq, and, desc, like, sql } from "drizzle-orm";
import * as fs from "fs/promises";
import path from "path";
import { logger } from "../lib/logger";
import { auditService } from "./audit.service";

export interface CreateCaptureOptions {
  filename: string;
  userId: string;
  fileSize: number;
  filePath: string;
  metadata?: any;
}

export interface CaptureFilters {
  status?: "pending" | "processing" | "completed" | "failed";
  userId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface CaptureUpdateOptions {
  status?: "pending" | "processing" | "completed" | "failed";
  processedAt?: Date;
  networkCount?: number;
  errorMessage?: string | null;
  metadata?: any;
}

export class CapturesService {
  static async create(options: CreateCaptureOptions) {
    const { filename, userId, fileSize, filePath, metadata } = options;

    const [capture] = await db
      .insert(captures)
      .values({
        filename,
        userId,
        status: "pending",
        fileSize,
        filePath,
        networkCount: 0,
        uploadedAt: new Date(),
        metadata: metadata || null,
      })
      .returning();

    return capture;
  }

  static async getById(id: string) {
    const capture = await db.query.captures.findFirst({
      where: eq(captures.id, id),
    });

    return capture;
  }

  static async list(filters: CaptureFilters) {
    const { status, userId, page = 1, limit = 20, search } = filters;

    const conditions: any[] = [];

    if (userId) {
      conditions.push(eq(captures.userId, userId));
    }

    if (status) {
      conditions.push(eq(captures.status, status));
    }

    if (search) {
      conditions.push(like(captures.filename, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(captures)
      .where(whereClause);

    const offset = (page - 1) * limit;

    const capturesList = await db.query.captures.findMany({
      where: whereClause,
      orderBy: [desc(captures.uploadedAt)],
      limit,
      offset,
    });

    const totalPages = Math.ceil(count / limit);

    return {
      data: capturesList,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  static async update(id: string, updates: CaptureUpdateOptions) {
    const [capture] = await db
      .update(captures)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(captures.id, id))
      .returning();

    return capture;
  }

  static async delete(
    id: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const capture = await this.getById(id);

    if (!capture) {
      return null;
    }

    const [deleted] = await db
      .delete(captures)
      .where(eq(captures.id, id))
      .returning();

    await auditService.logEvent({
      userId,
      action: "capture.delete",
      entityType: "capture",
      entityId: id,
      oldValue: {
        filename: capture.filename,
        filePath: capture.filePath,
      },
      newValue: null,
      ipAddress,
      userAgent,
      success: true,
    });

    if (capture.filePath) {
      try {
        const captureDir = path.dirname(capture.filePath);
        await fs.rm(captureDir, { recursive: true, force: true });

        logger.info("Capture files deleted from disk", "captures-service", {
          captureId: id,
          filePath: capture.filePath,
          directory: captureDir,
        });
      } catch (error) {
        logger.error(
          "Failed to delete capture files from disk",
          "captures-service",
          {
            captureId: id,
            filePath: capture.filePath,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        );
      }
    }

    return deleted;
  }

  static async updateStatus(
    id: string,
    status: "processing" | "completed" | "failed",
    errorMessage?: string,
  ) {
    const updateData: CaptureUpdateOptions = {
      status,
      updatedAt: new Date(),
    };

    if (status === "processing") {
      updateData.processedAt = new Date();
    } else if (status === "completed") {
      updateData.processedAt = new Date();
    } else if (status === "failed" && errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    return this.update(id, updateData);
  }

  static async updateNetworkCount(id: string, networkCount: number) {
    return this.update(id, {
      networkCount,
      status: "completed",
      processedAt: new Date(),
    });
  }

  static async userOwnsCapture(
    userId: string,
    captureId: string,
  ): Promise<boolean> {
    const capture = await this.getById(captureId);
    return capture?.userId === userId;
  }

  static async listUserCaptures(
    userId: string,
    filters: Omit<CaptureFilters, "userId">,
  ) {
    return this.list({ ...filters, userId });
  }
}
