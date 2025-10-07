import chokidar from 'chokidar';
import { ensureDirectories, getRequiredDirectories } from '@autopwn/shared';
import { config } from './config.js';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;

  private ensureDirectories() {
    const directories = getRequiredDirectories();
    ensureDirectories(directories);
  }

  start() {
    console.log(`Watching for .pcap files in: ${config.pcapsPath}`);

    // Ensure all required directories exist
    this.ensureDirectories();

    this.watcher = chokidar.watch('*.pcap', {
      cwd: config.pcapsPath,
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
