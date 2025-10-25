// tests/global-setup.ts
// Global setup to manage resources and prevent memory leaks

async function globalSetup() {
  console.log('🔧 Global setup: Initializing test environment...');
  
  // Set memory limits for Node.js processes
  if (!process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS = '--max-old-space-size=512';
  }
  
  // Log test configuration
  console.log(`🧪 Running tests with single worker`);
  console.log(`📂 Test directory configured`);
  
  // Force garbage collection if available (requires --expose-gc flag)
  if (global.gc) {
    console.log('gc() available, forcing initial garbage collection...');
    global.gc();
  }
  
  console.log('✅ Global setup completed');
}

export default globalSetup;