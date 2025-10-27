// tests/global-teardown.ts
// Global teardown to clean up resources and prevent memory leaks

import { execSync } from 'child_process';

async function globalTeardown() {
  console.log('🧹 Global teardown: Cleaning up test environment...');

  try {
    // Force kill any remaining dev server processes
    console.log('🔄 Cleaning up remaining server processes...');

    // Kill processes on ports 3000 and 3001
    try {
      execSync('lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true', { stdio: 'pipe' });
      console.log('✅ Server processes on ports 3000/3001 terminated');
    } catch (error) {
      // Ignore errors - processes might not exist
    }

    // Clean up any Node processes that might be stuck
    try {
      const processes = execSync('ps aux | grep "test:dev\\|next dev" | grep -v grep | awk \'{print $2}\'', { encoding: 'utf8' });
      if (processes.trim()) {
        execSync(`echo ${processes.trim()} | xargs kill -9 2>/dev/null || true`, { stdio: 'pipe' });
        console.log('✅ Stuck Node processes terminated');
      }
    } catch (error) {
      // Ignore errors - no stuck processes found
    }

    // Force garbage collection if available
    if (global.gc) {
      console.log('♻️  Forcing garbage collection...');
      global.gc();
    }

    console.log('✅ Global teardown completed');
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
    // Don't throw - teardown failures shouldn't fail the test run
  }
}

export default globalTeardown;