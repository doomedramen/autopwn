import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { configService } from "../services/config.service";
import { logger } from "../lib/logger";
import { requireSuperuser } from "../middleware/auth";

const configRoutes = new Hono();

configRoutes.use("*", requireSuperuser);

const configUpdateSchema = z.object({
  id: z.string().min(1),
  value: z.any(),
});

const batchConfigUpdateSchema = z.object({
  updates: z.array(configUpdateSchema).min(1),
});

/**
 * GET /api/v1/config
 * Get all config values (superuser only)
 */
configRoutes.get("/", async (c) => {
  try {
    logger.info("Fetching all config values", "config-api");

    const allConfig = await configService.getAll();

    return c.json({
      success: true,
      data: allConfig,
    });
  } catch (error) {
    logger.error("Failed to fetch all config", "config-api", {
      error: error instanceof Error ? error : new Error(String(error)),
    });

    return c.json(
      {
        success: false,
        error: "Failed to fetch config",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * GET /api/v1/config/:id
 * Get a single config value (superuser only)
 */
configRoutes.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    logger.info(`Fetching config value for '${id}'`, "config-api");

    const cfg = await configService.getById(id);

    if (!cfg) {
      return c.json(
        {
          success: false,
          error: "Config not found",
          message: `Config '${id}' does not exist`,
        },
        404,
      );
    }

    return c.json({
      success: true,
      data: cfg,
    });
  } catch (error) {
    logger.error(
      `Failed to fetch config '${c.req.param("id")}'`,
      "config-api",
      {
        error: error instanceof Error ? error : new Error(String(error)),
      },
    );

    return c.json(
      {
        success: false,
        error: "Failed to fetch config",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * PATCH /api/v1/config
 * Batch update config values (superuser only)
 */
configRoutes.patch(
  "/",
  zValidator("json", batchConfigUpdateSchema),
  async (c) => {
    try {
      const userId = c.get("userId");
      const { updates } = c.req.valid("json");

      logger.info("Batch updating config values", "config-api", {
        updateCount: updates.length,
        userId,
      });

      const results = [];
      const errors = [];
      const requiresRestart = false;

      for (const { id, value } of updates) {
        try {
          const validation = await configService.validate(id, value);

          if (!validation.valid) {
            errors.push({
              id,
              error: validation.error,
            });
            continue;
          }

          const updated = await configService.update(id, value, userId);

          if (updated.requiresRestart) {
            requiresRestart = true;
          }

          results.push(updated);
        } catch (error) {
          logger.error(`Failed to update config '${id}'`, "config-api", {
            error: error instanceof Error ? error : new Error(String(error)),
          });

          errors.push({
            id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      if (errors.length > 0) {
        return c.json(
          {
            success: false,
            error: "Some config updates failed",
            message: `${errors.length} of ${updates.length} updates failed`,
            data: {
              updated: results,
              failed: errors,
              requiresRestart,
            },
          },
          400,
        );
      }

      return c.json({
        success: true,
        message: "Config updated successfully",
        data: {
          updated: results,
          count: results.length,
          requiresRestart,
        },
      });
    } catch (error) {
      logger.error("Failed to batch update config", "config-api", {
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return c.json(
        {
          success: false,
          error: "Failed to update config",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

/**
 * POST /api/v1/config/reload
 * Reload config from database (superuser only)
 */
configRoutes.post("/reload", async (c) => {
  try {
    const userId = c.get("userId");

    logger.info("Reloading config", "config-api", {
      userId,
    });

    await configService.reload();

    return c.json({
      success: true,
      message: "Config reloaded successfully",
    });
  } catch (error) {
    logger.error("Failed to reload config", "config-api", {
      error: error instanceof Error ? error : new Error(String(error)),
    });

    return c.json(
      {
        success: false,
        error: "Failed to reload config",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * POST /api/v1/config/validate
 * Validate config values without updating (superuser only)
 */
configRoutes.post(
  "/validate",
  zValidator("json", batchConfigUpdateSchema),
  async (c) => {
    try {
      const { updates } = c.req.valid("json");

      logger.info("Validating config values", "config-api", {
        validationCount: updates.length,
      });

      const results = [];

      for (const { id, value } of updates) {
        const validation = await configService.validate(id, value);
        results.push({
          id,
          valid: validation.valid,
          error: validation.error,
        });
      }

      return c.json({
        success: true,
        data: results,
      });
    } catch (error) {
      logger.error("Failed to validate config values", "config-api", {
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return c.json(
        {
          success: false,
          error: "Failed to validate config",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

export { configRoutes };
