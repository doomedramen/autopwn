import { Worker, Job } from 'bullmq';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { dictionaries } from '../db/schema';
import {
  redisConnection,
  QUEUE_NAMES,
  type DictionaryGenerationJobData,
} from '../lib/queue';
import { STORAGE_DIRS } from '../lib/storage';
import { env } from '../config';
import { logger } from '../lib/logger';
import type { DictionaryGenerationOptions } from '@autopwn/shared';
import { LEET_REPLACEMENTS } from '@autopwn/shared';

/**
 * Dictionary Generation Worker
 *
 * Generates custom wordlists based on keywords and variations
 * Uses various techniques: case variations, leet speak, padding, etc.
 */

const log = logger.child({ module: 'worker:dictionary-generation' });
const execAsync = promisify(exec);

/**
 * Generate dictionary from keywords
 */
async function generateDictionaryJob(job: Job<DictionaryGenerationJobData>) {
  const { dictionaryId, userId, options } = job.data;

  log.info({ jobId: job.id, dictionaryId }, 'Dictionary generation started');

  try {
    // Update dictionary status to generating
    await db
      .update(dictionaries)
      .set({ status: 'generating' })
      .where(eq(dictionaries.id, dictionaryId));

    const genOptions = options as DictionaryGenerationOptions;

    // Validate options
    if (!genOptions.keywords || genOptions.keywords.length === 0) {
      throw new Error('No keywords provided');
    }

    if (genOptions.keywords.length > env.MAX_GENERATION_KEYWORDS) {
      throw new Error(`Too many keywords (max: ${env.MAX_GENERATION_KEYWORDS})`);
    }

    // Generate variations
    const words = new Set<string>();

    for (const keyword of genOptions.keywords) {
      // Add base keyword
      words.add(keyword);

      // Case variations
      if (genOptions.includeLowercase) {
        words.add(keyword.toLowerCase());
      }
      if (genOptions.includeUppercase) {
        words.add(keyword.toUpperCase());
      }
      if (genOptions.includeMixedCase) {
        words.add(capitalizeFirst(keyword));
        words.add(keyword.toLowerCase());
      }

      // Leet speak variations
      if (genOptions.leetSpeak) {
        const leetVariations = generateLeetVariations(keyword);
        leetVariations.forEach((v) => words.add(v));
      }

      // Number padding
      if (genOptions.numberPadding) {
        const [min, max] = genOptions.numberRange;
        for (let num = min; num <= max; num++) {
          words.add(`${keyword}${num}`);
          words.add(`${num}${keyword}`);
        }
      }

      // Special character padding
      if (genOptions.specialCharPadding) {
        for (const char of genOptions.specialChars) {
          words.add(`${keyword}${char}`);
          words.add(`${char}${keyword}`);
        }
      }
    }

    // Filter by length
    const filtered = Array.from(words).filter(
      (w) => w.length >= genOptions.minLength && w.length <= genOptions.maxLength
    );

    // Generate output file
    const outputFilename = `${dictionaryId}.txt`;
    const outputPath = path.join(STORAGE_DIRS.generated, outputFilename);

    await fs.writeFile(outputPath, filtered.join('\n'), 'utf-8');

    // Get file stats
    const stats = await fs.stat(outputPath);

    // Check size limit
    if (stats.size > env.MAX_GENERATED_DICT_SIZE) {
      await fs.unlink(outputPath);
      throw new Error(
        `Generated dictionary too large: ${stats.size} bytes (max: ${env.MAX_GENERATED_DICT_SIZE})`
      );
    }

    // Update dictionary status to ready
    await db
      .update(dictionaries)
      .set({
        status: 'ready',
        filePath: outputPath,
        fileSize: stats.size,
        lineCount: filtered.length,
        completedAt: new Date(),
      })
      .where(eq(dictionaries.id, dictionaryId));

    log.info(
      { jobId: job.id, dictionaryId, lineCount: filtered.length, fileSize: stats.size },
      'Dictionary generation completed'
    );

    return { dictionaryId, lineCount: filtered.length, fileSize: stats.size };
  } catch (error) {
    log.error({ error, jobId: job.id, dictionaryId }, 'Dictionary generation failed');

    // Update dictionary status to failed
    await db
      .update(dictionaries)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(dictionaries.id, dictionaryId));

    throw error;
  }
}

/**
 * Generate leet speak variations of a word
 */
function generateLeetVariations(word: string): string[] {
  const variations: string[] = [];
  const chars = word.toLowerCase().split('');

  // Generate all possible leet combinations (this can explode quickly)
  // We'll limit to simple single-character replacements
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const replacements = LEET_REPLACEMENTS[char];

    if (replacements) {
      for (const replacement of replacements) {
        const variant = [...chars];
        variant[i] = replacement;
        variations.push(variant.join(''));
      }
    }
  }

  return variations;
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Create and start the dictionary generation worker
 */
export function createDictionaryGenerationWorker() {
  const worker = new Worker<DictionaryGenerationJobData>(
    QUEUE_NAMES.DICTIONARY_GENERATION,
    generateDictionaryJob,
    {
      connection: redisConnection,
      concurrency: 3, // Generate 3 dictionaries simultaneously
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

  log.info('Dictionary generation worker started');

  return worker;
}
