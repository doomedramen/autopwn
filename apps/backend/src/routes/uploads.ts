import { createHono } from '../lib/hono';
import { requireAuth } from '../middleware/auth';
import { uploadService } from '../services/upload';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const uploadsRouter = createHono();

// Test endpoint (no authentication required)
uploadsRouter.post('/test', async (c) => {
  try {
    // For testing, we'll use a mock user ID if not authenticated
    let user = c.get('user');
    if (!user) {
      user = { id: 'test-user-1', email: 'test@example.com', name: 'Test User', emailVerified: false, image: null, createdAt: new Date(), updatedAt: new Date() };
    }

    const { filename, content } = await c.req.json();

    if (!filename) {
      return c.json({ error: 'Filename is required' }, 400);
    }

    // Ensure filename has valid extension
    const validExtensions = ['.pcap', '.pcapng', '.cap'];
    const hasValidExtension = validExtensions.some(ext =>
      filename.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      return c.json({ error: 'Invalid file extension. Must be .pcap, .pcapng, or .cap' }, 400);
    }

    const { promises: fs } = await import('fs');
    const { join: path } = await import('path');
    const { env } = await import('../config/env');

    // Create user's upload directory
    if (!user) return c.json({ error: 'User not found' }, 401);

    const userUploadDir = path(env.PCAPS_PATH, `user-${user.id}`);
    await fs.mkdir(userUploadDir, { recursive: true });

    // Create a mock PCAP file (just text content for testing)
    const filepath = path(userUploadDir, filename);
    const mockContent = content || `d4 c3 b2 a1 02 00 04 00 a1 b2 c3 d4 00 00 00 00 ${filename} mock pcap data for testing purposes`;
    await fs.writeFile(filepath, mockContent, 'utf-8');

    // Create mock ESSID mapping
    // For now, just log the mapping - database integration will be added later
    console.log(`ESSID mapping created for user: ${user.id}, filename: ${filename}`);
    console.log(`- ESSID: TestNetwork`);
    console.log(`- BSSID: 00:11:22:33:44:55`);
    // TODO: Add database insertion once we have a local database schema setup

    return c.json({
      success: true,
      filename,
      filepath,
      message: `Test PCAP file created successfully`,
    });
  } catch (error) {
    console.error('Test upload error:', error);
    return c.json(
      { error: 'Test upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Apply authentication middleware to all other routes
uploadsRouter.use('*', requireAuth);

const uploadSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, "At least one file is required"),
});

// Upload PCAP files
uploadsRouter.post('/files', async (c) => {
  try {
    const user = c.get('user')!;
    const formData = await c.req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return c.json({ error: 'No files provided' }, 400);
    }

    const result = await uploadService.handlePcapUpload(files, user.id);

    return c.json({
      success: true,
      uploaded: result.uploadedFiles,
      message: `Successfully uploaded ${result.uploadedFiles.length} file(s)`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

export { uploadsRouter };