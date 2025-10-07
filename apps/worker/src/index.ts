import { FileWatcher } from './watcher.js';
import { JobProcessor } from './processor.js';

async function main() {
  console.log('=== AutoPWN Worker Starting ===');

  const watcher = new FileWatcher();
  const processor = new JobProcessor();

  // Start file watcher
  watcher.start();

  // Start job processor
  await processor.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    watcher.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down...');
    watcher.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
