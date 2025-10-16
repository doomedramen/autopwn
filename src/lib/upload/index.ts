import { promises as fs } from 'fs';
import { join, resolve, dirname, basename, extname } from 'path';
import { FileSystemManager } from '@/lib/filesystem';
import { ToolResult } from '@/types';
import { logError, logInfo, logDebug, logWarn } from '@/lib/logger';

export type ProcessingResult = Record<string, unknown>;

export interface UploadConfig {
  type: 'pcap' | 'dictionary' | 'general';
  maxSize: number;
  allowedExtensions: string[];
  validation: {
    generateChecksum: boolean;
    validateContent: boolean;
    streamingRequired: boolean;
  };
  processing: {
    extractMetadata: boolean;
    backgroundProcessing: boolean;
    progressTracking: boolean;
  };
  customProcessing?: (
    filePath: string,
    config: UploadConfig
  ) => Promise<ProcessingResult>;
}

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  stage: 'uploading' | 'validating' | 'processing' | 'completed' | 'error';
  message?: string;
  timestamp?: number;
}

export interface UploadResult {
  success: boolean;
  fileId: string;
  originalName: string;
  savedPath: string;
  size: number;
  checksum?: string;
  metadata?: ProcessingResult;
  processingResult?: ProcessingResult;
  error?: string;
  uploadTime: number;
}

export class UploadService {
  private fsManager: FileSystemManager;
  private activeUploads: Map<string, UploadProgress>;

  constructor(basePath?: string) {
    this.fsManager = new FileSystemManager(basePath);
    this.activeUploads = new Map();
  }

