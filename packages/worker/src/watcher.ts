import chokidar from 'chokidar';
import { join, basename } from 'path';
import { rename, readdir } from 'fs/promises';
import { spawn } from 'child_process';
import { config } from './config.js';
import { db } from './database.js';
import { convertPcapToHash } from './processor.js';

interface PendingFile {
  filename: string;
  addedAt: number;
}

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private pendingFiles: PendingFile[] = [];
  private quietTimer: NodeJS.Timeout | null = null;
  private maxWaitTimer: NodeJS.Timeout | null = null;
  private batchStartTime: number | null = null;

  start() {
    console.log(`Watching for .pcap files in: ${config.inputPath}`);
    console.log(`Batch mode: ${config.batchModeEnabled ? 'ENABLED' : 'DISABLED'}`);

    this.watcher = chokidar.watch('*.pcap', {
      cwd: config.inputPath,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', async (filename) => {
      await this.handleNewFile(filename);
    });

    this.watcher.on('error', (error) => {
      console.error('Watcher error:', error);
    });

    console.log('File watcher started');
  }

  private async handleNewFile(filename: string) {
    console.log(`New file detected: ${filename}`);

    if (!config.batchModeEnabled) {
      // Single file mode - process immediately (legacy behavior)
      await this.processSingleFile(filename);
      return;
    }

    // Batch mode - add to pending queue
    this.pendingFiles.push({
      filename,
      addedAt: Date.now(),
    });

    console.log(`Added to batch queue (${this.pendingFiles.length} files pending)`);

    // Start timers if this is the first file
    if (this.pendingFiles.length === 1) {
      this.batchStartTime = Date.now();
      this.startMaxWaitTimer();
    }

    // Reset quiet period timer
    this.startQuietPeriodTimer();

    // Check if we've hit max batch size
    if (this.pendingFiles.length >= config.batchMaxFiles) {
      console.log(`Max batch size (${config.batchMaxFiles}) reached, processing now`);
      await this.processBatch();
    }
  }

  private startQuietPeriodTimer() {
    if (this.quietTimer) {
      clearTimeout(this.quietTimer);
    }

    this.quietTimer = setTimeout(async () => {
      console.log(`Quiet period (${config.batchQuietPeriod / 1000}s) elapsed, processing batch`);
      await this.processBatch();
    }, config.batchQuietPeriod);
  }

  private startMaxWaitTimer() {
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
    }

    this.maxWaitTimer = setTimeout(async () => {
      console.log(`Max wait time (${config.batchMaxWait / 1000}s) reached, forcing batch`);
      await this.processBatch();
    }, config.batchMaxWait);
  }

  private clearTimers() {
    if (this.quietTimer) {
      clearTimeout(this.quietTimer);
      this.quietTimer = null;
    }
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
    this.batchStartTime = null;
  }

  private async processBatch() {
    this.clearTimers();

    if (this.pendingFiles.length === 0) {
      return;
    }

    // Check if we should process as single file
    if (this.pendingFiles.length < config.batchMinFiles) {
      console.log(`Only ${this.pendingFiles.length} file(s), processing individually`);
      for (const file of this.pendingFiles) {
        await this.processSingleFile(file.filename);
      }
      this.pendingFiles = [];
      return;
    }

    console.log(`Processing batch of ${this.pendingFiles.length} files`);

    try {
      const files = [...this.pendingFiles];
      this.pendingFiles = [];

      await this.createBatchJob(files.map(f => f.filename));
    } catch (error) {
      console.error('Batch processing failed:', error);
      // Fallback: process files individually
      for (const file of this.pendingFiles) {
        await this.processSingleFile(file.filename);
      }
      this.pendingFiles = [];
    }
  }

  private async createBatchJob(filenames: string[]) {
    console.log(`Creating batch job for ${filenames.length} files`);

    const timestamp = Date.now();
    const batchHashFile = join(config.hashesPath, `batch-${timestamp}.hc22000`);
    const pcapPaths: string[] = [];

    // Move all files to intermediate and collect paths
    for (const filename of filenames) {
      try {
        const inputFile = join(config.inputPath, filename);
        const intermediateFile = join(config.intermediatePath, filename);
        await rename(inputFile, intermediateFile);
        pcapPaths.push(intermediateFile);
      } catch (error) {
        console.error(`Failed to move ${filename}:`, error);
      }
    }

    if (pcapPaths.length === 0) {
      throw new Error('No files to process in batch');
    }

    // Convert all pcaps to single hc22000 file and parse mapping
    console.log(`Converting ${pcapPaths.length} pcap files to hc22000...`);
    const { hashCount, essidMap } = await this.convertBatchToHash(pcapPaths, batchHashFile);
    console.log(`Batch conversion complete. Found ${hashCount} total handshake(s)`);

    // Create batch job
    const job = db.createJob({
      filename: `batch-${timestamp}`,
      hash_count: hashCount,
      batch_mode: 1,
      items_total: filenames.length,
    });

    // Create job items with ESSID/BSSID mapping
    for (const filename of filenames) {
      const itemInfo = essidMap.get(filename) || { essid: null, bssid: null };
      db.createJobItem({
        job_id: job.id,
        filename,
        essid: itemInfo.essid || undefined,
        bssid: itemInfo.bssid || undefined,
      });
    }

    console.log(`Created batch job ${job.id} with ${filenames.length} items`);
  }

  private async convertBatchToHash(
    pcapPaths: string[],
    outputFile: string
  ): Promise<{ hashCount: number; essidMap: Map<string, { essid: string | null; bssid: string | null }> }> {
    return new Promise((resolve, reject) => {
      const process = spawn('hcxpcapngtool', ['-o', outputFile, ...pcapPaths]);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 || stdout.includes('written hashes')) {
          // Parse hash count
          const hashMatch = stdout.match(/written hashes:\s*(\d+)/i) ||
                           stdout.match(/(\d+)\s+EAPOL/i);
          const hashCount = hashMatch ? parseInt(hashMatch[1]) : pcapPaths.length;

          // Parse ESSID/BSSID mapping
          const essidMap = this.parseHcxOutput(stdout, pcapPaths);

          resolve({ hashCount, essidMap });
        } else {
          reject(new Error(`hcxpcapngtool failed: ${stderr || stdout}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  private parseHcxOutput(
    output: string,
    pcapPaths: string[]
  ): Map<string, { essid: string | null; bssid: string | null }> {
    const essidMap = new Map<string, { essid: string | null; bssid: string | null }>();

    // Extract filename from path for mapping
    const filenameMap = new Map<string, string>();
    for (const path of pcapPaths) {
      const filename = basename(path);
      filenameMap.set(path, filename);
    }

    // Parse output for ESSID and BSSID information
    // hcxpcapngtool output format varies, this is a best-effort parse
    const lines = output.split('\n');
    for (const line of lines) {
      // Look for ESSID patterns
      const essidMatch = line.match(/ESSID[:\s]+(.+?)(?:\s|$)/i);
      const bssidMatch = line.match(/(?:BSSID|MAC)[:\s]+([0-9a-f:]+)/i);

      if (essidMatch || bssidMatch) {
        // Try to find which file this belongs to
        for (const [path, filename] of filenameMap) {
          if (line.includes(path) || line.includes(filename)) {
            essidMap.set(filename, {
              essid: essidMatch ? essidMatch[1].trim() : null,
              bssid: bssidMatch ? bssidMatch[1].trim() : null,
            });
            break;
          }
        }
      }
    }

    // Ensure all files have an entry (even if null)
    for (const filename of filenameMap.values()) {
      if (!essidMap.has(filename)) {
        essidMap.set(filename, { essid: null, bssid: null });
      }
    }

    return essidMap;
  }

  private async processSingleFile(filename: string) {
    console.log(`Processing single file: ${filename}`);

    try {
      const inputFile = join(config.inputPath, filename);
      const intermediateFile = join(config.intermediatePath, filename);
      const hashFile = join(config.hashesPath, `${filename}.hc22000`);

      // Move to intermediate folder
      await rename(inputFile, intermediateFile);
      console.log(`Moved ${filename} to intermediate folder`);

      // Convert to hc22000
      console.log(`Converting ${filename} to hc22000...`);
      const hashCount = await convertPcapToHash(intermediateFile, hashFile);
      console.log(`Conversion complete. Found ${hashCount} handshake(s)`);

      // Create job in database (single file mode)
      const job = db.createJob({
        filename,
        hash_count: hashCount,
        batch_mode: 0,
      });

      console.log(`Created job ${job.id} for ${filename}`);
    } catch (error) {
      console.error(`Failed to process ${filename}:`, error);

      // Try to move to failed folder
      try {
        const intermediateFile = join(config.intermediatePath, filename);
        const failedFile = join(config.failedPath, filename);
        await rename(intermediateFile, failedFile);
      } catch (moveError) {
        console.error(`Failed to move ${filename} to failed folder:`, moveError);
      }
    }
  }

  stop() {
    this.clearTimers();

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('File watcher stopped');
    }
  }
}
