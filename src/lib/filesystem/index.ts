import { promises as fs } from 'node:fs';
import { createReadStream, createWriteStream } from 'node:fs';
import { join, resolve, dirname, extname } from 'path';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { FileUploadOptions, DirectoryOptions } from '@/types';

export class FileSystemManager {
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = resolve(basePath);
  }

  /**
   * Ensure a directory exists, create if missing
   */
  async ensureDirectory(path: string, options: DirectoryOptions = { createIfMissing: false }): Promise<string> {
    const fullPath = resolve(this.basePath, path);

    if (options.createIfMissing) {
      await fs.mkdir(fullPath, {
        recursive: options.recursive ?? true,
        mode: options.permissions ? parseInt(options.permissions, 8) : undefined
      });
    }

    return fullPath;
  }

  /**
   * Check if a file or directory exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(resolve(this.basePath, path));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async getStats(path: string) {
    try {
      return await fs.stat(resolve(this.basePath, path));
    } catch {
      return null;
    }
  }

  /**
   * Calculate file checksum (SHA-256)
   */
  async calculateChecksum(filePath: string): Promise<string> {
    const fullPath = resolve(this.basePath, filePath);
    const fileBuffer = await fs.readFile(fullPath);
    return createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Validate file upload
   */
  async validateFileUpload(
    filePath: string,
    options: FileUploadOptions
  ): Promise<{ valid: boolean; error?: string; size?: number; checksum?: string }> {
    const fullPath = resolve(this.basePath, filePath);

    try {
      // Check if file exists
      const stats = await fs.stat(fullPath);

      // Check file size
      if (stats.size > options.maxSize) {
        return {
          valid: false,
          error: `File size ${(stats.size / 1024 / 1024).toFixed(2)}MB exceeds maximum size of ${(options.maxSize / 1024 / 1024).toFixed(2)}MB`
        };
      }

      // Check file extension
      const fileExt = extname(fullPath).toLowerCase();
      if (!options.allowedExtensions.includes(fileExt)) {
        return {
          valid: false,
          error: `File extension ${fileExt} not allowed. Allowed extensions: ${options.allowedExtensions.join(', ')}`
        };
      }

      // Generate checksum if requested
      let checksum: string | undefined;
      if (options.generateChecksum) {
        checksum = await this.calculateChecksum(fullPath);
      }

      // Validate content if requested (basic check - ensure it's not empty)
      if (options.validateContent && stats.size === 0) {
        return {
          valid: false,
          error: 'File is empty'
        };
      }

      return {
        valid: true,
        size: stats.size,
        checksum
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error during file validation'
      };
    }
  }

  /**
   * Copy file with progress tracking
   */
  async copyFileWithProgress(
    sourcePath: string,
    destinationPath: string,
    onProgress?: (bytesCopied: number, totalBytes: number) => void
  ): Promise<{ success: boolean; error?: string; bytesCopied?: number }> {
    const fullSourcePath = resolve(this.basePath, sourcePath);
    const fullDestPath = resolve(this.basePath, destinationPath);

    try {
      // Ensure destination directory exists
      await fs.mkdir(dirname(fullDestPath), { recursive: true });

      // Get source file stats
      const sourceStats = await fs.stat(fullSourcePath);

      // Use streams for large files to track progress
      if (sourceStats.size > 10 * 1024 * 1024) { // 10MB threshold
        return await this.copyLargeFile(fullSourcePath, fullDestPath, onProgress);
      }

      // For smaller files, use simple copy
      await fs.copyFile(fullSourcePath, fullDestPath);

      return {
        success: true,
        bytesCopied: sourceStats.size
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during file copy'
      };
    }
  }

  /**
   * Copy large file with progress tracking using streams
   */
  private async copyLargeFile(
    sourcePath: string,
    destinationPath: string,
    onProgress?: (bytesCopied: number, totalBytes: number) => void
  ): Promise<{ success: boolean; error?: string; bytesCopied?: number }> {
    try {
      // Ensure destination directory exists
      await fs.mkdir(dirname(destinationPath), { recursive: true });

      const sourceStats = await fs.stat(sourcePath);
      const totalBytes = sourceStats.size;
      let bytesCopied = 0;
      const startTime = Date.now();

      // Create streams
      const readStream = createReadStream(sourcePath);
      const writeStream = createWriteStream(destinationPath);

      // Create progress tracking transform stream
      const { Transform } = await import('stream');
      const progressTransform = new Transform({
        transform(chunk: Buffer, encoding, callback) {
          bytesCopied += chunk.length;

          // Call progress callback if provided
          if (onProgress) {
            onProgress(bytesCopied, totalBytes);
          }

          callback(null, chunk);
        }
      });

      // Copy using streams with progress tracking
      await pipeline(readStream, progressTransform, writeStream);

      return {
        success: true,
        bytesCopied: totalBytes
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during large file copy'
      };
    }
  }

  /**
   * Calculate file checksum using streaming for memory efficiency
   */
  async calculateChecksumStreaming(
    filePath: string,
    algorithm: string = 'sha256',
    onProgress?: (bytesProcessed: number, totalBytes: number) => void
  ): Promise<string> {
    const fullPath = resolve(this.basePath, filePath);
    const stats = await fs.stat(fullPath);
    const totalBytes = stats.size;
    let bytesProcessed = 0;

    return new Promise((resolve, reject) => {
      const hash = createHash(algorithm);
      const readStream = createReadStream(fullPath);

      readStream.on('data', (chunk: Buffer | string) => {
        hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        bytesProcessed += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);

        if (onProgress) {
          onProgress(bytesProcessed, totalBytes);
        }
      });

      readStream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      readStream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Count lines in a text file using streaming
   */
  async countLinesStreaming(
    filePath: string,
    encoding: BufferEncoding = 'utf8',
    onProgress?: (linesProcessed: number, bytesProcessed: number, totalBytes: number) => void
  ): Promise<number> {
    const fullPath = resolve(this.basePath, filePath);
    const stats = await fs.stat(fullPath);
    const totalBytes = stats.size;
    let linesProcessed = 0;
    let bytesProcessed = 0;

    return new Promise((resolve, reject) => {
      const readStream = createReadStream(fullPath, { encoding });
      let buffer = '';

      readStream.on('data', (chunk: Buffer | string) => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString(encoding) : chunk;
        buffer += text;
        bytesProcessed += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);

        // Count lines in buffer
        const lines = buffer.split('\n');
        linesProcessed += lines.length - 1;

        // Keep the last partial line
        buffer = lines[lines.length - 1] || '';

        if (onProgress) {
          onProgress(linesProcessed, bytesProcessed, totalBytes);
        }
      });

      readStream.on('end', () => {
        // Count the final line if buffer is not empty
        if (buffer.length > 0) {
          linesProcessed += 1;
        }

        resolve(linesProcessed);
      });

      readStream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Stream file copy with resumable capability
   */
  async copyFileStreaming(
    sourcePath: string,
    destinationPath: string,
    options: {
      chunkSize?: number;
      onProgress?: (bytesCopied: number, totalBytes: number) => void;
      resume?: boolean;
    } = {}
  ): Promise<{ success: boolean; error?: string; bytesCopied?: number }> {
    const { chunkSize = 1024 * 1024, onProgress, resume = false } = options; // 1MB default chunks
    const fullSourcePath = resolve(this.basePath, sourcePath);
    const fullDestPath = resolve(this.basePath, destinationPath);

    try {
      // Ensure destination directory exists
      await fs.mkdir(dirname(fullDestPath), { recursive: true });

      const sourceStats = await fs.stat(fullSourcePath);
      const totalBytes = sourceStats.size;
      let bytesCopied = 0;

      // Check if we should resume
      if (resume) {
        try {
          const destStats = await fs.stat(fullDestPath);
          bytesCopied = destStats.size;
        } catch {
          // Destination doesn't exist, start from beginning
        }
      }

      // Open files
      const sourceFd = await fs.open(fullSourcePath, 'r');
      const destFd = await fs.open(fullDestPath, resume ? 'a' : 'w');

      try {
        // Seek to resume position
        if (resume && bytesCopied > 0) {
          await sourceFd.read(Buffer.alloc(0), 0, 0, bytesCopied);
        }

        // Copy in chunks
        const buffer = Buffer.alloc(chunkSize);
        while (bytesCopied < totalBytes) {
          const { bytesRead } = await sourceFd.read(buffer, 0, chunkSize, bytesCopied);

          if (bytesRead === 0) break;

          await destFd.write(buffer, 0, bytesRead);
          bytesCopied += bytesRead;

          // Report progress
          if (onProgress) {
            onProgress(bytesCopied, totalBytes);
          }
        }

        return {
          success: true,
          bytesCopied: totalBytes
        };
      } finally {
        await sourceFd.close();
        await destFd.close();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during streaming copy'
      };
    }
  }

  /**
   * Validate file using streaming (for large files)
   */
  async validateFileStreaming(
    filePath: string,
    options: {
      maxSize?: number;
      allowedExtensions?: string[];
      encoding?: BufferEncoding;
      sampleSize?: number;
    } = {}
  ): Promise<{
    valid: boolean;
    error?: string;
    metadata?: {
      size: number;
      extension: string;
      encoding?: string;
      isText?: boolean;
      sample?: string;
    };
  }> {
    const { maxSize, allowedExtensions, encoding = 'utf8', sampleSize = 1024 } = options;
    const fullPath = resolve(this.basePath, filePath);

    try {
      // Get file stats
      const stats = await fs.stat(fullPath);
      const size = stats.size;
      const extension = extname(fullPath).toLowerCase();

      // Check file size
      if (maxSize && size > maxSize) {
        return {
          valid: false,
          error: `File size ${size} exceeds maximum allowed size ${maxSize}`
        };
      }

      // Check file extension
      if (allowedExtensions && !allowedExtensions.includes(extension)) {
        return {
          valid: false,
          error: `File extension ${extension} not allowed`
        };
      }

      const metadata = {
        size,
        extension,
        encoding: undefined as BufferEncoding | undefined,
        isText: false,
        sample: undefined as string | undefined
      };

      // Sample file content for text detection
      if (size > 0) {
        const sampleBytes = Math.min(sampleSize, size);
        const buffer = Buffer.alloc(sampleBytes);
        const fd = await fs.open(fullPath, 'r');

        try {
          await fd.read(buffer, 0, sampleBytes, 0);

          // Try to decode as text
          try {
            const sample = buffer.toString(encoding, 0, buffer.indexOf(0) || sampleBytes);
            metadata.sample = sample;
            metadata.encoding = encoding;

            // Check if content appears to be text
            const printableChars = sample.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').length;
            metadata.isText = sample.length > 0 && (printableChars / sample.length) > 0.9;
          } catch {
            metadata.isText = false;
          }
        } finally {
          await fd.close();
        }
      }

      return {
        valid: true,
        metadata
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error during validation'
      };
    }
  }

  /**
   * Compress file using streaming
   */
  async compressFileStreaming(
    sourcePath: string,
    destinationPath: string,
    algorithm: 'gzip' | 'deflate' | 'brotli' = 'gzip',
    onProgress?: (bytesProcessed: number, totalBytes: number) => void
  ): Promise<{ success: boolean; error?: string; compressedSize?: number }> {
    const zlib = await import('zlib');
    const fullSourcePath = resolve(this.basePath, sourcePath);
    const fullDestPath = resolve(this.basePath, destinationPath);

    try {
      await fs.mkdir(dirname(fullDestPath), { recursive: true });

      const stats = await fs.stat(fullSourcePath);
      const totalBytes = stats.size;
      let bytesProcessed = 0;

      return new Promise((resolve, reject) => {
        const readStream = createReadStream(fullSourcePath);
        const writeStream = createWriteStream(fullDestPath);

        // Select compression algorithm
        let compressStream;
        switch (algorithm) {
          case 'gzip':
            compressStream = zlib.createGzip();
            break;
          case 'deflate':
            compressStream = zlib.createDeflate();
            break;
          case 'brotli':
            compressStream = zlib.createBrotliCompress();
            break;
          default:
            compressStream = zlib.createGzip();
        }

        // Track progress
        readStream.on('data', (chunk: Buffer | string) => {
          bytesProcessed += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
          if (onProgress) {
            onProgress(bytesProcessed, totalBytes);
          }
        });

        // Get compressed size
        let compressedSize = 0;
        compressStream.on('data', (chunk: Buffer | string) => {
          compressedSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
        });

        // Pipe streams
        readStream
          .pipe(compressStream!)
          .pipe(writeStream)
          .on('finish', () => {
            resolve({
              success: true,
              compressedSize
            });
          })
          .on('error', (error) => {
            reject(error);
          });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during compression'
      };
    }
  }

  /**
   * Move file to destination
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<{ success: boolean; error?: string }> {
    const fullSourcePath = resolve(this.basePath, sourcePath);
    const fullDestPath = resolve(this.basePath, destinationPath);

    try {
      // Ensure destination directory exists
      await fs.mkdir(dirname(fullDestPath), { recursive: true });

      // Move file
      await fs.rename(fullSourcePath, fullDestPath);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during file move'
      };
    }
  }

  /**
   * Delete file or directory
   */
  async delete(path: string, options: { force?: boolean; recursive?: boolean } = {}): Promise<{ success: boolean; error?: string }> {
    const fullPath = resolve(this.basePath, path);

    try {
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        if (options.recursive) {
          await fs.rm(fullPath, { recursive: true, force: options.force });
        } else {
          // Check if directory is empty
          const entries = await fs.readdir(fullPath);
          if (entries.length === 0) {
            await fs.rmdir(fullPath);
          } else {
            return {
              success: false,
              error: 'Directory is not empty. Use recursive option to delete non-empty directories.'
            };
          }
        }
      } else {
        await fs.unlink(fullPath);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during deletion'
      };
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(
    path: string,
    options: { includeHidden?: boolean; recursive?: boolean } = {}
  ): Promise<{ files: string[]; directories: string[]; error?: string }> {
    const fullPath = resolve(this.basePath, path);

    try {
      if (options.recursive) {
        return await this.listDirectoryRecursive(fullPath, options.includeHidden);
      }

      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      const files: string[] = [];
      const directories: string[] = [];

      for (const entry of entries) {
        // Skip hidden files unless requested
        if (!options.includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        if (entry.isDirectory()) {
          directories.push(entry.name);
        } else {
          files.push(entry.name);
        }
      }

      return { files, directories };
    } catch (error) {
      return {
        files: [],
        directories: [],
        error: error instanceof Error ? error.message : 'Unknown error during directory listing'
      };
    }
  }

  /**
   * Recursively list directory contents
   */
  private async listDirectoryRecursive(
    basePath: string,
    includeHidden: boolean = false,
    currentPath: string = ''
  ): Promise<{ files: string[]; directories: string[]; error?: string }> {
    const fullPath = join(basePath, currentPath);
    const files: string[] = [];
    const directories: string[] = [];

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      for (const entry of entries) {
        const relativePath = currentPath ? join(currentPath, entry.name) : entry.name;

        // Skip hidden files unless requested
        if (!includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        if (entry.isDirectory()) {
          directories.push(relativePath);
          const subResult = await this.listDirectoryRecursive(basePath, includeHidden, relativePath);
          files.push(...subResult.files);
          directories.push(...subResult.directories);
        } else {
          files.push(relativePath);
        }
      }

      return { files, directories };
    } catch (error) {
      return {
        files: [],
        directories: [],
        error: error instanceof Error ? error.message : 'Unknown error during recursive directory listing'
      };
    }
  }

  /**
   * Get directory size
   */
  async getDirectorySize(path: string): Promise<{ size: number; fileCount: number; error?: string }> {
    const fullPath = resolve(this.basePath, path);
    let totalSize = 0;
    let fileCount = 0;

    try {
      const result = await this.listDirectory(path, { recursive: true, includeHidden: false });

      if (result.error) {
        return { size: 0, fileCount: 0, error: result.error };
      }

      for (const file of result.files) {
        const filePath = join(fullPath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        fileCount++;
      }

      return { size: totalSize, fileCount };
    } catch (error) {
      return {
        size: 0,
        fileCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error calculating directory size'
      };
    }
  }

  /**
   * Clean up old files in a directory
   */
  async cleanupOldFiles(
    path: string,
    olderThanDays: number,
    options: { dryRun?: boolean; pattern?: RegExp } = {}
  ): Promise<{ deleted: string[]; error?: string }> {
    const fullPath = resolve(this.basePath, path);
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const deleted: string[] = [];

    try {
      const result = await this.listDirectory(path, { recursive: true });

      if (result.error) {
        return { deleted: [], error: result.error };
      }

      for (const file of result.files) {
        // Skip files that don't match pattern if provided
        if (options.pattern && !options.pattern.test(file)) {
          continue;
        }

        const filePath = join(fullPath, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          if (!options.dryRun) {
            await fs.unlink(filePath);
          }
          deleted.push(file);
        }
      }

      return { deleted };
    } catch (error) {
      return {
        deleted: [],
        error: error instanceof Error ? error.message : 'Unknown error during cleanup'
      };
    }
  }
}

// Create a default instance
export const fsManager = new FileSystemManager();