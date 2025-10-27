// tests/global-setup.ts
// Global setup to manage resources and prevent memory leaks

import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup() {
  console.log('🔧 Global setup: Initializing test environment...');

  // Set memory limits for Node.js processes
  if (!process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS = '--max-old-space-size=512';
  }

  // Log test configuration
  console.log(`🧪 Running tests with single worker`);
  console.log(`📂 Test directory configured`);

  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/autopwn_test';
  console.log(`🗄️  Using database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

  try {
    // Reset the database schema using drizzle-kit push
    console.log('🔄 Resetting database schema...');
    const apiPath = path.resolve(__dirname, '../../api');

    execSync(
      `cd ${apiPath} && DATABASE_URL="${databaseUrl}" npx drizzle-kit push --force`,
      {
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: databaseUrl }
      }
    );
    console.log('✅ Database schema reset complete');

    // Seed the superuser
    console.log('👤 Creating test superuser...');
    execSync(
      `cd ${apiPath} && NODE_ENV=test DATABASE_URL="${databaseUrl}" pnpm run db:seed-superuser`,
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DATABASE_URL: databaseUrl,
          E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL || 'admin@autopwn.local',
          E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD || 'admin123'
        }
      }
    );
    console.log('✅ Test superuser created');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  }

  // Force garbage collection if available (requires --expose-gc flag)
  if (global.gc) {
    console.log('♻️  Forcing initial garbage collection...');
    global.gc();
  }

  console.log('✅ Global setup completed');
}

export default globalSetup;