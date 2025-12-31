import { db } from "../db/index";
import { auditLogs } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface AuditEventOptions {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
  metadata?: any;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  page?: number;
  limit?: number;
}

class AuditService {
  /**
   * Log a security event to the audit log
   */
  async logEvent(options: AuditEventOptions): Promise<void> {
    try {
      const {
        userId,
        action,
        entityType,
        entityId,
        oldValue,
        newValue,
        changes,
        ipAddress,
        userAgent,
        success = true,
        errorMessage,
        metadata,
      } = options;

      await db.insert(auditLogs).values({
        userId,
        action,
        entityType,
        entityId,
        oldValue,
        newValue,
        changes,
        ipAddress,
        userAgent,
        success,
        errorMessage,
        metadata,
        createdAt: new Date(),
      });

      logger.info("Audit event logged", "audit-service", {
        userId,
        action,
        entityType,
        entityId,
        success,
      });
    } catch (error) {
      logger.error("Failed to log audit event", "audit-service", {
        error: error instanceof Error ? error : new Error(String(error)),
        options,
      });
    }
  }

  /**
   * Query audit logs with filtering and pagination
   */
  async query(filters: AuditLogFilters) {
    try {
      const {
        userId,
        action,
        entityType,
        entityId,
        startDate,
        endDate,
        success,
        page = 1,
        limit = 50,
      } = filters;

      const conditions: any[] = [];

      if (userId) {
        conditions.push(eq(auditLogs.userId, userId));
      }

      if (action) {
        conditions.push(eq(auditLogs.action, action));
      }

      if (entityType) {
        conditions.push(eq(auditLogs.entityType, entityType));
      }

      if (entityId) {
        conditions.push(eq(auditLogs.entityId, entityId));
      }

      if (success !== undefined) {
        conditions.push(eq(auditLogs.success, success));
      }

      if (startDate) {
        conditions.push(sql`${auditLogs.createdAt} >= ${startDate}`);
      }

      if (endDate) {
        conditions.push(sql`${auditLogs.createdAt} <= ${endDate}`);
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [{ count }] = await db
        .select({ count: () => sql`count(*)`.as("count") })
        .from(auditLogs)
        .where(whereClause);

      const offset = (page - 1) * limit;

      const logs = await db.query.auditLogs.findMany({
        where: whereClause,
        orderBy: [desc(auditLogs.createdAt)],
        limit,
        offset,
      });

      const totalPages = Math.ceil(count / limit);

      return {
        data: logs,
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error("Failed to query audit logs", "audit-service", {
        error: error instanceof Error ? error : new Error(String(error)),
        filters,
      });
      throw error;
    }
  }

  /**
   * Get audit logs by user ID
   */
  async getByUserId(userId: string, filters: Omit<AuditLogFilters, "userId">) {
    return this.query({ ...filters, userId });
  }

  /**
   * Get audit logs by action type
   */
  async getByAction(action: string, filters: Omit<AuditLogFilters, "action">) {
    return this.query({ ...filters, action });
  }

  /**
   * Get audit logs by entity type and ID
   */
  async getByEntity(
    entityType: string,
    entityId: string,
    filters: Omit<AuditLogFilters, "entityType" | "entityId">,
  ) {
    return this.query({ ...filters, entityType, entityId });
  }

  /**
   * Get audit logs within a date range
   */
  async getByDateRange(
    startDate: Date,
    endDate: Date,
    filters: Omit<AuditLogFilters, "startDate" | "endDate">,
  ) {
    return this.query({ ...filters, startDate, endDate });
  }

  /**
   * Get failed audit logs only
   */
  async getFailed(filters: AuditLogFilters) {
    return this.query({ ...filters, success: false });
  }

  /**
   * Get successful audit logs only
   */
  async getSuccessful(filters: AuditLogFilters) {
    return this.query({ ...filters, success: true });
  }

  /**
   * Get recent audit logs
   */
  async getRecent(limit: number = 100) {
    return this.query({ limit });
  }

  /**
   * Export audit logs to CSV
   */
  async exportToCSV(filters: AuditLogFilters): Promise<string> {
    try {
      const result = await this.query(filters);
      const logs = result.data;

      if (logs.length === 0) {
        return "";
      }

      const headers = [
        "createdAt",
        "userId",
        "action",
        "entityType",
        "entityId",
        "success",
        "ipAddress",
        "userAgent",
        "errorMessage",
      ];

      const csvRows = [
        headers.join(","),
        ...logs.map((log) =>
          [
            `"${log.createdAt.toISOString()}"`,
            `"${log.userId || ""}"`,
            `"${log.action}"`,
            `"${log.entityType || ""}"`,
            `"${log.entityId || ""}"`,
            `"${log.success}"`,
            `"${log.ipAddress || ""}"`,
            `"${(log.userAgent || "").replace(/"/g, '""')}"`,
            `"${(log.errorMessage || "").replace(/"/g, '""')}"`,
          ].join(","),
        ),
      ];

      return csvRows.join("\n");
    } catch (error) {
      logger.error("Failed to export audit logs to CSV", "audit-service", {
        error: error instanceof Error ? error : new Error(String(error)),
        filters,
      });
      throw error;
    }
  }

  /**
   * Export audit logs to JSON
   */
  async exportToJSON(filters: AuditLogFilters): Promise<string> {
    try {
      const result = await this.query(filters);
      const logs = result.data;

      return JSON.stringify(logs, null, 2);
    } catch (error) {
      logger.error("Failed to export audit logs to JSON", "audit-service", {
        error: error instanceof Error ? error : new Error(String(error)),
        filters,
      });
      throw error;
    }
  }

  /**
   * Delete old audit logs (cleanup)
   */
  async deleteOldLogs(olderThan: Date): Promise<number> {
    try {
      const result = await db
        .delete(auditLogs)
        .where(sql`${auditLogs.createdAt} < ${olderThan}`)
        .returning();

      logger.info("Old audit logs deleted", "audit-service", {
        deletedCount: result.length,
        cutoffDate: olderThan.toISOString(),
      });

      return result.length;
    } catch (error) {
      logger.error("Failed to delete old audit logs", "audit-service", {
        error: error instanceof Error ? error : new Error(String(error)),
        olderThan,
      });
      throw error;
    }
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(filters?: AuditLogFilters): Promise<{
    total: number;
    successful: number;
    failed: number;
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
  }> {
    try {
      const result = await this.query(filters || {});
      const logs = result.data;

      const stats = {
        total: logs.length,
        successful: 0,
        failed: 0,
        byAction: {} as Record<string, number>,
        byEntityType: {} as Record<string, number>,
      };

      for (const log of logs) {
        if (log.success) {
          stats.successful++;
        } else {
          stats.failed++;
        }

        stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

        if (log.entityType) {
          stats.byEntityType[log.entityType] =
            (stats.byEntityType[log.entityType] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      logger.error("Failed to get audit statistics", "audit-service", {
        error: error instanceof Error ? error : new Error(String(error)),
        filters,
      });
      throw error;
    }
  }
}

export const auditService = new AuditService();
