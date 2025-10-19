import { Worker, Job } from 'bullmq';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { jobs, networks, dictionaries, results, jobNetworks, jobDictionaries } from '../db/schema';
import { redisConnection, QUEUE_NAMES, type HashcatJobData } from '../lib/queue';
import { STORAGE_DIRS } from '../lib/storage';
import { env } from '../config';
import { logger } from '../lib/logger';

/**
 * Hashcat Worker
 *
 * Executes hashcat password cracking jobs
 * Monitors progress and extracts cracked passwords
 */

const log = logger.child({ module: 'worker:hashcat' });

/**
 * Execute hashcat job
 */
async function hashcatJob(job: Job<HashcatJobData>) {
  const { jobId, userId, networkIds, dictionaryIds, attackMode, options } = job.data;

  log.info({ jobId: job.id, hashcatJobId: jobId }, 'Hashcat job started');

  try {
    // Update job status to active
    await db
      .update(jobs)
      .set({
        status: 'active',
        startedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));

    // Get network files
    const networkRecords = await db.query.networks.findMany({
      where: inArray(networks.id, networkIds),
    });

    if (networkRecords.length === 0) {
      throw new Error('No networks found');
    }

    // Get dictionary files
    const dictionaryRecords = await db.query.dictionaries.findMany({
      where: inArray(dictionaries.id, dictionaryIds),
    });

    if (dictionaryRecords.length === 0) {
      throw new Error('No dictionaries found');
    }

    // Merge all selected network hc22000 files into one file
    // Each network has one line in hc22000 format
    // This is the optimal way to run hashcat against multiple networks
    const combinedHashFile = path.join(STORAGE_DIRS.results, `${jobId}_hashes.hc22000`);
    const hashLines: string[] = [];

    for (const network of networkRecords) {
      const content = await fs.readFile(network.hc22000FilePath, 'utf-8');
      const trimmed = content.trim();
      if (trimmed) {
        hashLines.push(trimmed);
      }
    }

    // Write merged hc22000 file (one line per network)
    await fs.writeFile(combinedHashFile, hashLines.join('\n') + '\n', 'utf-8');

    log.info(
      { jobId: jobId, networkCount: hashLines.length },
      'Merged network hc22000 files for hashcat'
    );

    // Combine all dictionaries into one (or use separately based on attack mode)
    // For simplicity, we'll combine them
    const combinedDictFile = path.join(STORAGE_DIRS.results, `${jobId}_wordlist.txt`);
    const dictLines: string[] = [];

    for (const dict of dictionaryRecords) {
      if (dict.filePath) {
        const content = await fs.readFile(dict.filePath, 'utf-8');
        dictLines.push(content.trim());
      }
    }

    await fs.writeFile(combinedDictFile, dictLines.join('\n'), 'utf-8');

    // Output file for cracked passwords
    const outputFile = path.join(STORAGE_DIRS.results, `${jobId}_cracked.txt`);

    // Build hashcat command
    // -m 22000: WPA-PBKDF2-PMKID+EAPOL
    // -a 0: Straight attack (dictionary)
    // -w: Workload profile
    // --potfile-disable: Don't use potfile
    // --status: Show status
    // --status-timer: Status update interval
    const hashcatArgs = [
      '-m',
      '22000', // WPA/WPA2
      '-a',
      '0', // Straight attack
      '-w',
      options.workloadProfile?.toString() || env.HASHCAT_WORKLOAD_PROFILE.toString(),
      '--potfile-disable',
      '--outfile',
      outputFile,
      '--outfile-format',
      '2', // plain:hash format
      combinedHashFile,
      combinedDictFile,
    ];

    // Add optimization if requested
    if (options.optimized) {
      hashcatArgs.push('-O');
    }

    // Run hashcat
    const startTime = Date.now();
    let crackedCount = 0;

    await new Promise<void>((resolve, reject) => {
      const hashcat = spawn(env.HASHCAT_BINARY_PATH, hashcatArgs);

      let stdout = '';
      let stderr = '';

      hashcat.stdout.on('data', (data) => {
        stdout += data.toString();

        // Parse progress from stdout if available
        // Hashcat outputs progress in various formats
        const progressMatch = stdout.match(/Progress\.*:\s*(\d+)/);
        if (progressMatch) {
          const progress = parseInt(progressMatch[1], 10);
          job.updateProgress(progress).catch((err) => {
            log.warn({ error: err }, 'Failed to update job progress');
          });
        }
      });

      hashcat.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      hashcat.on('close', async (code) => {
        log.debug({ code, stdout, stderr }, 'Hashcat process closed');

        // Exit code 0 or 1 are both acceptable
        // 0 = All hashes cracked
        // 1 = Not all hashes cracked (normal for partial success)
        if (code !== 0 && code !== 1) {
          reject(new Error(`Hashcat exited with code ${code}: ${stderr}`));
          return;
        }

        resolve();
      });

      hashcat.on('error', (error) => {
        reject(error);
      });
    });

    // Parse results
    try {
      const crackedContent = await fs.readFile(outputFile, 'utf-8');
      const crackedLines = crackedContent.split('\n').filter((l) => l.trim());

      for (const line of crackedLines) {
        // Format: password:hash
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const password = line.substring(0, colonIndex);
        const hash = line.substring(colonIndex + 1);

        // Find which network this hash belongs to
        for (const network of networkRecords) {
          const networkHash = await fs.readFile(network.hc22000FilePath, 'utf-8');

          if (networkHash.includes(hash)) {
            // Insert result
            await db.insert(results).values({
              networkId: network.id,
              jobId,
              dictionaryId: dictionaryRecords[0]?.id || null,
              userId,
              password,
            });

            // Mark network as cracked
            await db
              .update(networks)
              .set({
                isCracked: true,
                crackedAt: new Date(),
              })
              .where(eq(networks.id, network.id));

            crackedCount++;
            log.info({ networkId: network.id, ssid: network.ssid }, 'Password cracked');
          }
        }
      }
    } catch (error) {
      // Output file might not exist if nothing was cracked
      log.warn({ error }, 'No results file or error parsing results');
    }

    // Calculate duration
    const duration = Math.floor((Date.now() - startTime) / 1000);

    // Update job status to completed
    await db
      .update(jobs)
      .set({
        status: 'completed',
        progress: '100',
        completedAt: new Date(),
        duration,
        crackedCount,
      })
      .where(eq(jobs.id, jobId));

    log.info(
      { jobId: job.id, hashcatJobId: jobId, crackedCount, duration },
      'Hashcat job completed'
    );

    return { jobId, crackedCount, duration };
  } catch (error) {
    log.error({ error, jobId: job.id, hashcatJobId: jobId }, 'Hashcat job failed');

    // Update job status to failed
    await db
      .update(jobs)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(jobs.id, jobId));

    throw error;
  }
}

/**
 * Create and start the hashcat worker
 */
export function createHashcatWorker() {
  const worker = new Worker<HashcatJobData>(QUEUE_NAMES.HASHCAT_JOBS, hashcatJob, {
    connection: redisConnection,
    concurrency: env.MAX_CONCURRENT_JOBS,
    limiter: {
      max: env.MAX_CONCURRENT_JOBS,
      duration: 1000,
    },
  });

  worker.on('completed', (job) => {
    log.info({ jobId: job.id }, 'Job completed successfully');
  });

  worker.on('failed', (job, error) => {
    log.error({ jobId: job?.id, error: error.message }, 'Job failed');
  });

  worker.on('error', (error) => {
    log.error({ error }, 'Worker error');
  });

  log.info('Hashcat worker started');

  return worker;
}
