import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth, requireSuperuser } from "../middleware/auth";
import { configService } from "../services/config.service";
import { auditService } from "../services/audit.service";
import { getUserId } from "../lib/auth";
import { logger } from "../lib/logger";
import { emailQueue } from "../lib/email-queue";

const email = new Hono();

email.use("*", requireAuth);

const testEmailSchema = z.object({
  to: z.string().email("Invalid email address"),
});

/**
 * GET /api/v1/email/queue/stats - Get email queue statistics (superuser only)
 */
email.get("/queue/stats", requireSuperuser, async (c) => {
  try {
    const userId = getUserId(c);
    const stats = await emailQueue.getQueueStats();

    await auditService.logEvent({
      userId,
      action: "get_email_queue_stats",
      entityType: "email",
      success: true,
    });

    return c.json({ success: true, stats });
  } catch (error) {
    logger.error("Failed to get email queue stats", "email-api", {
      error: error instanceof Error ? error : new Error(String(error)),
    });

    await auditService.logEvent({
      userId: getUserId(c),
      action: "get_email_queue_stats",
      entityType: "email",
      success: false,
      details: { error: String(error) },
    });

    return c.json(
      {
        success: false,
        error: "Failed to get email queue statistics",
      },
      500,
    );
  }
});

/**
 * POST /api/v1/email/queue/retry - Retry failed email (superuser only)
 */
email.post(
  "/queue/retry",
  requireSuperuser,
  zValidator("json", z.object({ jobId: z.string() })),
  async (c) => {
    try {
      const userId = getUserId(c);
      const { jobId } = c.req.valid("json");

      await emailQueue.retryFailedJob(jobId);

      await auditService.logEvent({
        userId,
        action: "retry_failed_email",
        entityType: "email",
        entityId: jobId,
        success: true,
      });

      logger.info("Email job retry requested", "email-api", {
        userId,
        jobId,
      });

      return c.json({
        success: true,
        message: "Email job queued for retry",
      });
    } catch (error) {
      logger.error("Failed to retry email job", "email-api", {
        error: error instanceof Error ? error : new Error(String(error)),
      });

      await auditService.logEvent({
        userId: getUserId(c),
        action: "retry_failed_email",
        entityType: "email",
        entityId: c.req.valid("json").jobId,
        success: false,
        details: { error: String(error) },
      });

      return c.json(
        {
          success: false,
          error: "Failed to retry email job",
        },
        500,
      );
    }
  },
);

/**
 * DELETE /api/v1/email/queue/:jobId - Remove email job from queue (superuser only)
 */
email.delete("/queue/:jobId", requireSuperuser, async (c) => {
  try {
    const userId = getUserId(c);
    const { jobId } = c.req.param();

    await emailQueue.removeJob(jobId);

    await auditService.logEvent({
      userId,
      action: "remove_email_job",
      entityType: "email",
      entityId: jobId,
      success: true,
    });

    logger.info("Email job removed from queue", "email-api", {
      userId,
      jobId,
    });

    return c.json({
      success: true,
      message: "Email job removed from queue",
    });
  } catch (error) {
    logger.error("Failed to remove email job", "email-api", {
      error: error instanceof Error ? error : new Error(String(error)),
    });

    await auditService.logEvent({
      userId: getUserId(c),
      action: "remove_email_job",
      entityType: "email",
      entityId: c.req.param().jobId,
      success: false,
      details: { error: String(error) },
    });

    return c.json(
      {
        success: false,
        error: "Failed to remove email job",
      },
      500,
    );
  }
});

/**
 * POST /api/v1/email/test - Send test email (superuser only)
 */
email.post(
  "/test",
  requireSuperuser,
  zValidator("json", testEmailSchema),
  async (c) => {
    try {
      const userId = getUserId(c);
      const { to } = c.req.valid("json");

      await auditService.logEvent({
        userId,
        action: "send_test_email",
        entityType: "email",
        entityId: to,
        success: true,
      });

      const job = await emailQueue.sendJobEmail({
        type: "test_email",
        to,
        data: {},
      });

      logger.info("Test email queued successfully", "email-api", {
        userId,
        to,
        jobId: job.id,
      });

      return c.json({
        success: true,
        message: "Test email queued successfully",
        jobId: job.id,
      });
    } catch (error) {
      logger.error("Failed to queue test email", "email-api", {
        error: error instanceof Error ? error : new Error(String(error)),
      });

      await auditService.logEvent({
        userId: getUserId(c),
        action: "send_test_email",
        entityType: "email",
        entityId: c.req.valid("json").to,
        success: false,
        details: { error: String(error) },
      });

      return c.json(
        {
          success: false,
          error: "Failed to queue test email",
        },
        500,
      );
    }
  },
);

export default email;
