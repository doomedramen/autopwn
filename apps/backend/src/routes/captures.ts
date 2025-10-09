import { createHono } from '../lib/hono.js';
import { requireAuth } from '../middleware/auth.js';
import { db, pcapEssidMapping } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { env } from '../config/env.js';

const capturesRouter = createHono();

// Apply authentication middleware
capturesRouter.use('*', requireAuth);

// Get all PCAP captures for current user
capturesRouter.get('/', async (c) => {
  try {
    const user = c.get('user')!;

    // Get user's PCAP files from filesystem
    const userPcapDir = join(env.PCAPS_PATH, `user-${user.id}`);
    const files = [];

    try {
      const entries = await fs.readdir(userPcapDir);

      for (const entry of entries) {
        const filePath = join(userPcapDir, entry);
        const stats = await fs.stat(filePath);

        if (stats.isFile() && (entry.endsWith('.pcap') || entry.endsWith('.pcapng') || entry.endsWith('.cap'))) {
          // Get ESSID mappings for this PCAP file
          const essidMappings = await db.select()
            .from(pcapEssidMapping)
            .where(and(
              eq(pcapEssidMapping.userId, user.id),
              eq(pcapEssidMapping.pcapFilename, entry)
            ));

          files.push({
            filename: entry,
            size: stats.size,
            uploaded_at: stats.mtime.toISOString(),
            essids: essidMappings.map(mapping => mapping.essid),
            bssids: essidMappings
              .filter(mapping => mapping.bssid)
              .map(mapping => mapping.bssid!),
          });
        }
      }

      // Sort by upload time (newest first)
      files.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

    } catch (error) {
      console.log('PCAP directory not accessible:', error);
    }

    return c.json({
      success: true,
      captures: files,
      count: files.length,
    });
  } catch (error) {
    console.error('Error fetching captures:', error);
    return c.json({ error: 'Failed to fetch captures' }, 500);
  }
});

// Delete PCAP capture
capturesRouter.delete('/', async (c) => {
  try {
    const { filename } = await c.req.json();
    const user = c.get('user')!;

    if (!filename) {
      return c.json({ error: 'Filename is required' }, 400);
    }

    const userPcapDir = join(env.PCAPS_PATH, `user-${user.id}`);
    const filePath = join(userPcapDir, filename);

    try {
      // Delete the file
      await fs.unlink(filePath);

      // Delete associated ESSID mappings
      await db.delete(pcapEssidMapping)
        .where(and(
          eq(pcapEssidMapping.userId, user.id),
          eq(pcapEssidMapping.pcapFilename, filename)
        ));

      console.log(`Deleted PCAP file and mappings: ${filename}`);

      return c.json({
        success: true,
        message: `Successfully deleted ${filename} and its ESSID mappings`
      });
    } catch (error) {
      return c.json({ error: 'File not found or could not be deleted' }, 404);
    }
  } catch (error) {
    console.error('Error deleting capture:', error);
    return c.json({ error: 'Failed to delete capture' }, 500);
  }
});

export { capturesRouter };