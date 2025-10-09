import { createHono } from '../lib/hono.js';
import { requireAuth } from '../middleware/auth.js';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, dictionaries } from '../db';
import { eq, and } from 'drizzle-orm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { env } from '../config/env.js';

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
        // Validate file extension
        const filename = file.name;
        const validExtensions = ['.txt', '.dict', '.wordlist'];
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