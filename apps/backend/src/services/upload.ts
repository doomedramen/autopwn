import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db, pcapEssidMapping } from '@autopwn/shared';
import { env } from '../config/env.js';

const execAsync = promisify(exec);

export class UploadService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = env.PCAPS_PATH;
  }

  async handlePcapUpload(files: File[], userId: string): Promise<{ uploadedFiles: string[] }> {
    const uploadedFiles: string[] = [];

    // Ensure upload directory exists
    const userUploadDir = join(this.uploadDir, `user-${userId}`);
    await mkdir(userUploadDir, { recursive: true });

    for (const file of files) {
      try {
        // Validate file extension
        const filename = file.name;
        const validExtensions = ['.pcap', '.pcapng', '.cap'];
        const hasValidExtension = validExtensions.some(ext =>
          filename.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
          console.warn(`Invalid file type: ${filename}`);
          continue;
        }

        // Read file as buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Write to user's directory
        const filepath = join(userUploadDir, filename);
        await writeFile(filepath, buffer);

        // Extract and store ESSID mappings
        await this.extractEssids(filepath, filename, userId);

        uploadedFiles.push(filename);
        console.log(`Successfully uploaded and processed: ${filename}`);
      } catch (error) {
        console.error(`Failed to process ${file.name}:`, error);
      }
    }

    return { uploadedFiles };
  }

  private async extractEssids(pcapPath: string, filename: string, userId: string): Promise<void> {
    try {
      console.log(`Extracting ESSIDs from PCAP: ${pcapPath}`);

      // Use hcxpcapngtool to extract information
      const { stdout, stderr } = await execAsync(`hcxpcapngtool -o /tmp/${filename}.hc22000 -E /tmp/${filename}.essids "${pcapPath}"`, {
        timeout: 30000 // 30 second timeout
      });

      console.log(`hcxpcapngtool output for ${filename}:`, stdout);
      if (stderr) {
        console.log(`hcxpcapngtool stderr for ${filename}:`, stderr);
      }

      // Parse ESSIDs from the output file
      const fs = require('fs');
      let essidOutput = '';
      try {
        essidOutput = fs.readFileSync(`/tmp/${filename}.essids`, 'utf8');
      } catch (error) {
        console.log(`No ESSID file created for ${filename}, trying direct parsing...`);
      }

      const essids: string[] = [];
      const bssids: string[] = [];

      if (essidOutput) {
        // Parse ESSIDs from the file
        const lines = essidOutput.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            // Extract ESSID from hcxtools output format
            const match = line.match(/^([a-f0-9:]+)\s+(.+)$/);
            if (match) {
              const bssid = match[1];
              const essid = match[2].trim();
              if (essid && !essids.includes(essid)) {
                essids.push(essid);
              }
              if (bssid && !bssids.includes(bssid)) {
                bssids.push(bssid);
              }
            }
          }
        }
      }

      // Clean up temporary files
      try {
        fs.unlinkSync(`/tmp/${filename}.hc22000`);
        fs.unlinkSync(`/tmp/${filename}.essids`);
      } catch (error) {
        // Ignore cleanup errors
      }

      console.log(`Extracted ESSIDs for ${filename}:`, essids);
      console.log(`Extracted BSSIDs for ${filename}:`, bssids);

      // Store ESSID mappings in database
      for (let i = 0; i < essids.length; i++) {
        const essid = essids[i];
        const bssid = bssids[i] || undefined;

        await db.insert(pcapEssidMapping).values({
          userId,
          pcapFilename: filename,
          essid,
          bssid,
        }).onConflictDoUpdate({
          target: [pcapEssidMapping.userId, pcapEssidMapping.pcapFilename, pcapEssidMapping.essid],
          set: { bssid }
        });
      }

      console.log(`Stored ${essids.length} ESSID mappings for ${filename}`);
    } catch (error) {
      console.error(`Failed to extract ESSIDs for ${filename}:`, error);
      // Don't fail the upload if ESSID extraction fails
    }
  }
}

export const uploadService = new UploadService();