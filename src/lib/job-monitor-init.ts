import { jobMonitor } from '@/lib/job-monitor';
import { toolValidator } from '@/lib/tool-validation';

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
    console.log('🔧 Validating required tools on application startup...');
    const results = await toolValidator.checkRequiredTools();
    const missingCritical = results.filter(r => r.critical && !r.available);

    if (missingCritical.length > 0) {
      console.error('\n❌ CRITICAL: Required tools are missing!');
      console.error('Missing tools:');
      missingCritical.forEach(tool => {
        console.error(`  - ${tool.name}: ${tool.error || 'Unknown error'}`);
      });
      console.error('\n⚠️  AutoPWN will run in degraded mode without these tools.');
      console.error('Password cracking functionality will not work properly.');
      console.error('PCAP analysis functionality will be limited.');
      console.error('Please ensure you are using a Docker image with all tools installed.');
    } else {
      console.log('\n✅ All required tools are available!');
      console.log('AutoPWN is ready for full functionality.');
    }
  } catch (error) {
    console.warn('⚠️  Tool validation failed:', error);
    console.warn('Application will continue, but functionality may be limited.');
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

    console.log('Initializing job monitor service...');
    jobMonitor.start();
  } catch (error) {
    console.warn('Failed to initialize job monitor:', error);
  }
} else if (isBuildTime) {
  console.log('Skipping tool validation and job monitor initialization during build');
} else if (isCICD) {
  console.log('Skipping tool validation and job monitor initialization in CI/CD');
} else if (!hasDatabaseUrl) {
  console.log(
    'Skipping tool validation and job monitor initialization - no DATABASE_URL available'
  );
}

// Export a flag to indicate the monitor is configured (not necessarily running)
export const jobMonitorInitialized = true;
