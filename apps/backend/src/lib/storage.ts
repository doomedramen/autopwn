import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import { env } from '../config';
import { logger } from './logger';

/**
 * File Storage Service
 *
 * Handles file uploads, storage, and cleanup
 * All paths are configured via environment variables
 */

const log = logger.child({ module: 'storage' });

/**
 * Storage directories
 */
export const STORAGE_DIRS = {
  uploads: env.UPLOAD_DIR,
  processed: path.join(env.UPLOAD_DIR, 'processed'),
  generated: path.join(env.UPLOAD_DIR, 'generated'),
  results: path.join(env.UPLOAD_DIR, 'results'),
} as const;

/**
 * Initialize storage directories
 * Creates all required directories if they don't exist
 */
export async function initializeStorage(): Promise<void> {
  log.info('Initializing storage directories');

  for (const [name, dir] of Object.entries(STORAGE_DIRS)) {
    try {
      await fs.mkdir(dir, { recursive: true });
      log.debug({ dir, name }, 'Storage directory created');
    } catch (error) {
      log.error({ error, dir, name }, 'Failed to create storage directory');
      throw error;
    }
  }

  log.info('Storage directories initialized');
}

/**
 * Generate unique filename with timestamp and random hash
 */
export function generateFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${randomHash}${ext}`;
}

/**
 * Save uploaded file to disk
 *
 * @param fileData - Stream or buffer of file data
 * @param originalFilename - Original filename from upload
 * @param directory - Target directory (from STORAGE_DIRS)
 * @returns Object with filename and full path
 */
export async function saveFile(
  fileData: NodeJS.ReadableStream | Buffer,
  originalFilename: string,
  directory: keyof typeof STORAGE_DIRS = 'uploads'
): Promise<{ filename: string; filePath: string; fileSize: number }> {
  const filename = generateFilename(originalFilename);
  const filePath = path.join(STORAGE_DIRS[directory], filename);

  log.debug({ originalFilename, filename, directory }, 'Saving file');

  try {
    if (Buffer.isBuffer(fileData)) {
      // Save buffer directly
      await fs.writeFile(filePath, fileData);
    } else {
      // Stream to disk
      const writeStream = createWriteStream(filePath);
      await pipeline(fileData, writeStream);
    }

    // Get file size
    const stats = await fs.stat(filePath);

    log.info(
      { filename, fileSize: stats.size, directory },
      'File saved successfully'
    );

    return {
      filename,
      filePath,
      fileSize: stats.size,
    };
  } catch (error) {
    log.error({ error, filename }, 'Failed to save file');
    throw error;
  }
}

/**
 * Delete file from disk
 */
export async function deleteFile(filePath: string): Promise<void> {
  log.debug({ filePath }, 'Deleting file');

  try {
    await fs.unlink(filePath);
    log.info({ filePath }, 'File deleted successfully');
  } catch (error) {
    // Ignore error if file doesn't exist
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error({ error, filePath }, 'Failed to delete file');
      throw error;
    }
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    log.error({ error, filePath }, 'Failed to get file size');
    throw error;
  }
}

/**
 * Clean up old files (for maintenance)
 *
 * @param directory - Directory to clean
 * @param maxAgeMs - Maximum age in milliseconds
 */
export async function cleanupOldFiles(
  directory: keyof typeof STORAGE_DIRS,
  maxAgeMs: number
): Promise<number> {
  const dir = STORAGE_DIRS[directory];
  log.debug({ directory, maxAgeMs }, 'Cleaning up old files');

  try {
    const files = await fs.readdir(dir);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtimeMs > maxAgeMs) {
        await deleteFile(filePath);
        deletedCount++;
      }
    }

    log.info({ directory, deletedCount }, 'Old files cleaned up');
    return deletedCount;
  } catch (error) {
    log.error({ error, directory }, 'Failed to clean up old files');
    throw error;
  }
}

/**
 * Validate file extension
 */
export function validateFileExtension(
  filename: string,
  allowedExtensions: string[]
): boolean {
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, maxSize: number): boolean {
  return size <= maxSize;
}
