import { Queue, Worker, QueueEvents } from 'bullmq'
import Redis from 'ioredis'
import { env } from '@/config/env'

// Create Redis connection
const redisConnection = new Redis({
  host: env.REDIS_HOST,
  port: parseInt(env.REDIS_PORT),
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  retryStrategy: (times) => {
    // Exponential backoff: start with 100ms, double each time, max 30 seconds
    const delay = Math.min(100 * Math.pow(2, times - 1), 30000);
    return delay;
  },
  connectTimeout: 30000, // 30 seconds
  commandTimeout: 10000, // 10 seconds
})

// Queue names
export const QUEUE_NAMES = {
  PCAP_PROCESSING: 'pcap-processing',
  HASHCAT_CRACKING: 'hashcat-cracking',
  DICTIONARY_GENERATION: 'dictionary-generation',
  FILE_CLEANUP: 'file-cleanup',
} as const

// Create queues
export const pcapProcessingQueue = new Queue(QUEUE_NAMES.PCAP_PROCESSING, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
})

export const hashcatCrackingQueue = new Queue(QUEUE_NAMES.HASHCAT_CRACKING, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
})

export const dictionaryGenerationQueue = new Queue(QUEUE_NAMES.DICTIONARY_GENERATION, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 30,
    removeOnFail: 10,
    attempts: 1,
  },
})

export const fileCleanupQueue = new Queue(QUEUE_NAMES.FILE_CLEANUP, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 20,
    attempts: 3,
  },
})

// Queue events for monitoring
export const pcapQueueEvents = new QueueEvents(QUEUE_NAMES.PCAP_PROCESSING, {
  connection: {
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT),
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    lazyConnect: true,
  },
})

export const hashcatQueueEvents = new QueueEvents(QUEUE_NAMES.HASHCAT_CRACKING, {
  connection: {
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT),
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    lazyConnect: true,
  },
})

export const dictionaryQueueEvents = new QueueEvents(QUEUE_NAMES.DICTIONARY_GENERATION, {
  connection: {
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT),
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    lazyConnect: true,
  },
})

export const fileCleanupQueueEvents = new QueueEvents(QUEUE_NAMES.FILE_CLEANUP, {
  connection: {
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT),
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    lazyConnect: true,
  },
})

// Job types
export interface PCAPProcessingJob {
  networkId: string
  filePath: string
  originalFilename: string
  userId: string
}

export interface HashcatCrackingJob {
  jobId: string
  networkId: string
  dictionaryId: string
  handshakePath: string
  dictionaryPath: string
  attackMode: 'pmkid' | 'handshake'
  userId: string
}

export interface DictionaryGenerationJob {
  name: string
  baseWords?: string[]
  rules?: string[]
  transformations?: string[]
  userId: string
}

export interface FileCleanupJob {
  filePaths: string[]
  olderThan?: Date
  userId?: string
}

// Helper functions to add jobs
export const addPCAPProcessingJob = async (data: PCAPProcessingJob) => {
  return await pcapProcessingQueue.add('process-pcap', data, {
    priority: 10,
    delay: 0,
  })
}

export const addHashcatCrackingJob = async (data: HashcatCrackingJob) => {
  return await hashcatCrackingQueue.add('crack-handshake', data, {
    priority: 5,
    delay: 0,
  })
}

export const addDictionaryGenerationJob = async (data: DictionaryGenerationJob) => {
  return await dictionaryGenerationQueue.add('generate-dictionary', data, {
    priority: 8,
    delay: 0,
  })
}

export const addFileCleanupJob = async (data: FileCleanupJob) => {
  return await fileCleanupQueue.add('cleanup-files', data, {
    priority: 1,
    delay: 1000 * 60 * 60, // 1 hour delay
  })
}

// Graceful shutdown
export const closeQueues = async () => {
  await Promise.all([
    pcapProcessingQueue.close(),
    hashcatCrackingQueue.close(),
    dictionaryGenerationQueue.close(),
    fileCleanupQueue.close(),
    redisConnection.quit(),
  ])
}

// Health check
export const checkQueueHealth = async () => {
  try {
    const redisStatus = await redisConnection.ping()
    if (redisStatus !== 'PONG') {
      throw new Error('Redis connection failed')
    }

    const queueCounts = await Promise.all([
      pcapProcessingQueue.getWaiting(),
      hashcatCrackingQueue.getWaiting(),
      dictionaryGenerationQueue.getWaiting(),
      fileCleanupQueue.getWaiting(),
    ])

    return {
      status: 'healthy',
      redis: redisStatus,
      queues: {
        [QUEUE_NAMES.PCAP_PROCESSING]: queueCounts[0].length,
        [QUEUE_NAMES.HASHCAT_CRACKING]: queueCounts[1].length,
        [QUEUE_NAMES.DICTIONARY_GENERATION]: queueCounts[2].length,
        [QUEUE_NAMES.FILE_CLEANUP]: queueCounts[3].length,
      },
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}