import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/index";
import { getUserId } from "../middleware/auth";
import { storageManager } from "../lib/storage-manager";
import { logger } from "../lib/logger";
import { addPCAPProcessingJob } from "../lib/queue";
import {
  validatePCAPFileByName,
  quickPCAPValidation,
  getPCAPFileInfo,
} from "../lib/pcap-validator";
import { v4 as uuidv4 } from "uuid";
import { captures } from "../db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs/promises";

const uploadSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => {
      const maxSize = parseInt(process.env.MAX_PCAP_SIZE || "524288000");
      return file.size <= maxSize;
    },
    {
      message: "File size must be less than 500MB",
    },
  ),
  metadata: z.record(z.string()).optional(),
});

const upload = new Hono();

upload.use("*", getUserId);

upload.post("/", zValidator("form", uploadSchema), async (c) => {
  try {
    const userId = getUserId(c);
    const { file, metadata } = c.req.valid("form");

    logger.info("Upload request received", "upload", {
      userId,
      filename: file.name,
      fileSize: file.size,
    });

    const canUpload = await storageManager.checkUserQuota(userId, file.size);
    if (!canUpload) {
      const quotaInfo = await storageManager.getUserQuotaInfo(userId);
      return c.json(
        {
          success: false,
          error: "QUOTA_EXCEEDED",
          message: "Storage quota exceeded",
          data: {
            quota: quotaInfo,
            requestedSize: file.size,
          },
        },
        413,
      );
    }

    const captureId = uuidv4();
    const uploadDir = `/data/uploads/captures/${captureId}`;

    await fs.mkdir(uploadDir, { recursive: true });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `${uploadDir}/${fileName}`;

    await fs.writeFile(filePath, fileBuffer);
    await fs.chmod(filePath, 0o600);

    const isValidPCAP = await quickPCAPValidation(file.name, fileBuffer);
    if (!isValidPCAP) {
      await fs.rm(uploadDir, { recursive: true, force: true }).catch(() => {});

      return c.json(
        {
          success: false,
          error: "Invalid PCAP file",
          message:
            "The uploaded file is not a valid PCAP file. Please ensure that the file is in PCAP format.",
          code: "INVALID_PCAP_FILE",
        },
        400,
      );
    }

    let pcapInfo = null;
    let pcapAnalysis = null;

    try {
      pcapInfo = await getPCAPFileInfo(filePath);
      const { analyzePCAPFile } = await import("../lib/pcap-analyzer");
      pcapAnalysis = await analyzePCAPFile(filePath, 50);
    } catch (error) {
      logger.warn("Failed to analyze PCAP file", "upload", {
        filePath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    const [capture] = await db
      .insert(captures)
      .values({
        filename: file.name,
        userId,
        status: "pending",
        fileSize: file.size,
        filePath,
        networkCount: 0,
        uploadedAt: new Date(),
        metadata: {
          pcapInfo,
          pcapAnalysis,
          uploadId: captureId,
        },
      })
      .returning();

    logger.info("Capture created", "upload", {
      captureId: capture.id,
      userId,
      filename: file.name,
      fileSize: file.size,
    });

    const queueHealth = await (await import("../lib/queue")).checkQueueHealth();
    if (queueHealth.status === "healthy") {
      await addPCAPProcessingJob({
        captureId: capture.id,
        filePath,
        originalFilename: file.name,
        userId,
        metadata: {
          pcapInfo,
          pcapAnalysis,
          uploadId: captureId,
        },
      });
    } else {
      logger.warn("Queue not healthy, skipping PCAP processing", "upload", {
        queueHealth,
      });
    }

    return c.json(
      {
        success: true,
        message: "PCAP file uploaded successfully and queued for processing",
        data: {
          uploadId: captureId,
          captureId: capture.id,
          filename: capture.filename,
          fileSize: capture.fileSize,
          status: capture.status,
          uploadedAt: capture.uploadedAt,
          queuedForProcessing: queueHealth.status === "healthy",
          pcapInfo: pcapInfo
            ? {
                version: pcapInfo.version,
                network: pcapInfo.network,
              }
            : null,
          pcapAnalysis: pcapAnalysis
            ? {
                totalPackets: pcapAnalysis.analysis.totalPackets,
                estimatedNetworkCount: pcapAnalysis.estimatedNetworkCount,
              }
            : null,
        },
      },
      201,
    );
  } catch (error) {
    logger.error(
      "upload error",
      "upload",
      error instanceof Error ? error : new Error(String(error)),
      {
        userId: getUserId(c),
        filename: c.req.valid("form")?.file?.name,
        fileSize: c.req.valid("form")?.file?.size,
      },
    );

    return c.json(
      {
        success: false,
        error: "File upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

export { upload as uploadRoutes };
