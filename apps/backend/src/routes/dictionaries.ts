import { createHono } from '../lib/hono.js';
import { requireAuth } from '../middleware/auth.js';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, dictionaries } from '../db';
import { eq, and } from 'drizzle-orm';
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

// In-memory storage for chunked uploads (in production, use Redis or database)
const chunkedUploads = new Map<string, {
  filename: string;
  userId: string;
  chunks: Map<number, Buffer>;
  totalChunks: number;
  fileSize: number;
}>();

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

    const uploadId = randomUUID();
    chunkedUploads.set(uploadId, {
      filename,
      userId: user.id,
      chunks: new Map(),
      totalChunks,
      fileSize,
    });

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

    const upload = chunkedUploads.get(uploadId);
    if (!upload || upload.userId !== user.id) {
      return c.json({ error: 'Invalid upload session' }, 404);
    }

    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    upload.chunks.set(chunkIndex, chunkBuffer);

    return c.json({
      success: true,
      chunkIndex,
      receivedChunks: upload.chunks.size,
      totalChunks: upload.totalChunks,
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
    const upload = chunkedUploads.get(uploadId);

    if (!upload || upload.userId !== user.id) {
      return c.json({ error: 'Invalid upload session' }, 404);
    }

    if (upload.chunks.size !== upload.totalChunks) {
      return c.json({
        error: 'Missing chunks',
        received: upload.chunks.size,
        expected: upload.totalChunks
      }, 400);
    }

    // Check if dictionary already exists
    const existing = await db.select()
      .from(dictionaries)
      .where(and(
        eq(dictionaries.userId, user.id),
        eq(dictionaries.name, upload.filename)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Clean up upload session
      chunkedUploads.delete(uploadId);
      return c.json({ error: 'Dictionary already exists' }, 409);
    }

    // Ensure user's dictionary directory exists
    const userDictDir = join(env.DICTIONARIES_PATH, `user-${user.id}`);
    await fs.mkdir(userDictDir, { recursive: true });

    // Combine chunks in order
    const combinedBuffer = Buffer.concat(
      Array.from(upload.chunks.entries())
        .sort(([a], [b]) => a - b)
        .map(([, chunk]) => chunk)
    );

    // Write to file system
    const filepath = join(userDictDir, upload.filename);
    await fs.writeFile(filepath, combinedBuffer);

    // Add to database
    const [newDict] = await db.insert(dictionaries).values({
      userId: user.id,
      name: upload.filename,
      path: filepath,
      size: combinedBuffer.length,
    }).returning();

    // Clean up upload session
    chunkedUploads.delete(uploadId);

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
    const upload = chunkedUploads.get(uploadId);

    if (!upload || upload.userId !== user.id) {
      return c.json({ error: 'Invalid upload session' }, 404);
    }

    chunkedUploads.delete(uploadId);
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

    // This would typically calculate which jobs have used this dictionary
    // For now, return basic info
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

    return c.json({
      dictionary: dict[0],
      coverage: {
        jobsUsed: 0, // TODO: Calculate actual coverage
        successRate: 0, // TODO: Calculate actual success rate
      }
    });
  } catch (error) {
    console.error('Failed to get dictionary coverage:', error);
    return c.json({ error: 'Failed to get dictionary coverage' }, 500);
  }
});

export { dictionariesRouter };