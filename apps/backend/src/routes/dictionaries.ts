import { createHono } from '../lib/hono.js';
import { requireAuth } from '../middleware/auth.js';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, dictionaries, jobDictionaries, results } from '../db';
import { eq, and, count, sql } from 'drizzle-orm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { env } from '../config/env.js';
import { randomUUID } from 'crypto';

const dictionariesRouter = createHono();

// Apply authentication middleware
dictionariesRouter.use('*', requireAuth);

// Get all dictionaries for current user
dictionariesRouter.get('/', async (c) => {
  try {
    const user = c.get('user')!;

    const userDictionaries = await db.select()
      .from(dictionaries)
      .where(eq(dictionaries.userId, user.id))
      .orderBy(dictionaries.name);

    return c.json(userDictionaries);
  } catch (error) {
    console.error('Failed to fetch dictionaries:', error);
    return c.json({ error: 'Failed to fetch dictionaries' }, 500);
  }
});

/**
 * Filesystem-based chunked upload storage
 * Stores upload metadata and chunks in temporary directory
 */
interface ChunkedUploadMetadata {
  filename: string;
  userId: string;
  totalChunks: number;
  fileSize: number;
  createdAt: number;
  receivedChunks: number[];
}

/**
 * Get temporary directory for chunked uploads
 */
function getChunkedUploadDir(uploadId: string): string {
  return join(env.JOBS_PATH, 'uploads', uploadId);
}

/**
 * Get metadata file path for a chunked upload
 */
function getMetadataPath(uploadId: string): string {
  return join(getChunkedUploadDir(uploadId), 'metadata.json');
}

/**
 * Get chunk file path
 */
function getChunkPath(uploadId: string, chunkIndex: number): string {
  return join(getChunkedUploadDir(uploadId), `chunk-${chunkIndex}`);
}

/**
 * Save chunked upload metadata
 */
