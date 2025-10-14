import { jobMonitor } from '@/lib/job-monitor';

// Initialize the job monitor service on server startup, but not during build
// We check if we're in a build environment by looking for NEXT_BUILD
const isBuildTime =
  process.env.NEXT_BUILD === 'true' || process.argv.includes('build');

if (typeof window === 'undefined' && !isBuildTime) {
  // Only start if we're on server and not during build
  try {
    console.log('Initializing job monitor service...');
    jobMonitor.start();
  } catch (error) {
    console.warn('Failed to initialize job monitor:', error);
  }
} else if (isBuildTime) {
  console.log('Skipping job monitor initialization during build');
}

// Export a flag to indicate the monitor is running
export const jobMonitorInitialized = true;
