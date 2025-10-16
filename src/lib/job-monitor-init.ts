import { jobMonitor } from '@/lib/job-monitor';
import { toolValidator } from '@/lib/tool-validation';
import { logError, logInfo, logDebug, logWarn } from '@/lib/logger';

// Build time detection - only skip during actual build/static generation
const isBuildTime =
  process.env.NEXT_BUILD === 'true' ||
  process.argv.includes('build') ||
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NEXT_PHASE === 'phase-development';

// CI/CD environment detection
const isCICD =
  process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

// Check if database URL is available (for Docker builds without DB)
const hasDatabaseUrl = !!process.env.DATABASE_URL;

// Tool validation function
async function validateToolsOnStartup() {
  try {
    logInfo('🔧 Validating required tools on application startup...');
    const results = await toolValidator.checkRequiredTools();
    const missingCritical = results.filter(r => r.critical && !r.available);

    if (missingCritical.length > 0) {
      logError('\n❌ CRITICAL: Required tools are missing!');
      logError('Missing tools:');
      missingCritical.forEach(tool => {
        logError(`  - ${tool.name}: ${tool.error || 'Unknown error'}`);
      });
      logError(
        '\n⚠️  AutoPWN will run in degraded mode without these tools.'
      );
      logError('Password cracking functionality will not work properly.');
      logError('PCAP analysis functionality will be limited.');
      logError(
        'Please ensure you are using a Docker image with all tools installed.'
      );
    } else {
      logInfo('\n✅ All required tools are available!');
      logInfo('AutoPWN is ready for full functionality.');
    }
  } catch (error) {
    logWarn('⚠️  Tool validation failed:', error);
    logWarn(
      'Application will continue, but functionality may be limited.'
    );
  }
}

if (
  typeof window === 'undefined' &&
  !isBuildTime &&
  !isCICD &&
  hasDatabaseUrl
) {
  // Only start if we're on server, not during build, not in CI/CD, and have DB connection
  try {
    // Validate tools first
    validateToolsOnStartup();

    logInfo('Initializing job monitor service...');
    jobMonitor.start();
  } catch (error) {
    logWarn('Failed to initialize job monitor:', error);
  }
} else if (isBuildTime) {
  logInfo(
    'Skipping tool validation and job monitor initialization during build'
  );
} else if (isCICD) {
  logInfo(
    'Skipping tool validation and job monitor initialization in CI/CD'
  );
} else if (!hasDatabaseUrl) {
  logInfo(
    'Skipping tool validation and job monitor initialization - no DATABASE_URL available'
  );
}

// Export a flag to indicate the monitor is configured (not necessarily running)
export const jobMonitorInitialized = true;