async function saveUploadMetadata(uploadId: string, metadata: ChunkedUploadMetadata): Promise<void> {
  const metadataPath = getMetadataPath(uploadId);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Load chunked upload metadata
 */
async function loadUploadMetadata(uploadId: string): Promise<ChunkedUploadMetadata | null> {
  try {
    const metadataPath = getMetadataPath(uploadId);
    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Clean up abandoned chunked uploads older than 24 hours
 */
async function cleanupAbandonedUploads(): Promise<void> {
  try {
    const uploadsDir = join(env.JOBS_PATH, 'uploads');

    // Ensure directory exists
    await fs.mkdir(uploadsDir, { recursive: true });

    const entries = await fs.readdir(uploadsDir, { withFileTypes: true });
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const uploadId = entry.name;
        const metadata = await loadUploadMetadata(uploadId);

        if (metadata && (now - metadata.createdAt) > maxAge) {
          const uploadDir = getChunkedUploadDir(uploadId);
          await fs.rm(uploadDir, { recursive: true, force: true });
          console.log(`🧹 Cleaned up abandoned upload: ${uploadId}`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to cleanup abandoned uploads:', error);
  }
}

// Start chunked upload
dictionariesRouter.post('/chunked/start', async (c) => {
  try {
    const user = c.get('user')!;
    const { filename, fileSize, totalChunks } = await c.req.json();

    if (!filename || !fileSize || !totalChunks) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate file extension
    const validExtensions = [
      '.txt', '.dict', '.wordlist', '.rule', '.rule2', '.hcchr2', '.hcmask', '.hcmask2',
      '.gz', '.bz2', '.zip', '.7z', '.rar', '.cap', '.hccapx', '.pcapng', '.16800', '.22000',
      '.pmkid', '.hccapx', '.ehc', '.john', '.pot', '.log', '.out', '.diz', '.list'
    ];
    const hasValidExtension = validExtensions.some(ext =>
      filename.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      return c.json({ error: 'Invalid file type' }, 400);
    }

    // Cleanup old uploads before starting new one
    await cleanupAbandonedUploads();

    const uploadId = randomUUID();
    const uploadDir = getChunkedUploadDir(uploadId);

    // Create upload directory
    await fs.mkdir(uploadDir, { recursive: true });

    // Save metadata
    const metadata: ChunkedUploadMetadata = {
      filename,
      userId: user.id,
      totalChunks,
      fileSize,
      createdAt: Date.now(),
      receivedChunks: [],
    };

    await saveUploadMetadata(uploadId, metadata);

    return c.json({
      success: true,
      uploadId,
      message: 'Chunked upload initialized',
    });
  } catch (error) {
    console.error('Failed to start chunked upload:', error);
    return c.json({ error: 'Failed to start chunked upload' }, 500);
  }
});

// Upload chunk
dictionariesRouter.post('/chunked/:uploadId/chunk/:chunkIndex', async (c) => {
  try {
    const user = c.get('user')!;
    const uploadId = c.req.param('uploadId');
    const chunkIndex = parseInt(c.req.param('chunkIndex'));
    const formData = await c.req.formData();
    const chunk = formData.get('chunk') as File;

    if (!chunk) {
      return c.json({ error: 'No chunk data provided' }, 400);
    }

    // Load metadata
    const metadata = await loadUploadMetadata(uploadId);
    if (!metadata || metadata.userId !== user.id) {
      return c.json({ error: 'Invalid upload session' }, 404);
    }

    // Save chunk to filesystem
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const chunkPath = getChunkPath(uploadId, chunkIndex);
    await fs.writeFile(chunkPath, chunkBuffer);

    // Update metadata
    if (!metadata.receivedChunks.includes(chunkIndex)) {
      metadata.receivedChunks.push(chunkIndex);
      metadata.receivedChunks.sort((a, b) => a - b);
      await saveUploadMetadata(uploadId, metadata);
    }

    return c.json({
      success: true,
      chunkIndex,
      receivedChunks: metadata.receivedChunks.length,
      totalChunks: metadata.totalChunks,
      message: 'Chunk uploaded successfully',
    });
  } catch (error) {
    console.error('Failed to upload chunk:', error);
    return c.json({ error: 'Failed to upload chunk' }, 500);
  }
});

// Complete chunked upload
dictionariesRouter.post('/chunked/:uploadId/complete', async (c) => {
  try {
    const user = c.get('user')!;
    const uploadId = c.req.param('uploadId');

    // Load metadata
    const metadata = await loadUploadMetadata(uploadId);
    if (!metadata || metadata.userId !== user.id) {
      return c.json({ error: 'Invalid upload session' }, 404);
    }

    if (metadata.receivedChunks.length !== metadata.totalChunks) {
      return c.json({
        error: 'Missing chunks',
        received: metadata.receivedChunks.length,
        expected: metadata.totalChunks
      }, 400);
    }

    // Check if dictionary already exists
    const existing = await db.select()
      .from(dictionaries)
      .where(and(
        eq(dictionaries.userId, user.id),
        eq(dictionaries.name, metadata.filename)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Clean up upload directory
      const uploadDir = getChunkedUploadDir(uploadId);
      await fs.rm(uploadDir, { recursive: true, force: true });
      return c.json({ error: 'Dictionary already exists' }, 409);
    }

    // Ensure user's dictionary directory exists
    const userDictDir = join(env.DICTIONARIES_PATH, `user-${user.id}`);
    await fs.mkdir(userDictDir, { recursive: true });

    // Combine chunks in order
    const chunks: Buffer[] = [];
    for (const chunkIndex of metadata.receivedChunks) {
      const chunkPath = getChunkPath(uploadId, chunkIndex);
      const chunkBuffer = await fs.readFile(chunkPath);
      chunks.push(chunkBuffer);
    }

    const combinedBuffer = Buffer.concat(chunks);

    // Write to file system
    const filepath = join(userDictDir, metadata.filename);
    await fs.writeFile(filepath, combinedBuffer);

    // Add to database
    const [newDict] = await db.insert(dictionaries).values({
      userId: user.id,
      name: metadata.filename,
      path: filepath,
      size: combinedBuffer.length,
    }).returning();

    // Clean up upload directory
    const uploadDir = getChunkedUploadDir(uploadId);
    await fs.rm(uploadDir, { recursive: true, force: true });

    return c.json({
      success: true,
      dictionary: newDict,
      message: 'Dictionary uploaded successfully',
    });
  } catch (error) {
    console.error('Failed to complete chunked upload:', error);
    return c.json({ error: 'Failed to complete chunked upload' }, 500);
  }
});

// Cancel chunked upload
dictionariesRouter.delete('/chunked/:uploadId', async (c) => {
  try {
    const user = c.get('user')!;
    const uploadId = c.req.param('uploadId');

    // Load metadata
    const metadata = await loadUploadMetadata(uploadId);
    if (!metadata || metadata.userId !== user.id) {
      return c.json({ error: 'Invalid upload session' }, 404);
    }

    // Clean up upload directory
    const uploadDir = getChunkedUploadDir(uploadId);
    await fs.rm(uploadDir, { recursive: true, force: true });

    return c.json({
      success: true,
      message: 'Upload cancelled successfully',
    });
  } catch (error) {
    console.error('Failed to cancel chunked upload:', error);
    return c.json({ error: 'Failed to cancel chunked upload' }, 500);
  }
});

// Create simple dictionary for testing
dictionariesRouter.post('/simple', async (c) => {
  try {
    const user = c.get('user')!;
    const { name, content } = await c.req.json();

    if (!name || !content) {
      return c.json({ error: 'Name and content are required' }, 400);
    }

    // Ensure user's dictionary directory exists
    const userDictDir = join(env.DICTIONARIES_PATH, `user-${user.id}`);
    await fs.mkdir(userDictDir, { recursive: true });

    // Create dictionary file
    const fileName = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    const filePath = join(userDictDir, fileName);
    await fs.writeFile(filePath, content, 'utf-8');

    // Create dictionary record
    const [newDictionary] = await db.insert(dictionaries).values({
      userId: user.id,
      name,
      path: filePath,
      size: Buffer.byteLength(content, 'utf-8'),
    }).returning();

    return c.json({
      success: true,
      dictionary: newDictionary,
      message: 'Dictionary created successfully',
    });
  } catch (error) {
    console.error('Failed to create dictionary:', error);
    return c.json({ error: 'Failed to create dictionary' }, 500);
  }
});

// Upload dictionary
dictionariesRouter.post('/', async (c) => {
  try {
    const user = c.get('user')!;
    const formData = await c.req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return c.json({ error: 'No files provided' }, 400);
    }

    const uploadedDictionaries = [];

    // Ensure user's dictionary directory exists
    const userDictDir = join(env.DICTIONARIES_PATH, `user-${user.id}`);
    await fs.mkdir(userDictDir, { recursive: true });

    for (const file of files) {
      try {
        // Validate file extension - support all hashcat-compatible formats
        const filename = file.name;
        const validExtensions = [
          '.txt', '.dict', '.wordlist', '.rule', '.rule2', '.hcchr2', '.hcmask', '.hcmask2',
          '.gz', '.bz2', '.zip', '.7z', '.rar', '.cap', '.hccapx', '.pcapng', '.16800', '.22000',
          '.pmkid', '.hccapx', '.ehc', '.john', '.pot', '.log', '.out', '.diz', '.list'
        ];
        const hasValidExtension = validExtensions.some(ext =>
          filename.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
          console.warn(`Invalid dictionary file type: ${filename}`);
          continue;
        }

        // Check if dictionary already exists for this user
        const existing = await db.select()
          .from(dictionaries)
          .where(and(
            eq(dictionaries.userId, user.id),
            eq(dictionaries.name, filename)
          ))
          .limit(1);

        if (existing.length > 0) {
          console.warn(`Dictionary already exists: ${filename}`);
          continue;
        }

        // Read file as buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Write to user's dictionary directory
        const filepath = join(userDictDir, filename);
        await fs.writeFile(filepath, buffer);

        // Add to database
        const [newDict] = await db.insert(dictionaries).values({
          userId: user.id,
          name: filename,
          path: filepath,
          size: buffer.length,
        }).returning();

        uploadedDictionaries.push(newDict);
        console.log(`Dictionary uploaded: ${filename}`);
      } catch (error) {
        console.error(`Failed to upload dictionary ${file.name}:`, error);
      }
    }

    return c.json({
      success: true,
      dictionaries: uploadedDictionaries,
      message: `Successfully uploaded ${uploadedDictionaries.length} dictionary(ies)`,
    });
  } catch (error) {
    console.error('Dictionary upload error:', error);
    return c.json({ error: 'Dictionary upload failed' }, 500);
  }
});

// Delete dictionary
dictionariesRouter.delete('/:id', async (c) => {
  try {
    const dictId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    // Verify dictionary ownership
    const dict = await db.select()
      .from(dictionaries)
      .where(and(
        eq(dictionaries.id, dictId),
        eq(dictionaries.userId, user.id)
      ))
      .limit(1);

    if (dict.length === 0) {
      return c.json({ error: 'Dictionary not found' }, 404);
    }

    // Delete file from filesystem
    try {
      await fs.unlink(dict[0].path);
    } catch (error) {
      console.warn(`Failed to delete dictionary file: ${dict[0].path}`, error);
    }

    // Delete from database
    await db.delete(dictionaries).where(eq(dictionaries.id, dictId));

    return c.json({
      success: true,
      message: 'Dictionary deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete dictionary:', error);
    return c.json({ error: 'Failed to delete dictionary' }, 500);
  }
});

// Get dictionary coverage
dictionariesRouter.get('/:id/coverage', async (c) => {
  try {
    const dictId = parseInt(c.req.param('id'));
    const user = c.get('user')!;

    // Get dictionary information
    const dict = await db.select()
      .from(dictionaries)
      .where(and(
        eq(dictionaries.id, dictId),
        eq(dictionaries.userId, user.id)
      ))
      .limit(1);

    if (dict.length === 0) {
      return c.json({ error: 'Dictionary not found' }, 404);
    }

    // Calculate how many jobs have used this dictionary
    const jobsUsedResult = await db.select({ count: count() })
      .from(jobDictionaries)
      .where(eq(jobDictionaries.dictionaryId, dictId));

    const jobsUsedCount = jobsUsedResult[0]?.count || 0;

    // Get all job IDs that used this dictionary
    const jobsWithDict = await db.select({ jobId: jobDictionaries.jobId })
      .from(jobDictionaries)
      .where(eq(jobDictionaries.dictionaryId, dictId));

    const jobIds = jobsWithDict.map(j => j.jobId);

    // Calculate success rate (jobs that resulted in at least one cracked password)
    let successfulJobs = 0;
    let totalCrackedPasswords = 0;

    if (jobIds.length > 0) {
      // Count jobs that produced results
      const jobsWithResults = await db.select({
        jobId: results.jobId,
        crackedCount: count()
      })
        .from(results)
        .where(and(
          sql`${results.jobId} IN (${sql.join(jobIds.map(id => sql`${id}`), sql`, `)})`,
          eq(results.userId, user.id)
        ))
        .groupBy(results.jobId);

      successfulJobs = jobsWithResults.length;
      totalCrackedPasswords = jobsWithResults.reduce((sum, j) => sum + (j.crackedCount as number), 0);
    }

    const successRate = jobsUsedCount > 0
      ? Math.round((successfulJobs / jobsUsedCount) * 100)
      : 0;

    return c.json({
      dictionary: dict[0],
      coverage: {
        jobsUsed: jobsUsedCount,
        jobsSuccessful: successfulJobs,
        successRate: successRate,
        totalCrackedPasswords: totalCrackedPasswords,
      }
    });
  } catch (error) {
    console.error('Failed to get dictionary coverage:', error);
    return c.json({ error: 'Failed to get dictionary coverage' }, 500);
  }
});

export { dictionariesRouter };