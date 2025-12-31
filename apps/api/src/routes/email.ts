import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth, requireSuperuser } from "../middleware/auth";
import { emailService } from "../services/email.service";
import { configService } from "../services/config.service";
import { auditService } from "../services/audit.service";
import { getUserId } from "../lib/auth";
import { logger } from "../lib/logger";

const email = new Hono();

email.use("*", requireAuth);

const testEmailSchema = z.object({
  to: z.string().email("Invalid email address"),
});

/**
 * GET /api/v1/config/email - Get email configuration (superuser only)
 */
email.get("/config", requireSuperuser, async (c) => {
  try {
    const userId = getUserId(c);
    const config = {
      host: await configService.getString("email-host"),
      port: await configService.getNumber("email-port"),
      secure: await configService.getBoolean("email-secure"),
      user: await configService.getString("email-user"),
      from: await configService.getString("email-from"),
      enabled: await configService.getBoolean("email-enabled"),
      notifications: {
        jobComplete: await configService.getBoolean(
          "email-notify-job-complete",
        ),
        jobFailed: await configService.getBoolean("email-notify-job-failed"),
        healthDegraded: await configService.getBoolean(
          "email-notify-health-degraded",
        ),
        healthCritical: await configService.getBoolean(
          "email-notify-health-critical",
        ),
        securityEvents: await configService.getBoolean(
          "email-notify-security-events",
        ),
      },
    };

    await auditService.logEvent({
      userId,
      action: "get_email_config",
      entityType: "email",
      success: true,
    });

    return c.json({ success: true, config });
  } catch (error) {
    logger.error("Failed to get email config", "email-api", {
      error: error instanceof Error ? error : new Error(String(error)),
    });

    await auditService.logEvent({
      userId: getUserId(c),
      action: "get_email_config",
      entityType: "email",
      success: false,
      details: { error: String(error) },
    });

    return c.json(
      {
        success: false,
        error: "Failed to get email configuration",
      },
      500,
    );
  }
});

/**
 * PATCH /api/v1/config/email - Update email configuration (superuser only)
 */
email.patch(
  "/config",
  requireSuperuser,
  zValidator(
    "json",
    testEmailSchema.partial().extend({
      password: z.string().optional(),
      enabled: z.boolean().optional(),
      notifications: z
        .object({
          jobComplete: z.boolean().optional(),
          jobFailed: z.boolean().optional(),
          healthDegraded: z.boolean().optional(),
          healthCritical: z.boolean().optional(),
          securityEvents: z.boolean().optional(),
        })
        .optional(),
    }),
  ),
  async (c) => {
    try {
      const userId = getUserId(c);
      const body = c.req.valid("json");

      const updates = [];

      if (body.host !== undefined) {
        await configService.update("email-host", body.host);
        updates.push("email-host");
      }

      if (body.port !== undefined) {
        await configService.update("email-port", body.port);
        updates.push("email-port");
      }

      if (body.secure !== undefined) {
        await configService.update("email-secure", body.secure);
        updates.push("email-secure");
      }

      if (body.user !== undefined) {
        await configService.update("email-user", body.user);
        updates.push("email-user");
      }

      if (body.password !== undefined) {
        await configService.update("email-password", body.password);
        updates.push("email-password");
      }

      if (body.from !== undefined) {
        await configService.update("email-from", body.from);
        updates.push("email-from");
      }

      if (body.enabled !== undefined) {
        await configService.update("email-enabled", body.enabled);
        updates.push("email-enabled");
      }

      if (body.notifications !== undefined) {
        if (body.notifications.jobComplete !== undefined) {
          await configService.update(
            "email-notify-job-complete",
            body.notifications.jobComplete,
          );
          updates.push("email-notify-job-complete");
        }

        if (body.notifications.jobFailed !== undefined) {
          await configService.update(
            "email-notify-job-failed",
            body.notifications.jobFailed,
          );
          updates.push("email-notify-job-failed");
        }

        if (body.notifications.healthDegraded !== undefined) {
          await configService.update(
            "email-notify-health-degraded",
            body.notifications.healthDegraded,
          );
          updates.push("email-notify-health-degraded");
        }

        if (body.notifications.healthCritical !== undefined) {
          await configService.update(
            "email-notify-health-critical",
            body.notifications.healthCritical,
          );
          updates.push("email-notify-health-critical");
        }

        if (body.notifications.securityEvents !== undefined) {
          await configService.update(
            "email-notify-security-events",
            body.notifications.securityEvents,
          );
          updates.push("email-notify-security-events");
        }
      }

      await auditService.logEvent({
        userId,
        action: "update_email_config",
        entityType: "email",
        entityId: updates.join(","),
        details: { updates },
        success: true,
      });

      logger.info("Email configuration updated", "email-api", {
        userId,
        updates,
      });

      return c.json({
        success: true,
        message: "Email configuration updated successfully",
      });
    } catch (error) {
      logger.error("Failed to update email config", "email-api", {
        error: error instanceof Error ? error : new Error(String(error)),
      });

      await auditService.logEvent({
        userId: getUserId(c),
        action: "update_email_config",
        entityType: "email",
        success: false,
        details: { error: String(error) },
      });

      return c.json(
        {
          success: false,
          error: "Failed to update email configuration",
        },
        500,
      );
    }
  },
);

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

      const result = await emailService.sendTestEmail(to);

      if (!result) {
        await auditService.logEvent({
          userId,
          action: "send_test_email",
          entityType: "email",
          entityId: to,
          success: false,
          details: { error: "Failed to send test email" },
        });

        return c.json(
          {
            success: false,
            error: "Failed to send test email",
          },
          500,
        );
      }

      logger.info("Test email sent successfully", "email-api", {
        userId,
        to,
      });

      return c.json({
        success: true,
        message: "Test email sent successfully",
      });
    } catch (error) {
      logger.error("Failed to send test email", "email-api", {
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
          error: "Failed to send test email",
        },
        500,
      );
    }
  },
);

export default email;
