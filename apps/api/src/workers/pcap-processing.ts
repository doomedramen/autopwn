import { db } from "./db";
import { networks } from "./schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { analyzePCAPFile } from "./lib/pcap-analyzer";

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
  try {
    logger.info("Starting PCAP processing", "pcap-processing", {
      captureId,
      filePath,
      originalFilename,
      userId,
    });

    // Get capture to update
    const capture = await db.query.captures.findFirst({
      where: eq(captures.id, captureId),
    });

    if (!capture) {
      throw new Error("Capture not found");
    }

    // Analyze PCAP file
    const analysis = await analyzePCAPFile(filePath, 50);

    logger.info("PCAP analysis completed", "pcap-processing", {
      filePath,
      networksFound: analysis.estimatedNetworkCount || 0,
      totalPackets: analysis.totalPackets,
    });

    // If capture was provided, update its network
    if (captureId) {
      await CapturesService.updateStatus(captureId, "processing");
    } else {
      // No captureId provided, create new capture record and then create networks
      logger.info(
        "No captureId provided, creating new capture and networks",
        "pcap-processing",
      );

      const newCaptureId = uuidv4();
      const [{ insert: captures }] = await db
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
          metadata: {
            pcapInfo: analysis.estimatedNetworkCount
              ? {
                  version: analysis.version,
                  network: analysis.network,
                  snaplen: analysis.snaplen,
                }
              : null,
            pcapAnalysis: analysis.estimatedNetworkCount
              ? {
                  totalPackets: analysis.totalPackets,
                  estimatedNetworkCount: analysis.estimatedNetworkCount,
                }
              : null,
          },
        })
        .returning();

      logger.info("Capture record created", "pcap-processing", {
        captureId: newCaptureId,
      });

      return newCaptureId;
    }

    // Extract networks from PCAP analysis
    const extractedNetworks = analysis.extractedNetworks || [];
    const networkIds: string[] = [];

    for (const networkData of analysis.extractedNetworks || []) {
      logger.info("Creating network", "pcap-processing", {
        ssid: networkData.ssid || networkData.bssid,
        bssid: networkData.bssid,
        encryption: networkData.encryption,
        hasHandshake: networkData.hasHandshake,
        hasPMKID: !!networkData.pmkid,
        captureDate: new Date(),
        userId,
        captureId: captureId || newCaptureId,
      });

      const [{ insert: networks }] = await db
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
    }

    logger.info("Networks extracted from PCAP", "pcap-processing", {
      networksFound: extractedNetworks.length,
      networkIds,
    });

    // Update capture with network count and mark as completed
    await CapturesService.updateNetworkCount(
      captureId || newCaptureId,
      extractedNetworks.length,
    );

    const finalCaptureId = captureId || newCaptureId;

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
      captureId,
      filePath,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    await CapturesService.updateStatus(
      captureId || newCaptureId,
      "failed",
      error instanceof Error ? error.message : "PCAP processing failed",
    );

    return {
      success: false,
      error: "PCAP processing failed",
      data: {
        captureId: captureId || newCaptureId,
        networksFound: 0,
      },
    };
  }
}

// Local import of CapturesService for updateStatus and updateNetworkCount
async function CapturesService() {
  const CapturesServiceClass = await import("./services/captures.service");
  return CapturesServiceClass;
}
