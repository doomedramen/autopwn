import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config';
import { logger } from './logger';

/**
 * Job Queue Setup (BullMQ)
 *
 * Manages background jobs for:
 * - PCAP processing (hcxpcapngtool)
 * - Dictionary generation (crunch)
 * - Hashcat execution
 */

const log = logger.child({ module: 'queue' });

/**
 * Redis connection for BullMQ
 */
export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times > env.REDIS_MAX_RETRIES) {
      log.error('Redis connection failed after max retries');
      return null;
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  CAPTURE_PROCESSING: 'capture-processing',
  DICTIONARY_GENERATION: 'dictionary-generation',
  HASHCAT_JOBS: 'hashcat-jobs',
} as const;

/**
 * Job data types
 */
export interface CaptureProcessingJobData {
  captureId: string;
  userId: string;
  filePath: string;
}

export interface DictionaryGenerationJobData {
  dictionaryId: string;
  userId: string;
  options: Record<string, unknown>;
}

export interface HashcatJobData {
  jobId: string;
  userId: string;
  networkIds: string[];
  dictionaryIds: string[];
  attackMode: string;
  options: Record<string, unknown>;
}

/**
 * Default job options
 */
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: {
    age: 86400, // Keep completed jobs for 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 604800, // Keep failed jobs for 7 days
    count: 5000,
  },
};

/**
 * Capture Processing Queue
 */
export const captureProcessingQueue = new Queue<CaptureProcessingJobData>(
  QUEUE_NAMES.CAPTURE_PROCESSING,
  {
    connection: redisConnection,
    defaultJobOptions,
  }
);

/**
 * Dictionary Generation Queue
 */
export const dictionaryGenerationQueue = new Queue<DictionaryGenerationJobData>(
  QUEUE_NAMES.DICTIONARY_GENERATION,
  {
    connection: redisConnection,
    defaultJobOptions,
  }
);

/**
 * Hashcat Jobs Queue
 */
export const hashcatJobsQueue = new Queue<HashcatJobData>(
  QUEUE_NAMES.HASHCAT_JOBS,
  {
    connection: redisConnection,
    defaultJobOptions: {
      ...defaultJobOptions,
      timeout: env.HASHCAT_JOB_TIMEOUT * 1000, // Convert seconds to ms
    },
  }
);

/**
 * Queue Events (for monitoring)
 */
export const captureProcessingEvents = new QueueEvents(
  QUEUE_NAMES.CAPTURE_PROCESSING,
  {
    connection: redisConnection,
  }
);

export const dictionaryGenerationEvents = new QueueEvents(
  QUEUE_NAMES.DICTIONARY_GENERATION,
  {
    connection: redisConnection,
  }
);

export const hashcatJobsEvents = new QueueEvents(QUEUE_NAMES.HASHCAT_JOBS, {
  connection: redisConnection,
});

/**
 * Set up queue event listeners
 */
function setupQueueEvents() {
  // Capture Processing Events
  captureProcessingEvents.on('completed', ({ jobId }) => {
    log.info({ jobId, queue: 'capture-processing' }, 'Job completed');
  });

  captureProcessingEvents.on('failed', ({ jobId, failedReason }) => {
    log.error(
      { jobId, queue: 'capture-processing', failedReason },
      'Job failed'
    );
  });

  // Dictionary Generation Events
  dictionaryGenerationEvents.on('completed', ({ jobId }) => {
    log.info({ jobId, queue: 'dictionary-generation' }, 'Job completed');
  });

  dictionaryGenerationEvents.on('failed', ({ jobId, failedReason }) => {
    log.error(
      { jobId, queue: 'dictionary-generation', failedReason },
      'Job failed'
    );
  });

  // Hashcat Jobs Events
  hashcatJobsEvents.on('completed', ({ jobId }) => {
    log.info({ jobId, queue: 'hashcat-jobs' }, 'Job completed');
  });

  hashcatJobsEvents.on('failed', ({ jobId, failedReason }) => {
    log.error({ jobId, queue: 'hashcat-jobs', failedReason }, 'Job failed');
  });

  hashcatJobsEvents.on('progress', ({ jobId, data }) => {
    log.debug({ jobId, queue: 'hashcat-jobs', progress: data }, 'Job progress');
  });
}

/**
 * Initialize queues
 */
export async function initializeQueues(): Promise<void> {
  log.info('Initializing job queues');

  // Test Redis connection
  try {
    await redisConnection.ping();
    log.info('Redis connection established');
  } catch (error) {
    log.error({ error }, 'Failed to connect to Redis');
    throw error;
  }

  // Set up event listeners
  setupQueueEvents();

  log.info('Job queues initialized');
}

/**
 * Close all queues and Redis connection
 */
export async function closeQueues(): Promise<void> {
  log.info('Closing job queues');

  await Promise.all([
    captureProcessingQueue.close(),
    dictionaryGenerationQueue.close(),
    hashcatJobsQueue.close(),
    captureProcessingEvents.close(),
    dictionaryGenerationEvents.close(),
    hashcatJobsEvents.close(),
  ]);

  await redisConnection.quit();

  log.info('Job queues closed');
}

/**
 * Add a capture processing job
 */
export async function addCaptureProcessingJob(
  data: CaptureProcessingJobData
): Promise<string> {
  const job = await captureProcessingQueue.add('process-capture', data);
  log.info({ jobId: job.id, captureId: data.captureId }, 'Capture processing job added');
  return job.id!;
}

/**
 * Add a dictionary generation job
 */
export async function addDictionaryGenerationJob(
  data: DictionaryGenerationJobData
): Promise<string> {
  const job = await dictionaryGenerationQueue.add('generate-dictionary', data);
  log.info(
    { jobId: job.id, dictionaryId: data.dictionaryId },
    'Dictionary generation job added'
  );
  return job.id!;
}

/**
 * Add a hashcat job
 */
export async function addHashcatJob(data: HashcatJobData): Promise<string> {
  const job = await hashcatJobsQueue.add('run-hashcat', data);
  log.info({ jobId: job.id, hashcatJobId: data.jobId }, 'Hashcat job added');
  return job.id!;
}
