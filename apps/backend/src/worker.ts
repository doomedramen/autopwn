import { env } from './config';
import { logger } from './lib/logger';
import { initializeStorage } from './lib/storage';
import { initializeQueues, closeQueues } from './lib/queue';
import { closeDatabase } from './db';
import { createCaptureProcessingWorker } from './workers/capture-processing';
import { createDictionaryGenerationWorker } from './workers/dictionary-generation';
import { createHashcatWorker } from './workers/hashcat';

/**
 * Autopwn Background Worker Process
 *
 * Processes background jobs:
 * - PCAP file processing (hcxpcapngtool)
 * - Dictionary generation (custom wordlists)
 * - Hashcat password cracking
 *
 * Run separately from the main server process for better resource management
 */

const log = logger;

/**
 * Initialize workers
 */
async function start() {
  try {
    log.info('Starting Autopwn Worker Process');

    // Initialize storage directories
    await initializeStorage();

    // Initialize job queues
    await initializeQueues();

    // Start all workers
    const captureWorker = createCaptureProcessingWorker();
    const dictionaryWorker = createDictionaryGenerationWorker();
    const hashcatWorker = createHashcatWorker();

    log.info({
      msg: 'All workers started',
      config: {
        nodeEnv: env.NODE_ENV,
        maxConcurrentJobs: env.MAX_CONCURRENT_JOBS,
        hashcatWorkload: env.HASHCAT_WORKLOAD_PROFILE,
      },
    });

    // Handle worker errors
    const workers = [captureWorker, dictionaryWorker, hashcatWorker];

    for (const worker of workers) {
      worker.on('error', (error) => {
        log.error({ error, workerName: worker.name }, 'Worker error');
      });
    }
  } catch (error) {
    log.error(error, 'Failed to start worker process');
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  log.info('Shutting down worker process gracefully...');

  try {
    // Close queues (this will stop accepting new jobs and wait for active jobs)
    await closeQueues();

    // Close database
    await closeDatabase();

    log.info('Worker process shut down successfully');
    process.exit(0);
  } catch (error) {
    log.error(error, 'Error during worker shutdown');
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.fatal({ reason }, 'Unhandled rejection');
  process.exit(1);
});

// Start the worker process
start();
