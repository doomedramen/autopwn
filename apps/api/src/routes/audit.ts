import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { auditService } from "../services/audit.service";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middleware/auth";

const auditRoutes = new Hono();

auditRoutes.use("*", requireAdmin);

const auditLogFilterSchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  success: z.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

/**
 * GET /api/v1/audit/logs
 * Get audit logs with filtering (admin only)
 */
auditRoutes.get(
  "/logs",
  zValidator("query", auditLogFilterSchema),
  async (c) => {
    try {
      const filters = c.req.valid("query");

      logger.info("Fetching audit logs", "audit-api", {
        filters,
      });

      const result = await auditService.query({
        userId: filters.userId,
        action: filters.action,
        entityType: filters.entityType,
        entityId: filters.entityId,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        success: filters.success,
        page: filters.page,
        limit: filters.limit,
      });

      return c.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error("Failed to fetch audit logs", "audit-api", {
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return c.json(
        {
          success: false,
          error: "Failed to fetch audit logs",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

/**
 * GET /api/v1/audit/logs/:id
 * Get a single audit log by ID (admin only)
 */
auditRoutes.get("/logs/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const result = await auditService.query({ page: 1, limit: 1000 });
    const log = result.data.find((l) => l.id === id);

    if (!log) {
      return c.json(
        {
          success: false,
          error: "Audit log not found",
          message: `Audit log '${id}' does not exist`,
        },
        404,
      );
    }

    return c.json({
      success: true,
      data: log,
    });
  } catch (error) {
    logger.error(
      `Failed to fetch audit log '${c.req.param("id")}'`,
      "audit-api",
      {
        error: error instanceof Error ? error : new Error(String(error)),
      },
    );

    return c.json(
      {
        success: false,
        error: "Failed to fetch audit log",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * GET /api/v1/audit/user/:userId
 * Get audit logs for a specific user (admin only)
 */
auditRoutes.get(
  "/user/:userId",
  zValidator("query", auditLogFilterSchema.partial()),
  async (c) => {
    try {
      const userId = c.req.param("userId");
      const filters = c.req.valid("query");

      logger.info(`Fetching audit logs for user '${userId}'`, "audit-api", {
        userId,
        filters,
      });

      const result = await auditService.getByUserId(userId, {
        action: filters.action,
        entityType: filters.entityType,
        entityId: filters.entityId,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        success: filters.success,
        page: filters.page,
        limit: filters.limit,
      });

      return c.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error(
        `Failed to fetch audit logs for user '${c.req.param("userId")}'`,
        "audit-api",
        {
          error: error instanceof Error ? error : new Error(String(error)),
        },
      );

      return c.json(
        {
          success: false,
          error: "Failed to fetch audit logs",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

/**
 * GET /api/v1/audit/entity/:entityType/:entityId
 * Get audit logs for a specific entity (admin only)
 */
auditRoutes.get(
  "/entity/:entityType/:entityId",
  zValidator("query", auditLogFilterSchema.partial()),
  async (c) => {
    try {
      const entityType = c.req.param("entityType");
      const entityId = c.req.param("entityId");
      const filters = c.req.valid("query");

      logger.info(
        `Fetching audit logs for entity '${entityType}:${entityId}'`,
        "audit-api",
        {
          entityType,
          entityId,
          filters,
        },
      );

      const result = await auditService.getByEntity(entityType, entityId, {
        userId: filters.userId,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        success: filters.success,
        page: filters.page,
        limit: filters.limit,
      });

      return c.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error("Failed to fetch audit logs for entity", "audit-api", {
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return c.json(
        {
          success: false,
          error: "Failed to fetch audit logs",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

/**
 * GET /api/v1/audit/statistics
 * Get audit log statistics (admin only)
 */
auditRoutes.get("/statistics", async (c) => {
  try {
    logger.info("Fetching audit statistics", "audit-api");

    const stats = await auditService.getStatistics();

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Failed to fetch audit statistics", "audit-api", {
      error: error instanceof Error ? error : new Error(String(error)),
    });

    return c.json(
      {
        success: false,
        error: "Failed to fetch audit statistics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * GET /api/v1/audit/export
 * Export audit logs to CSV (admin only)
 */
auditRoutes.get(
  "/export",
  zValidator("query", auditLogFilterSchema),
  async (c) => {
    try {
      const filters = c.req.valid("query");

      logger.info("Exporting audit logs", "audit-api", {
        filters,
      });

      const csv = await auditService.exportToCSV({
        userId: filters.userId,
        action: filters.action,
        entityType: filters.entityType,
        entityId: filters.entityId,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        success: filters.success,
        page: 1,
        limit: 10000, // Export all matching records
      });

      if (!csv) {
        return c.json({
          success: true,
          message: "No audit logs to export",
        });
      }

      c.header("Content-Type", "text/csv");
      c.header(
        "Content-Disposition",
        `attachment; filename="audit-logs-${Date.now()}.csv"`,
      );

      return c.text(csv);
    } catch (error) {
      logger.error("Failed to export audit logs", "audit-api", {
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return c.json(
        {
          success: false,
          error: "Failed to export audit logs",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

/**
 * GET /api/v1/audit/export/json
 * Export audit logs to JSON (admin only)
 */
auditRoutes.get(
  "/export/json",
  zValidator("query", auditLogFilterSchema),
  async (c) => {
    try {
      const filters = c.req.valid("query");

      logger.info("Exporting audit logs to JSON", "audit-api", {
        filters,
      });

      const json = await auditService.exportToJSON({
        userId: filters.userId,
        action: filters.action,
        entityType: filters.entityType,
        entityId: filters.entityId,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        success: filters.success,
        page: 1,
        limit: 10000, // Export all matching records
      });

      if (!json) {
        return c.json({
          success: true,
          message: "No audit logs to export",
        });
      }

      c.header("Content-Type", "application/json");
      c.header(
        "Content-Disposition",
        `attachment; filename="audit-logs-${Date.now()}.json"`,
      );

      return c.text(json);
    } catch (error) {
      logger.error("Failed to export audit logs to JSON", "audit-api", {
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return c.json(
        {
          success: false,
          error: "Failed to export audit logs",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

/**
 * DELETE /api/v1/audit/cleanup
 * Delete old audit logs (admin only)
 */
auditRoutes.delete(
  "/cleanup",
  zValidator(
    "json",
    z.object({
      olderThanDays: z.coerce.number().min(1).max(365).default(90),
    }),
  ),
  async (c) => {
    try {
      const userId = c.get("userId");
      const { olderThanDays } = c.req.valid("json");

      const olderThan = new Date(
        Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
      );

      logger.info("Cleaning up old audit logs", "audit-api", {
        userId,
        olderThanDays,
        cutoffDate: olderThan.toISOString(),
      });

      const deletedCount = await auditService.deleteOldLogs(olderThan);

      return c.json({
        success: true,
        message: "Old audit logs deleted successfully",
        data: {
          deletedCount,
          olderThanDays,
        },
      });
    } catch (error) {
      logger.error("Failed to cleanup audit logs", "audit-api", {
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return c.json(
        {
          success: false,
          error: "Failed to cleanup audit logs",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

export { auditRoutes };
