import { Worker, Job } from 'bullmq';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { captures, networks } from '../db/schema';
import { redisConnection, QUEUE_NAMES, type CaptureProcessingJobData } from '../lib/queue';
import { STORAGE_DIRS } from '../lib/storage';
import { env } from '../config';
import { logger } from '../lib/logger';

/**
 * Capture Processing Worker
 *
 * Processes uploaded PCAP files with hcxpcapngtool
 * Extracts WiFi handshakes and converts to hc22000 format
 */

const log = logger.child({ module: 'worker:capture-processing' });
const execAsync = promisify(exec);

/**
 * Process a single capture with hcxpcapngtool
 */
async function processCaptureJob(job: Job<CaptureProcessingJobData>) {
  const { captureId, userId, filePath } = job.data;

  log.info({ jobId: job.id, captureId }, 'Processing capture started');

  try {
    // Update capture status to processing
    await db
      .update(captures)
      .set({ status: 'processing' })
      .where(eq(captures.id, captureId));

    // Generate output filename for hc22000 format
    // Keep original PCAP at filePath, store converted hc22000 separately
    const outputDir = STORAGE_DIRS.processed;
    const outputFilename = `${captureId}.hc22000`;
    const hc22000Path = path.join(outputDir, outputFilename);

    // Run hcxpcapngtool
    // -o: output file
    // Input: PCAP file (kept at original location)
    const command = `${env.HCXPCAPNGTOOL_BINARY_PATH} -o "${hc22000Path}" "${filePath}"`;

    log.debug({ command, captureId }, 'Running hcxpcapngtool');

    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000, // 1 minute timeout
    });

    log.debug({ stdout, stderr, captureId }, 'hcxpcapngtool output');

    // Check if output file was created
    try {
      await fs.access(hc22000Path);
    } catch {
      throw new Error('hcxpcapngtool did not produce output file - no handshakes found');
    }

    // Parse hc22000 file to extract networks
    const networkCount = await extractNetworks(captureId, userId, hc22000Path);

    // Update capture status to completed
    // Store both original PCAP path and converted hc22000 path
    await db
      .update(captures)
      .set({
        status: 'completed',
        processedAt: new Date(),
        networkCount,
        hc22000FilePath: hc22000Path,
      })
      .where(eq(captures.id, captureId));

    log.info({ jobId: job.id, captureId, networkCount }, 'Processing capture completed');

    return { captureId, networkCount };
  } catch (error) {
    log.error({ error, jobId: job.id, captureId }, 'Processing capture failed');

    // Update capture status to failed
    await db
      .update(captures)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(captures.id, captureId));

    throw error;
  }
}

/**
 * Extract networks from hc22000 file
 *
 * hc22000 format: WPA*TYPE*PMKID/MIC*MAC_AP*MAC_CLIENT*ESSID*ANONCE*EAPOL*MESSAGEPAIR
 *
 * Each line represents a network/handshake.
 * We save each line to its own file so users can select which networks to crack.
 * When a job is created, the hashcat worker will merge selected networks back into
 * a single file - this is the most efficient way to use hashcat (one dictionary pass
 * for all networks, rather than running the dictionary N times for N networks).
 */
async function extractNetworks(
  captureId: string,
  userId: string,
  hc22000Path: string
): Promise<number> {
  log.debug({ captureId, hc22000Path }, 'Extracting networks');

  const content = await fs.readFile(hc22000Path, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim().length > 0);

  const extractedNetworks: Array<{
    ssid: string;
    bssid: string;
    handshakeType: string;
  }> = [];

  for (const line of lines) {
    try {
      const parts = line.split('*');

      if (parts.length < 8) {
        log.warn({ line, captureId }, 'Invalid hc22000 line format');
        continue;
      }

      // Extract fields from hc22000 format
      const handshakeType = parts[1]; // TYPE (PMKID or EAPOL)
      const bssid = formatMacAddress(parts[3]); // MAC_AP
      const essidHex = parts[5]; // ESSID (hex encoded)

      // Decode ESSID from hex
      const ssid = Buffer.from(essidHex, 'hex').toString('utf-8');

      // Create individual hc22000 file for this network
      const networkOutputPath = path.join(
        STORAGE_DIRS.processed,
        `${captureId}_${bssid.replace(/:/g, '')}.hc22000`
      );
      await fs.writeFile(networkOutputPath, line + '\n', 'utf-8');

      extractedNetworks.push({
        ssid,
        bssid,
        handshakeType,
      });

      // Insert network into database
      await db.insert(networks).values({
        captureId,
        userId,
        ssid,
        bssid,
        handshakeType,
        hc22000FilePath: networkOutputPath,
      });

      log.debug({ ssid, bssid, captureId }, 'Network extracted');
    } catch (error) {
      log.warn({ error, line, captureId }, 'Failed to parse hc22000 line');
      // Continue processing other lines
    }
  }

  log.info({ captureId, count: extractedNetworks.length }, 'Networks extracted');

  return extractedNetworks.length;
}

/**
 * Format MAC address with colons
 * Input: aabbccddeeff
 * Output: aa:bb:cc:dd:ee:ff
 */
function formatMacAddress(mac: string): string {
  return mac.match(/.{1,2}/g)?.join(':') || mac;
}

/**
 * Create and start the capture processing worker
 */
export function createCaptureProcessingWorker() {
  const worker = new Worker<CaptureProcessingJobData>(
    QUEUE_NAMES.CAPTURE_PROCESSING,
    processCaptureJob,
    {
      connection: redisConnection,
      concurrency: 2, // Process 2 captures simultaneously
      limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // Per minute
      },
    }
  );

  worker.on('completed', (job) => {
    log.info({ jobId: job.id }, 'Job completed successfully');
  });

  worker.on('failed', (job, error) => {
    log.error({ jobId: job?.id, error: error.message }, 'Job failed');
  });

  worker.on('error', (error) => {
    log.error({ error }, 'Worker error');
  });

  log.info('Capture processing worker started');

  return worker;
}
