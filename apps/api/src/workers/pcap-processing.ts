import { db } from "../db/index";
import { networks, captures } from "../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { analyzePCAPFile } from "../lib/pcap-analyzer";
import { CapturesService } from "../services/captures.service";
import { v4 as uuidv4 } from "uuid";

interface ProcessPCAPOptions {
  captureId?: string;
  filePath: string;
  originalFilename: string;
  userId: string;
}

export async function processPCAP({
  captureId,
  filePath,
  originalFilename,
  userId,
}: ProcessPCAPOptions) {
  let finalCaptureId: string = captureId || "";
  let capture: any = null;

  try {
    logger.info("Starting PCAP processing", "pcap-processing", {
      captureId,
      filePath,
      originalFilename,
      userId,
    });

    if (captureId) {
      capture = await db.query.captures.findFirst({
        where: eq(captures.id, captureId),
      });

      if (!capture) {
        throw new Error("Capture not found");
      }

      await CapturesService.updateStatus(captureId, "processing");
    } else {
      const newCaptureId = uuidv4();
      const [newCapture] = await db
        .insert(captures)
        .values({
          id: newCaptureId,
          filename: originalFilename,
          userId,
          status: "processing",
          fileSize: 0,
          networkCount: 0,
          uploadedAt: new Date(),
          filePath,
          metadata: {},
        })
        .returning();

      finalCaptureId = newCaptureId;
      capture = newCapture;

      logger.info("Capture record created", "pcap-processing", {
        captureId: finalCaptureId,
      });
    }

    const analysis = await analyzePCAPFile(filePath, 50);

    logger.info("PCAP analysis completed", "pcap-processing", {
      filePath,
      networksFound: analysis.estimatedNetworkCount || 0,
      totalPackets: analysis.totalPackets,
    });

    const extractedNetworks = analysis.extractedNetworks || [];
    const networkIds: string[] = [];

    for (const networkData of extractedNetworks) {
      const [newNetwork] = await db
        .insert(networks)
        .values({
          ssid: networkData.ssid || networkData.bssid,
          bssid: networkData.bssid,
          encryption: networkData.encryption,
          hasHandshake: networkData.hasHandshake,
          hasPMKID: !!networkData.pmkid,
          channel: networkData.channel,
          frequency: networkData.frequency,
          signalStrength: networkData.signalStrength,
          status: "ready",
          captureDate: new Date(),
          userId,
          notes: `Extracted from PCAP file by worker`,
        })
        .returning();

      networkIds.push(newNetwork.id);

      logger.info("Network created", "pcap-processing", {
        networkId: newNetwork.id,
        ssid: networkData.ssid || networkData.bssid,
        bssid: networkData.bssid,
        encryption: networkData.encryption,
      });
    }

    logger.info("Networks extracted from PCAP", "pcap-processing", {
      networksFound: extractedNetworks.length,
      networkIds,
    });

    await CapturesService.updateNetworkCount(
      finalCaptureId,
      extractedNetworks.length,
    );

    await CapturesService.updateStatus(finalCaptureId, "completed");

    return {
      success: true,
      data: {
        captureId: finalCaptureId,
        networksFound: extractedNetworks.length,
        networkIds,
        totalPackets: analysis.totalPackets,
        estimatedNetworkCount: analysis.estimatedNetworkCount,
      },
    };
  } catch (error) {
    logger.error("PCAP processing failed", "pcap-processing", {
      captureId: finalCaptureId,
      filePath,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    if (finalCaptureId) {
      await CapturesService.updateStatus(
        finalCaptureId,
        "failed",
        error instanceof Error ? error.message : "PCAP processing failed",
      );
    }

    return {
      success: false,
      error: "PCAP processing failed",
      data: {
        captureId: finalCaptureId,
        networksFound: 0,
      },
    };
  }
}
