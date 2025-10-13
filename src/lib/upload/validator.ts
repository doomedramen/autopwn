import { createReadStream, promises as fs } from 'fs';
import { extname } from 'path';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

export interface ValidationRule {
  name: string;
  validate: (filePath: string) => Promise<{ valid: boolean; error?: string; data?: Record<string, unknown> }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: Record<string, unknown>;
}

export class FileValidator {
  private rules: Map<string, ValidationRule[]> = new Map();

  constructor() {
    this.registerDefaultRules();
  }

  /**
   * Register validation rules for a specific file type
   */
  registerRules(fileType: string, rules: ValidationRule[]): void {
    const existingRules = this.rules.get(fileType) || [];
    this.rules.set(fileType, [...existingRules, ...rules]);
  }

  /**
   * Validate file based on type and registered rules
   */
  async validateFile(filePath: string, fileType: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      metadata: {}
    };

    const rules = this.rules.get(fileType) || [];
    const genericRules = this.rules.get('*') || [];
    const allRules = [...genericRules, ...rules];

    for (const rule of allRules) {
      try {
        const ruleResult = await rule.validate(filePath);

        if (!ruleResult.valid) {
          result.valid = false;
          if (ruleResult.error) {
            result.errors.push(`${rule.name}: ${ruleResult.error}`);
          }
        }

        // Add any metadata from the rule
        if (ruleResult.data) {
          result.metadata = { ...result.metadata, ...ruleResult.data };
        }
      } catch (error) {
        result.valid = false;
        result.errors.push(`${rule.name}: Validation error - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  /**
   * Register default validation rules
   */
  private registerDefaultRules(): void {
    // Generic file size rule
    this.registerRules('*', [
      {
        name: 'File Accessibility',
        validate: async (filePath: string) => {
          try {
            await fs.access(filePath);
            return { valid: true };
          } catch {
            return { valid: false, error: 'File is not accessible' };
          }
        }
      },
      {
        name: 'File Extension',
        validate: async (filePath: string) => {
          const ext = extname(filePath).toLowerCase();
          const validExtensions = ['.pcap', '.cap', '.pcapng', '.txt', '.gz', '.bz2', '.zip', '.hccapx', '.json'];

          if (!validExtensions.includes(ext)) {
            return {
              valid: false,
              error: `Unsupported file extension: ${ext}`
            };
          }

          return { valid: true, data: { extension: ext } };
        }
      }
    ]);

    // PCAP-specific rules
    this.registerRules('pcap', [
      {
        name: 'PCAP File Header',
        validate: async (filePath: string) => {
          try {
            const buffer = Buffer.alloc(4);
            const fd = await fs.open(filePath, 'r');
            await fd.read(buffer, 0, 4, 0);
            await fd.close();

            // Check for common PCAP magic numbers
            const magic = buffer.readUInt32LE(0);
            const validMagics = [0xa1b2c3d4, 0xd4c3b2a1, 0xa1b23c4d, 0x4d3cb2a1];

            if (!validMagics.includes(magic)) {
              return {
                valid: false,
                error: 'Invalid PCAP file format - unrecognized magic number'
              };
            }

            return { valid: true, data: { format: magic === 0xa1b23c4d ? 'pcapng' : 'pcap' } };
          } catch (error) {
            return {
              valid: false,
              error: `Failed to read PCAP header: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
          }
        }
      },
      {
        name: 'PCAP Content Validation',
        validate: async (filePath: string) => {
          try {
            const { HcxPcapNgTool } = await import('@/tools/hcxpcapngtool');
            const hcxTool = new HcxPcapNgTool();

            const isAvailable = await hcxTool.isAvailable();
            if (!isAvailable) {
              return {
                valid: true, // Don't fail validation if tool isn't available
                warnings: ['HCX tool not available for content validation']
              };
            }

            // Quick analysis to check if file contains WiFi packets
            const result = await hcxTool.analyzePcap({
              inputPcap: filePath,
              outputFormat: 'hccapx'
            });

            if (!result.success && result.stderr?.includes('not a pcap')) {
              return {
                valid: false,
                error: 'File does not contain valid PCAP data'
              };
            }

            return {
              valid: true,
              data: {
                hasNetworks: result.data?.networks && result.data.networks.length > 0,
                networkCount: result.data?.networks?.length || 0
              }
            };
          } catch (error) {
            return {
              valid: true, // Don't fail validation on analysis errors
              warnings: [`Content validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
            };
          }
        }
      }
    ]);

    // Dictionary-specific rules
    this.registerRules('dictionary', [
      {
        name: 'Dictionary File Format',
        validate: async (filePath: string) => {
          try {
            const ext = extname(filePath).toLowerCase();

            // Check if it's a compressed file
            if (['.gz', '.bz2', '.zip'].includes(ext)) {
              return {
                valid: true,
                data: {
                  isCompressed: true,
                  compressionType: ext.substring(1)
                }
              };
            }

            // For text files, check if it's readable text
            if (ext === '.txt' || !ext) {
              // Read first few bytes to check if it's text
              const buffer = Buffer.alloc(1024);
              const fd = await fs.open(filePath, 'r');
              await fd.read(buffer, 0, 1024, 0);
              await fd.close();

              // Simple text detection - check for non-printable characters
              const textContent = buffer.toString('utf8', 0, buffer.indexOf(0));
              const printableChars = textContent.replace(/[\x00-\x1F\x7F]/g, '').length;

              if (textContent.length > 0 && printableChars / textContent.length < 0.9) {
                return {
                  valid: false,
                  error: 'Dictionary file appears to contain binary data'
                };
              }

              return {
                valid: true,
                data: {
                  isCompressed: false,
                  isText: true,
                  estimatedEncoding: 'utf8'
                }
              };
            }

            return { valid: true, data: { fileType: ext } };
          } catch (error) {
            return {
              valid: false,
              error: `Failed to validate dictionary format: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
          }
        }
      },
      {
        name: 'Dictionary Line Count',
        validate: async (filePath: string) => {
          try {
            const ext = extname(filePath).toLowerCase();

            // Skip line counting for compressed files for now
            if (['.gz', '.bz2', '.zip'].includes(ext)) {
              return {
                valid: true,
                warnings: ['Cannot count lines in compressed files during validation'],
                data: { lineCount: null }
              };
            }

            // For small text files, count lines
            const stats = await fs.stat(filePath);
            if (stats.size > 100 * 1024 * 1024) { // > 100MB
              return {
                valid: true,
                warnings: ['File too large for line counting during validation'],
                data: { lineCount: null }
              };
            }

            let lineCount = 0;
            const readStream = createReadStream(filePath, { encoding: 'utf8' });

            const lineCounter = new Transform({
              transform(chunk: string, encoding, callback) {
                const lines = chunk.split('\n');
                lineCount += lines.length - 1; // Don't count the last chunk if it doesn't end with newline
                callback(null, chunk);
              }
            });

            await pipeline(readStream, lineCounter);

            if (lineCount === 0) {
              return {
                valid: false,
                error: 'Dictionary file is empty or contains no lines'
              };
            }

            return {
              valid: true,
              data: { lineCount }
            };
          } catch (error) {
            return {
              valid: true, // Don't fail validation on counting errors
              warnings: [`Failed to count lines: ${error instanceof Error ? error.message : 'Unknown error'}`],
              data: { lineCount: null }
            };
          }
        }
      }
    ]);
  }

  /**
   * Validate file checksum
   */
  async validateChecksum(filePath: string, expectedChecksum?: string): Promise<{ valid: boolean; actualChecksum: string; error?: string }> {
    try {
      const hash = createHash('sha256');
      const readStream = createReadStream(filePath);

      await pipeline(readStream, hash);
      const actualChecksum = hash.digest('hex');

      if (expectedChecksum && actualChecksum !== expectedChecksum) {
        return {
          valid: false,
          actualChecksum,
          error: `Checksum mismatch. Expected: ${expectedChecksum}, Actual: ${actualChecksum}`
        };
      }

      return { valid: true, actualChecksum };
    } catch (error) {
      return {
        valid: false,
        actualChecksum: '',
        error: `Failed to calculate checksum: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get all registered rules for a file type
   */
  getRules(fileType: string): ValidationRule[] {
    return this.rules.get(fileType) || [];
  }

  /**
   * Remove all rules for a file type
   */
  clearRules(fileType: string): void {
    this.rules.delete(fileType);
  }
}

// Create default instance
export const fileValidator = new FileValidator();