  /**
   * Handle file upload with streaming support and configurable processing
   */
  async handleUpload(
    file: File | Buffer,
    config: UploadConfig,
    onProgress?: (progress: UploadProgress) => void,
    pregeneratedFileId?: string
  ): Promise<ToolResult<UploadResult>> {
    const startTime = Date.now();
    const fileId = pregeneratedFileId || this.generateFileId();

    try {
      // Determine upload strategy based on file type and size
      const isLargeFile = this.isLargeFile(file, config);
      const uploadPath = this.getUploadPath(
        fileId,
        file instanceof File ? file.name : 'unknown',
        config
      );

      // Initialize progress tracking
      const progress: UploadProgress = {
        bytesUploaded: 0,
        totalBytes: this.getFileSize(file),
        percentage: 0,
        speed: 0,
        eta: 0,
        stage: 'uploading',
      };

      this.activeUploads.set(fileId, progress);
      onProgress?.(progress);

      // Stage 1: Upload file
      let savedPath: string;
      if (isLargeFile || config.validation.streamingRequired) {
        savedPath = await this.streamUpload(file, uploadPath);
      } else {
        savedPath = await this.simpleUpload(
          file,
          uploadPath,
          fileId,
          onProgress
        );
      }

      // Update progress to validation stage
      progress.stage = 'validating';
      progress.message = 'Validating file format and integrity...';
      this.activeUploads.set(fileId, progress);
      onProgress?.(progress);

      // Stage 2: Validate file
      const validationResult = await this.validateUploadedFile(
        savedPath,
        config
      );
      if (!validationResult.valid) {
        await this.cleanupUpload(savedPath);
        return {
          success: false,
          stdout: '',
          stderr: validationResult.error || 'Validation failed',
          exitCode: 1,
          executionTime: Date.now() - startTime,
        };
      }

      // Stage 3: Process file based on type
      let processingResult: ProcessingResult = {};
      if (config.processing.extractMetadata || config.customProcessing) {
        progress.stage = 'processing';
        progress.message =
          config.type === 'pcap'
            ? 'Extracting WiFi networks and handshakes...'
            : 'Counting passwords and analyzing dictionary...';
        this.activeUploads.set(fileId, progress);
        onProgress?.(progress);

        processingResult = await this.processUploadedFile(savedPath, config);
      }

      // Stage 4: Complete
      progress.stage = 'completed';
      progress.percentage = 100;
      progress.message =
        config.type === 'pcap'
          ? 'Network analysis complete! Upload finished successfully.'
          : 'Dictionary processed successfully! Upload finished.';
      this.activeUploads.set(fileId, progress);
      onProgress?.(progress);

      const uploadTime = Date.now() - startTime;

      return {
        success: true,
        stdout: `File uploaded successfully in ${uploadTime}ms`,
        stderr: '',
        exitCode: 0,
        data: {
          success: true,
          fileId,
          originalName: file instanceof File ? file.name : 'buffer',
          savedPath,
          size: this.getFileSize(file),
          checksum: validationResult.checksum,
          metadata: this.extractBasicMetadata(savedPath, config),
          processingResult,
          uploadTime,
        },
        executionTime: uploadTime,
      };
    } catch (error) {
      // Update progress to error state
      const progress = this.activeUploads.get(fileId);
      if (progress) {
        progress.stage = 'error';
        progress.message =
          error instanceof Error ? error.message : 'Upload failed';
        this.activeUploads.set(fileId, progress);
        onProgress?.(progress);
      }

      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Upload failed',
        exitCode: -1,
        executionTime: Date.now() - startTime,
      };
    } finally {
      // Clean up progress tracking after a delay
      setTimeout(() => {
        this.activeUploads.delete(fileId);
      }, 5000);
    }
  }

  /**
   * Stream upload for large files
   */
  private async streamUpload(
    file: File | Buffer,
    uploadPath: string
  ): Promise<string> {
    const fullPath = resolve(this.fsManager['basePath'], uploadPath);
    await fs.mkdir(dirname(fullPath), { recursive: true });

    if (file instanceof File) {
      // For web File objects, read as buffer and write
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(fullPath, buffer);
      return uploadPath;
    } else {
      // For Buffer files, write directly
      await fs.writeFile(fullPath, file);
      return uploadPath;
    }
  }

  /**
   * Simple upload for small files
   */
  private async simpleUpload(
    file: File | Buffer,
    uploadPath: string,
    fileId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    const fullPath = resolve(this.fsManager['basePath'], uploadPath);
    await fs.mkdir(dirname(fullPath), { recursive: true });

    if (file instanceof File) {
      // Read file as buffer for small files
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(fullPath, buffer);
    } else {
      await fs.writeFile(fullPath, file);
    }

    // Update progress to 100%
    const progress = this.activeUploads.get(fileId);
    if (progress) {
      progress.bytesUploaded = progress.totalBytes;
      progress.percentage = 100;
      this.activeUploads.set(fileId, progress);
      onProgress?.(progress);
    }

    return uploadPath;
  }

  /**
   * Validate uploaded file based on configuration
   */
  private async validateUploadedFile(
    filePath: string,
    config: UploadConfig
  ): Promise<{ valid: boolean; error?: string; checksum?: string }> {
    const validationResult = await this.fsManager.validateFileUpload(filePath, {
      maxSize: config.maxSize,
      allowedExtensions: config.allowedExtensions,
      generateChecksum: config.validation.generateChecksum,
      validateContent: config.validation.validateContent,
    });

    return validationResult;
  }

  /**
   * Process uploaded file based on type and configuration
   */
  private async processUploadedFile(
    filePath: string,
    config: UploadConfig
  ): Promise<ProcessingResult> {
    if (config.customProcessing) {
      return await config.customProcessing(filePath, config);
    }

    // Default processing based on type
    switch (config.type) {
      case 'pcap':
        return await this.processPcapFile(filePath);
      case 'dictionary':
        return await this.processDictionaryFile(filePath);
      default:
        return {};
    }
  }

  /**
   * Process PCAP files with network analysis
   */
  private async processPcapFile(filePath: string): Promise<ProcessingResult> {
    logDebug(`[UploadService] Processing PCAP file: ${filePath}`);

    const { HcxPcapNgTool } = await import('@/tools/hcxpcapngtool');
    const hcxTool = new HcxPcapNgTool();

    logDebug(
      `[UploadService] HcxPcapNgTool instance created, calling processPcapForUpload`
    );

    // Use processPcapForUpload which extracts networks and creates hash files
    const result = await hcxTool.processPcapForUpload(
      resolve(filePath),
      dirname(resolve(filePath))
    );

    logDebug(`[UploadService] processPcapForUpload result:`, {
      success: result.success,
      stderr: result.stderr,
      networksCount: result.data?.networks?.length || 0,
      networks: result.data?.networks,
    });

    if (!result.success || !result.data) {
      return {
        analysis: {
          networks: [],
          isValid: false,
          errorMessage: result.stderr || 'Failed to process PCAP file',
        },
        summary: {
          networksFound: 0,
          networksWithHandshakes: 0,
          totalHandshakes: 0,
        },
        handshakes: {
          hashFile: '',
          format: 'hc22000',
          count: 0,
        },
      };
    }

    const networks = result.data.networks;
    const networksWithHandshakes = networks.filter(n => n.hasHandshake).length;

    return {
      analysis: {
        networks: networks.map(n => ({
          essid: n.essid,
          bssid: n.bssid,
          channel: n.channel,
          encryption: n.encryption,
          hasHandshake: n.hasHandshake,
          firstSeen: n.firstSeen,
          lastSeen: n.lastSeen,
        })),
        isValid: networks.length > 0,
        essidList: result.data.essidList,
      },
      summary: {
        networksFound: networks.length,
        networksWithHandshakes,
        totalHandshakes: networksWithHandshakes,
        pcapInfo: result.data.pcapInfo,
      },
      handshakes: {
        hashFile: result.data.hashFile,
        format: 'hc22000',
        count: networksWithHandshakes,
      },
    };
  }

  /**
   * Process dictionary files with line counting
   */
  private async processDictionaryFile(
    filePath: string
  ): Promise<ProcessingResult> {
    const stats = await fs.stat(filePath);
    const isCompressed = /\.(gz|bz2|zip)$/i.test(filePath);

    let lineCount = 0;
    const encoding: BufferEncoding = 'utf8';

    // For now, simple line counting for uncompressed files
    // TODO: Implement streaming line counting for large files
    if (!isCompressed && stats.size < 100 * 1024 * 1024) {
      // < 100MB
      const content = await fs.readFile(filePath, encoding);
      lineCount = content.split('\n').length;
    }

    return {
      lineCount,
      encoding,
      isCompressed,
      estimatedSize: stats.size,
    };
  }

  /**
   * Extract basic metadata from uploaded file
   */
  private extractBasicMetadata(
    filePath: string,
    config: UploadConfig
  ): ProcessingResult {
    const ext = extname(filePath).toLowerCase();
    const filename = basename(filePath);

    return {
      originalName: filename,
      extension: ext,
      uploadType: config.type,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Clean up upload on failure
   */
  private async cleanupUpload(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Helper methods
   */
  generateFileId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isLargeFile(file: File | Buffer, config: UploadConfig): boolean {
    const size = this.getFileSize(file);
    return size > 10 * 1024 * 1024 || config.validation.streamingRequired; // 10MB threshold
  }

  private getFileSize(file: File | Buffer): number {
    return file instanceof File ? file.size : file.length;
  }

  private getUploadPath(
    fileId: string,
    originalName: string,
    config: UploadConfig
  ): string {
    const extension = extname(originalName);
    const baseName = basename(originalName, extension);

    return join('uploads', config.type, `${fileId}_${baseName}${extension}`);
  }

  /**
   * Get upload progress for active uploads
   */
  getUploadProgress(fileId: string): UploadProgress | null {
    return this.activeUploads.get(fileId) || null;
  }

  /**
   * Get all active uploads
   */
  getActiveUploads(): Map<string, UploadProgress> {
    return new Map(this.activeUploads);
  }

  /**
   * Cancel upload
   */
  cancelUpload(fileId: string): boolean {
    if (this.activeUploads.has(fileId)) {
      const progress = this.activeUploads.get(fileId)!;
      progress.stage = 'error';
      progress.message = 'Upload cancelled';
      this.activeUploads.set(fileId, progress);
      return true;
    }
    return false;
  }
}

// Create default instance
export const uploadService = new UploadService();
