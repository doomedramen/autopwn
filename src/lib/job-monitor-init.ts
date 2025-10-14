import { jobMonitor } from '@/lib/job-monitor';

// Comprehensive build detection to prevent database connections during build/static generation
const isBuildTime =
  process.env.NEXT_BUILD === 'true' ||
  process.env.NODE_ENV === 'production' ||
  process.argv.includes('build') ||
  process.argv.includes('next') ||
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NEXT_PHASE === 'phase-development';

// Also skip if we're in CI/CD environment
const isCICD = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

if (typeof window === 'undefined' && !isBuildTime && !isCICD) {
  // Only start if we're on server, not during build, and not in CI/CD
  try {
    console.log('Initializing job monitor service...');
    jobMonitor.start();
  } catch (error) {
    console.warn('Failed to initialize job monitor:', error);
  }
} else if (isBuildTime || isCICD) {
  console.log('Skipping job monitor initialization during build/CI');
}

// Export a flag to indicate the monitor is running
export const jobMonitorInitialized = true;
