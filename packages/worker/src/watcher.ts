import chokidar from 'chokidar';
import { existsSync, mkdirSync } from 'fs';
import { config } from './config.js';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;

  private ensureDirectories() {
    const directories = [
      config.inputPath,
      config.intermediatePath,
      config.completedPath,
      config.failedPath,
      config.hashesPath,
    ];

    for (const dir of directories) {
      if (!existsSync(dir)) {
        console.log(`Creating directory: ${dir}`);
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  start() {
    console.log(`Watching for .pcap files in: ${config.inputPath}`);
    console.log(`Batch mode: DISABLED - Files will be processed manually via UI`);

    // Ensure all required directories exist
    this.ensureDirectories();

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
    console.log(`New file detected: ${filename} - Waiting for manual processing via UI`);

    // Files are no longer auto-processed - they wait for manual job creation via the UI
    // This allows users to select captures and dictionaries before processing
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('File watcher stopped');
    }
  }
}
