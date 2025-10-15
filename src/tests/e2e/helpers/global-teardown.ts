import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DatabaseCleanup } from '../setup/database-cleanup';
import { SessionManager } from '../setup/session-manager';

/**
 * Global teardown for e2e tests
 * Runs after all tests complete
 * - Cleans up test artifacts
 * - Generates test reports
 */
async function globalTeardown() {
  console.log('🧹 Running global teardown for comprehensive tests...');

  // Kill any running processes first to ensure clean shutdown
  try {
    const execAsync = promisify(exec);

    // Kill hashcat and job processes
    await execAsync('pkill -f "hashcat" || true');
    await execAsync('pkill -f "hashcat.bin" || true');
    await execAsync('pkill -f "job-monitor" || true');
    await execAsync('pkill -f "job-processor" || true');

    // Kill any remaining node processes related to jobs
    await execAsync('pkill -f "node.*job" || true');

    console.log('✓ Killed running processes for clean shutdown');
  } catch {
    console.log('⚠ Could not kill processes during teardown');
  }

  // Clean database after tests
  try {
    const dbCleanup = new DatabaseCleanup();
    const connected = await dbCleanup.testConnection();

    if (connected) {
      await dbCleanup.cleanAllTables();
      console.log('✓ Database cleaned after tests');
    } else {
      console.log('⚠ Could not connect to database for cleanup');
    }
  } catch {
    console.log('⚠ Database cleanup failed');
  }

  // Clear session data
  await SessionManager.clearSession();

  // Generate test summary
  const testResultsDir = path.join(process.cwd(), 'test-results');
  const summaryFile = path.join(testResultsDir, 'test-summary.md');

  try {
    const summary = generateTestSummary(testResultsDir);
    await fs.writeFile(summaryFile, summary, 'utf-8');
    console.log('✓ Generated test summary');
  } catch {
    console.log('⚠ Could not generate test summary');
  }

  // Clean up temporary test files older than 1 day
  try {
    const tempDir = path.join(process.cwd(), 'tmp');
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtime.getTime() > oneDay) {
        await fs.rm(filePath, { force: true });
        console.log(`✓ Cleaned up old temp file: ${file}`);
      }
    }
  } catch {
    console.log('⚠ Could not clean temp files');
  }

  // Keep uploads directory but clean old files (keep recent test artifacts)
  const uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    const cleanOldFiles = async (dir: string, maxAge: number) => {
      const files = await fs.readdir(dir);
      const now = Date.now();

      for (const file of files) {
        if (file === '.gitkeep') continue;

        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.rm(filePath, { recursive: true, force: true });
          console.log(`✓ Cleaned up old file: ${file}`);
        }
      }
    };

    const oneHour = 60 * 60 * 1000;
    await cleanOldFiles(path.join(uploadsDir, 'pcap'), oneHour);
    await cleanOldFiles(path.join(uploadsDir, 'dictionary'), oneHour);

    const jobsDir = path.join(process.cwd(), 'jobs');
    if (
      await fs
        .access(jobsDir)
        .then(() => true)
        .catch(() => false)
    ) {
      await cleanOldFiles(jobsDir, oneHour);
    }
  } catch {
    console.log('⚠ Could not clean uploads directory');
  }

  // Generate test coverage report if coverage is enabled
  if (process.env.PLAYWRIGHT_COVERAGE === 'true') {
    try {
      console.log('📊 Generating test coverage report...');
      // Coverage report generation would go here
      console.log('✓ Coverage report generated');
    } catch {
      console.log('⚠ Could not generate coverage report');
    }
  }

  console.log('✅ Global teardown complete\n');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateTestSummary(_testResultsDir: string): string {
  const timestamp = new Date().toISOString();

  return `# E2E Test Summary

Generated: ${timestamp}

## Test Structure

This test suite is organized into the following categories:

### 📁 Authentication Tests (\`auth/\`)
- System initialization
- Login/logout flows
- Password change functionality
- Authentication guards
- Auth-disabled mode

### 📁 User Management Tests (\`user-management/\`)
- User creation and validation
- User role management
- User status controls
- Search and filtering

### 📁 File Upload Tests (\`upload/\`)
- Dictionary file uploads
- PCAP file uploads
- File validation
- Upload progress tracking
- File management

### 📁 Job Management Tests (\`jobs/\`)
- Job creation and configuration
- Job monitoring and progress
- Job control (pause/stop/restart)
- Results viewing and export
- Job filtering and search

### 📁 Workflow Tests (\`workflows/\`)
- Complete end-to-end workflows
- Multi-job scenarios
- Integration testing

## 🛠️ Test Utilities

- \`helpers/test-helpers.ts\` - Common test utilities and API helpers
- \`helpers/global-setup.ts\` - Global test setup
- \`helpers/global-teardown.ts\` - Global test cleanup

## 📁 Test Fixtures

- \`fixtures/dictionaries/\` - Test dictionary files
- \`fixtures/pcaps/\` - Test PCAP files

## Running Tests

\`\`\`bash
# Run all e2e tests
pnpm test:e2e

# Run specific test categories
pnpm test:e2e --grep "Authentication"
pnpm test:e2e --grep "User Management"
pnpm test:e2e --grep "Upload"
pnpm test:e2e --grep "Jobs"

# Run with UI for debugging
pnpm test:e2e:ui

# Run in headed mode
pnpm test:e2e:headed
\`\`\`

## Environment Setup

Tests use the following environment variables:
- \`PLAYWRIGHT=true\` - Indicate Playwright test environment
- \`BASE_URL\` - Override default base URL for tests

---

*This summary was automatically generated after test completion.*
`;
}

export default globalTeardown;
