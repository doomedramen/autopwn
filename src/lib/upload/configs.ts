import { UploadConfig } from './index';
import { dirname, extname, basename } from 'path';
import { promises as fs, createReadStream } from 'fs';
import * as readline from 'readline';

/**
 * PCAP file upload configuration
 */
export const PCAP_UPLOAD_CONFIG: UploadConfig = {
  type: 'pcap',
  maxSize: 50 * 1024 * 1024, // 50MB
  allowedExtensions: ['.pcap', '.cap', '.pcapng'],
  validation: {
    generateChecksum: true,
    validateContent: true,
    streamingRequired: false, // PCAP files are typically small enough for simple processing
  },
  processing: {
    extractMetadata: true,
    backgroundProcessing: true,
    progressTracking: true,
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  customProcessing: async (filePath: string, _config: UploadConfig) => {
    // NEW WORKFLOW: Process PCAP during upload to extract networks and create individual .hc22000 file
    // This will be used during job creation to merge hash files instead of reprocessing PCAPs
    const { promises: fs } = await import('fs');
    const { HcxPcapNgTool } = await import('@/tools/hcxpcapngtool');
    const { dirname } = await import('path');

    try {
      const stats = await fs.stat(filePath);
      const hcxTool = new HcxPcapNgTool();

      // Process PCAP to extract networks and create individual hash file
      const result = await hcxTool.processPcapForUpload(
        filePath,
        dirname(filePath)
      );

      if (result.success && result.data) {
        const { networks, hashFile, essidList } = result.data;

        // Count networks with handshakes
        const networksWithHandshakes = networks.filter(
          n => n.hasHandshake
        ).length;

        return {
          metadata: {
            size: stats.size,
            uploadedAt: new Date().toISOString(),
            fileType: 'pcap',
            hashFile, // Path to individual .hc22000 file
            networkCount: networks.length,
            handshakeCount: networksWithHandshakes,
            essidList, // List of discovered ESSIDs
          },
          analysis: {
            success: true,
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
            message: `Found ${networks.length} networks (${networksWithHandshakes} with handshakes)`,
          },
          summary: {
            totalNetworks: networks.length,
            networksWithHandshakes,
            hasValidData: networks.length > 0,
            hashFileGenerated: !!hashFile,
            message:
              networksWithHandshakes > 0
                ? `Ready for job creation - ${networksWithHandshakes} networks with handshakes`
                : 'PCAP processed but no handshakes found',
          },
        };
      } else {
        return {
          metadata: {
            size: stats.size,
            uploadedAt: new Date().toISOString(),
            fileType: 'pcap',
          },
          analysis: {
            success: false,
            networks: [],
            isValid: false,
            errorMessage: result.stderr || 'Failed to process PCAP file',
          },
          summary: {
            totalNetworks: 0,
            networksWithHandshakes: 0,
            hasValidData: false,
            message: 'PCAP processing failed',
          },
          error: result.stderr || 'Processing failed',
        };
      }
    } catch (error) {
      return {
        metadata: {
          size: 0,
          uploadedAt: new Date().toISOString(),
          fileType: 'pcap',
        },
        analysis: {
          success: false,
          networks: [],
          isValid: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Failed to process PCAP file',
        },
        summary: {
          totalNetworks: 0,
          networksWithHandshakes: 0,
          hasValidData: false,
        },
        error: error instanceof Error ? error.message : 'Processing failed',
      };
    }
  },
};

/**
 * Dictionary file upload configuration
 */
export const DICTIONARY_UPLOAD_CONFIG: UploadConfig = {
  type: 'dictionary',
  maxSize: 5 * 1024 * 1024 * 1024, // 5GB
  allowedExtensions: ['.txt', '.lst', '.dic', '.gz', '.bz2', '.zip'],
  validation: {
    generateChecksum: true,
    validateContent: true,
    streamingRequired: true, // Dictionary files can be very large
  },
  processing: {
    extractMetadata: true,
    backgroundProcessing: true,
    progressTracking: true,
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  customProcessing: async (filePath: string, _config: UploadConfig) => {
    const { FileSystemManager } = await import('@/lib/filesystem');
    const fsManager = new FileSystemManager(dirname(filePath));

    try {
      const stats = await fs.stat(filePath);
      const isCompressed = /\.(gz|bz2|zip)$/i.test(filePath);
      const ext = extname(filePath).toLowerCase();

      let lineCount = 0;
      const encoding: BufferEncoding = 'utf8';
      const sampleWords: string[] = [];
      const uniqueWords = new Set<string>();

      // For uncompressed text files, do line counting and sampling
      if (!isCompressed && stats.size < 500 * 1024 * 1024) {
        // < 500MB
        try {
          lineCount = await fsManager.countLinesStreaming(
            basename(filePath), // Use basename instead of full path to avoid doubling
            encoding,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            (_lines, _bytes, _total) => {
              // This could be used for progress tracking during processing
            }
          );

          // Sample some words from the file
          if (lineCount > 0) {
            const fileStream = createReadStream(filePath, { encoding });
            const rl = readline.createInterface({
              input: fileStream,
              crlfDelay: Infinity,
            });

            let sampleCount = 0;
            const maxSamples = 100;
            const sampleInterval = Math.max(
              1,
              Math.floor(lineCount / maxSamples)
            );

            for await (const line of rl) {
              const trimmedLine = line.trim();
              if (trimmedLine && trimmedLine.length > 0) {
                if (
                  sampleCount % sampleInterval === 0 &&
                  sampleWords.length < maxSamples
                ) {
                  sampleWords.push(trimmedLine);
                }
                uniqueWords.add(trimmedLine.toLowerCase());
                sampleCount++;
              }
            }
          }
        } catch (error) {
          console.warn('Failed to process dictionary file:', error);
        }
      }

      // Calculate word statistics
      const wordLengths = sampleWords.map(word => word.length);
      const avgWordLength =
        wordLengths.length > 0
          ? wordLengths.reduce((sum, len) => sum + len, 0) / wordLengths.length
          : 0;

      return {
        metadata: {
          size: stats.size,
          lineCount,
          uniqueWordCount: uniqueWords.size,
          estimatedWords: lineCount,
          isCompressed,
          compressionType: isCompressed ? ext.substring(1) : null,
          encoding,
          avgWordLength: Math.round(avgWordLength * 10) / 10,
          minWordLength: wordLengths.length > 0 ? Math.min(...wordLengths) : 0,
          maxWordLength: wordLengths.length > 0 ? Math.max(...wordLengths) : 0,
        },
        sample: {
          words: sampleWords.slice(0, 20), // First 20 sample words
          count: sampleWords.length,
        },
        quality: {
          hasContent: lineCount > 0,
          seemsToBePasswords: avgWordLength > 4 && avgWordLength < 20, // Typical password length range
          hasDuplicates: uniqueWords.size < lineCount,
          duplicateRatio: lineCount > 0 ? 1 - uniqueWords.size / lineCount : 0,
        },
        processing: {
          streamed: stats.size > 100 * 1024 * 1024, // > 100MB
          timedOut: false,
          error: null,
        },
      };
    } catch (error) {
      return {
        metadata: {
          size: 0,
          lineCount: 0,
          uniqueWordCount: 0,
          estimatedWords: 0,
          isCompressed: false,
          compressionType: null,
          encoding: 'utf8',
          avgWordLength: 0,
          minWordLength: 0,
          maxWordLength: 0,
        },
        sample: {
          words: [],
          count: 0,
        },
        quality: {
          hasContent: false,
          seemsToBePasswords: false,
          hasDuplicates: false,
          duplicateRatio: 0,
        },
        processing: {
          streamed: false,
          timedOut: false,
          error: error instanceof Error ? error.message : 'Processing failed',
        },
      };
    }
  },
};

/**
 * Upload configuration registry
 */
export const UPLOAD_CONFIGS = {
  pcap: PCAP_UPLOAD_CONFIG,
  dictionary: DICTIONARY_UPLOAD_CONFIG,
} as const;

/**
 * Get upload configuration by type
 */
export function getUploadConfig(
  type: keyof typeof UPLOAD_CONFIGS
): UploadConfig {
  return UPLOAD_CONFIGS[type];
}

/**
 * Get all available upload types
 */
export function getUploadTypes(): Array<keyof typeof UPLOAD_CONFIGS> {
  return Object.keys(UPLOAD_CONFIGS) as Array<keyof typeof UPLOAD_CONFIGS>;
}

/**
 * Validate upload configuration
 */
export function validateUploadConfig(config: UploadConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.type) {
    errors.push('Upload type is required');
  }

  if (config.maxSize <= 0) {
    errors.push('Max size must be greater than 0');
  }

  if (!config.allowedExtensions || config.allowedExtensions.length === 0) {
    errors.push('At least one allowed extension is required');
  }

  if (config.allowedExtensions.some(ext => !ext.startsWith('.'))) {
    errors.push('All extensions must start with a dot');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
