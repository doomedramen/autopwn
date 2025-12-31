import { emailQueue } from "../lib/email-queue";
import { logger } from "../lib/logger";
import { configService } from "../services/config.service";

export default async function startEmailWorker() {
  try {
    const emailEnabled = await configService.getBoolean("email-enabled", false);

    if (!emailEnabled) {
      logger.info(
        "Email notifications disabled, worker not starting",
        "email-worker",
      );
      return;
    }

    logger.info("Starting email worker...", "email-worker");

    await emailQueue.initialize();

    logger.info("Email worker ready", "email-worker");

    // Graceful shutdown
    process.on("SIGINT", async () => {
      logger.info(
        "Received SIGINT, shutting down email worker...",
        "email-worker",
      );
      await emailQueue.close();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.info(
        "Received SIGTERM, shutting down email worker...",
        "email-worker",
      );
      await emailQueue.close();
      process.exit(0);
    });

    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception in email worker", "email-worker", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled rejection in email worker", "email-worker", {
        reason: String(reason),
        promise,
      });
    });
  } catch (error) {
    logger.error("Failed to start email worker", "email-worker", {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    process.exit(1);
  }
}
