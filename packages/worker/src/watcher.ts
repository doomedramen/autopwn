import chokidar from 'chokidar';
import { join, basename } from 'path';
import { rename } from 'fs/promises';
import { config } from './config.js';
import { db } from './database.js';
import { convertPcapToHash } from './processor.js';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;

  start() {
    console.log(`Watching for .pcap files in: ${config.inputPath}`);

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

      // Create job in database
      const job = db.createJob({
        filename,
        hash_count: hashCount,
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
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('File watcher stopped');
    }
  }
}
