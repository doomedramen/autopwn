import { jobMonitor } from '@/lib/job-monitor';

// Build time detection - only skip during actual build/static generation
const isBuildTime =
  process.env.NEXT_BUILD === 'true' ||
  process.argv.includes('build') ||
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NEXT_PHASE === 'phase-development';

// CI/CD environment detection
const isCICD = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

// Check if database URL is available (for Docker builds without DB)
const hasDatabaseUrl = !!process.env.DATABASE_URL;

if (typeof window === 'undefined' && !isBuildTime && !isCICD && hasDatabaseUrl) {
  // Only start if we're on server, not during build, not in CI/CD, and have DB connection
  try {
    console.log('Initializing job monitor service...');
    jobMonitor.start();
  } catch (error) {
    console.warn('Failed to initialize job monitor:', error);
  }
} else if (isBuildTime) {
  console.log('Skipping job monitor initialization during build');
} else if (isCICD) {
  console.log('Skipping job monitor initialization in CI/CD');
} else if (!hasDatabaseUrl) {
  console.log('Skipping job monitor initialization - no DATABASE_URL available');
}

// Export a flag to indicate the monitor is configured (not necessarily running)
export const jobMonitorInitialized = true;
