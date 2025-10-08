import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../packages/shared/src/schema.js';
import { sql } from 'drizzle-orm';

export interface TestConfig {
  testDbUrl: string;
  testInputDir: string;
  testOutputDir: string;
  testDictDir: string;
}

export interface PcapFileInfo {
  filename: string;
  password?: string;
  description: string;
  essid?: string;
}

export class TestUtils {
  private config: TestConfig;
  private cleanupTasks: (() => void)[] = [];
  private db!: ReturnType<typeof drizzle>;
  private client!: ReturnType<typeof postgres>;

  constructor(testName: string) {
    const testId = `${testName}-${Date.now()}`;
    const testDbName = `autopwn_test_${testId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    this.config = {
      testDbUrl: `postgresql://autopwn:autopwn_password@localhost:5432/${testDbName}`,
      testInputDir: path.join(__dirname, '../fixtures', `${testId}-input`),
      testOutputDir: path.join(__dirname, '../fixtures', `${testId}-output`),
      testDictDir: path.join(__dirname, '../fixtures', `${testId}-dicts`)
    };

    // Setup test environment (sync parts only)
    this.setupTestEnvironment();
    this.cleanupTasks.push(() => this.cleanup());
  }

  private setupTestEnvironment() {
    // Create test directories
    fs.mkdirSync(this.config.testInputDir, { recursive: true });
    fs.mkdirSync(this.config.testOutputDir, { recursive: true });
    fs.mkdirSync(this.config.testDictDir, { recursive: true });

    // Database initialization will be called separately as it's async
  }

  private async initializeTestDatabase() {
    try {
      // Extract database name from URL
      const dbName = this.config.testDbUrl.split('/').pop();
      const baseUrl = this.config.testDbUrl.replace(`/${dbName}`, '/postgres');
      
      // Connect to postgres database to create test database
      const adminClient = postgres(baseUrl, {
        host: 'localhost',
        // Force IPv4 by using localhost
      });
      await adminClient.unsafe(`CREATE DATABASE "${dbName}"`);
      await adminClient.end();

      // Connect to test database
      this.client = postgres(this.config.testDbUrl, {
        host: 'localhost',
        // Force IPv4 by using localhost
      });
      this.db = drizzle(this.client, { schema });

      // Create all tables using Drizzle migrations
      await this.createTables();

      // Create test user for authentication
      await this.createTestUser();

    } catch (error) {
      console.error('Failed to initialize test database:', error);
      throw error;
    }
  }

  private async createTables() {
    // Create tables in correct order to handle foreign key dependencies
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        email_verified BOOLEAN DEFAULT false NOT NULL,
        image TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)
    `);

    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts(user_id)
    `);

    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token)
    `);

    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS dictionaries (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER NOT NULL
      )
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS dictionaries_user_id_idx ON dictionaries(user_id)
    `);

    await this.db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS dictionaries_user_id_name_unique ON dictionaries(user_id, name)
    `);

    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        job_id TEXT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 0,
        paused INTEGER NOT NULL DEFAULT 0,
        batch_mode INTEGER NOT NULL DEFAULT 0,
        items_total INTEGER,
        items_cracked INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        current_dictionary TEXT,
        progress REAL,
        hash_count INTEGER,
        speed TEXT,
        eta TEXT,
        error TEXT,
        logs TEXT,
        captures TEXT,
        total_hashes INTEGER
      )
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs(user_id)
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status)
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS jobs_priority_idx ON jobs(priority DESC, created_at ASC)
    `);

    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS job_items (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        essid TEXT,
        bssid TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        password TEXT,
        cracked_at TIMESTAMP,
        pcap_filename TEXT
      )
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS job_items_job_id_idx ON job_items(job_id)
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS job_items_user_id_idx ON job_items(user_id)
    `);

    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS job_dictionaries (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        dictionary_id INTEGER NOT NULL REFERENCES dictionaries(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending'
      )
    `);

    await this.db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS job_dictionaries_job_id_dictionary_id_unique ON job_dictionaries(job_id, dictionary_id)
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS job_dictionaries_job_id_idx ON job_dictionaries(job_id)
    `);

    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS results (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        essid TEXT NOT NULL,
        password TEXT NOT NULL,
        cracked_at TIMESTAMP DEFAULT NOW() NOT NULL,
        pcap_filename TEXT
      )
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS results_job_id_idx ON results(job_id)
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS results_user_id_idx ON results(user_id)
    `);

    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS pcap_essid_mapping (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pcap_filename TEXT NOT NULL,
        essid TEXT NOT NULL,
        bssid TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS pcap_essid_mapping_user_id_idx ON pcap_essid_mapping(user_id)
    `);

    await this.db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS pcap_essid_mapping_user_id_pcap_filename_essid_unique ON pcap_essid_mapping(user_id, pcap_filename, essid)
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS pcap_essid_mapping_pcap_filename_idx ON pcap_essid_mapping(pcap_filename)
    `);

    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS pcap_essid_mapping_essid_idx ON pcap_essid_mapping(essid)
    `);
  }

  private async createTestUser() {
    // Create a test user for authentication
    const testUserId = 'test-user-' + Date.now();
    await this.db.execute(sql`
      INSERT INTO users (id, name, email, email_verified) 
      VALUES (${testUserId}, 'Test User', 'test@example.com', true)
    `);

    // Insert test dictionaries for this user
    await this.db.execute(sql`
      INSERT INTO dictionaries (user_id, name, path, size) VALUES
        (${testUserId}, 'test-dict-small', ${path.join(this.config.testDictDir, 'small.txt')}, 100),
        (${testUserId}, 'test-dict-medium', ${path.join(this.config.testDictDir, 'medium.txt')}, 1000),
        (${testUserId}, 'test-dict-large', ${path.join(this.config.testDictDir, 'large.txt')}, 10000)
    `);

    // Store test user ID for use in tests
    (this as any).testUserId = testUserId;
  }

  createTestDictionary(name: string, words: string[]): string {
    const dictPath = path.join(this.config.testDictDir, name);
    fs.writeFileSync(dictPath, words.join('\n'));
    return dictPath;
  }

  createMockPcap(filename: string, content?: Buffer): string {
    const pcapPath = path.join(this.config.testInputDir, filename);

    if (content) {
      fs.writeFileSync(pcapPath, content);
    } else {
      // Create minimal pcap header
      const pcapHeader = Buffer.from([
        0xD4, 0xC3, 0xB2, 0xA1, // Magic number
        0x02, 0x00, 0x04, 0x00, // Version major/minor
        0x00, 0x00, 0x00, 0x00, // Thiszone
        0x00, 0x00, 0x00, 0x00, // Sigfigs
        0xFF, 0xFF, 0x00, 0x00, // Snaplen
        0x01, 0x00, 0x00, 0x00  // Network
      ]);
      fs.writeFileSync(pcapPath, pcapHeader);
    }

    return pcapPath;
  }

  async downloadTestPcap(): Promise<string> {
    const pcapUrl = 'https://github.com/vanhoefm/wifi-example-captures/raw/master/wpa3_transition_wpa3client_24ghz.pcapng';
    const filename = 'test-handshake.pcapng';
    const outputPath = path.join(this.config.testInputDir, filename);

    try {
      // Download using curl
      execSync(`curl -L -o "${outputPath}" "${pcapUrl}"`, { stdio: 'pipe' });
      return outputPath;
    } catch (error) {
      console.log('Download failed, creating mock pcap instead');
      return this.createMockPcap(filename);
    }
  }

  getTestConfig(): TestConfig {
    return { ...this.config };
  }

  getDatabase() {
    return this.db;
  }

  getTestUserId(): string {
    return (this as any).testUserId;
  }

  async createTestUserInApp(): Promise<{ email: string; password: string; userId: string }> {
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'testpassword123';
    const testUserId = 'test-user-' + Date.now();

    try {
      // Create user directly in the database
      await this.db.execute(sql`
        INSERT INTO users (id, name, email, email_verified) 
        VALUES (${testUserId}, 'Test User', ${testEmail}, true)
      `);

      // Create account with password (better-auth format)
      await this.db.execute(sql`
        INSERT INTO accounts (id, account_id, provider_id, user_id, password) 
        VALUES (${testUserId + '-account'}, ${testUserId}, 'credential', ${testUserId}, ${testPassword})
      `);

      return { email: testEmail, password: testPassword, userId: testUserId };
    } catch (error) {
      console.error('Failed to create test user:', error);
      throw error;
    }
  }

  async loginTestUser(page: any, email: string, password: string) {
    // Navigate to login page
    await page.goto('/auth/signin');
    
    // Fill in login form
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/');
  }

  async runCommand(cmd: string, cwd?: string): Promise<{ stdout: string; stderr: string; success: boolean }> {
    try {
      const result = execSync(cmd, {
        encoding: 'utf8',
        stdio: 'pipe',
        cwd: cwd || process.cwd()
      });
      return {
        stdout: result,
        stderr: '',
        success: true
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        success: false
      };
    }
  }

  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getLocalPcapFiles(): PcapFileInfo[] {
    const fixturesDir = path.join(__dirname, '../fixtures/pcaps');
    const pcapFiles: PcapFileInfo[] = [
      {
        filename: 'wpa2linkuppassphraseiswireshark.pcap',
        password: 'wireshark',
        essid: 'ikeriri-5g',
        description: 'WPA2 PSK linked up process (SSID: ikeriri-5g, Password: wireshark)'
      }
    ];

    // Ensure target directory exists
    if (!fs.existsSync(this.config.testInputDir)) {
      fs.mkdirSync(this.config.testInputDir, { recursive: true });
    }

    const results: PcapFileInfo[] = [];
    for (const pcapInfo of pcapFiles) {
      const sourcePath = path.join(fixturesDir, pcapInfo.filename);
      const targetPath = path.join(this.config.testInputDir, pcapInfo.filename);

      if (fs.existsSync(sourcePath)) {
        try {
          fs.copyFileSync(sourcePath, targetPath);
          results.push({
            ...pcapInfo
          });
        } catch (error) {
          console.warn(`Failed to copy pcap file from ${sourcePath} to ${targetPath}:`, error);
          // Create minimal test file as fallback
          this.createMockPcap(pcapInfo.filename);
          results.push(pcapInfo);
        }
      } else {
        console.warn(`Pcap file not found: ${sourcePath}`);
        // Create minimal test file as fallback
        this.createMockPcap(pcapInfo.filename);
        results.push(pcapInfo);
      }
    }

    return results;
  }

  /**
   * Clear the main application database (for tests)
   */
  async clearAppDatabase() {
    const dbUrl = process.env.DATABASE_URL || 'postgresql://autopwn:autopwn_password@localhost:5432/autopwn';
    console.log(`[DEBUG] Attempting to clear database at: ${dbUrl}`);

    try {
      const client = postgres(dbUrl, {
        host: 'localhost',
        // Force IPv4 by using localhost
      });
      const db = drizzle(client, { schema });

      // Clear tables in correct order (respect foreign keys)
      await db.execute(sql`DELETE FROM results`);
      await db.execute(sql`DELETE FROM job_dictionaries`);
      await db.execute(sql`DELETE FROM job_items`);
      await db.execute(sql`DELETE FROM jobs`);
      await db.execute(sql`DELETE FROM dictionaries`);
      await db.execute(sql`DELETE FROM pcap_essid_mapping`);
      await db.execute(sql`DELETE FROM sessions`);
      await db.execute(sql`DELETE FROM accounts`);
      await db.execute(sql`DELETE FROM users`);

      await client.end();
      console.log('✓ Application database cleared');
    } catch (error: any) {
      console.warn('Failed to clear app database:', error?.message || error);
      console.warn('[DEBUG] Database error details:', error);
    }
  }

  /**
   * Clear the dictionaries folder (for tests)
   */
  clearDictionariesFolder() {
    const dictPath = process.env.DICTIONARIES_PATH || path.join(__dirname, '../../volumes/dictionaries');
    console.log(`[DEBUG] Attempting to clear dictionaries at: ${dictPath}`);
    console.log(`[DEBUG] Dictionaries directory exists: ${fs.existsSync(dictPath)}`);
    
    if (fs.existsSync(dictPath)) {
      try {
        const files = fs.readdirSync(dictPath);
        console.log(`[DEBUG] Found ${files.length} files in dictionaries directory`);
        for (const file of files) {
          // Only delete custom-generated files, keep system dictionaries
          if (file.startsWith('custom-')) {
            fs.unlinkSync(path.join(dictPath, file));
            console.log(`[DEBUG] Deleted custom dictionary: ${file}`);
          }
        }
        console.log('✓ Custom dictionaries cleared');
      } catch (error) {
        console.warn('Failed to clear dictionaries folder:', error);
        console.warn('[DEBUG] Dictionaries error details:', error);
      }
    } else {
      console.warn('Dictionaries directory not found at', dictPath);
      // Try to create the dictionaries directory if it doesn't exist
      try {
        fs.mkdirSync(dictPath, { recursive: true });
        console.log(`[DEBUG] Dictionaries directory created: ${dictPath}`);
      } catch (mkdirError: any) {
        console.warn(`[DEBUG] Failed to create dictionaries directory: ${mkdirError?.message || mkdirError}`);
      }
    }
  }

  /**
   * Clear the uploads folder (for tests)
   */
  clearUploadsFolder() {
    const uploadsPath = process.env.UPLOADS_PATH || path.join(__dirname, '../../volumes/uploads');
    console.log(`[DEBUG] Attempting to clear uploads at: ${uploadsPath}`);
    console.log(`[DEBUG] Uploads directory exists: ${fs.existsSync(uploadsPath)}`);
    
    if (fs.existsSync(uploadsPath)) {
      try {
        const files = fs.readdirSync(uploadsPath);
        console.log(`[DEBUG] Found ${files.length} files in uploads directory`);
        for (const file of files) {
          fs.unlinkSync(path.join(uploadsPath, file));
          console.log(`[DEBUG] Deleted upload file: ${file}`);
        }
        console.log('✓ Uploads folder cleared');
      } catch (error) {
        console.warn('Failed to clear uploads folder:', error);
        console.warn('[DEBUG] Uploads error details:', error);
      }
    } else {
      console.warn('Uploads directory not found at', uploadsPath);
      // Try to create the uploads directory if it doesn't exist
      try {
        fs.mkdirSync(uploadsPath, { recursive: true });
        console.log(`[DEBUG] Uploads directory created: ${uploadsPath}`);
      } catch (mkdirError: any) {
        console.warn(`[DEBUG] Failed to create uploads directory: ${mkdirError?.message || mkdirError}`);
      }
    }
  }

  /**
   * Complete cleanup of application data (for tests)
   */
  async clearAllAppData() {
    await this.clearAppDatabase();
    this.clearDictionariesFolder();
    this.clearUploadsFolder();
  }

  /**
   * Add test results data to database (for UI testing)
   */
  async addTestResults() {
    const dbUrl = process.env.DATABASE_URL || 'postgresql://autopwn:autopwn_password@localhost:5432/autopwn';
    console.log(`[DEBUG] Attempting to add test results to database at: ${dbUrl}`);

    try {
      const client = postgres(dbUrl, {
        host: 'localhost',
        // Force IPv4 by using localhost
      });
      const db = drizzle(client, { schema });

      // Create test user if not exists
      const testUserId = 'test-user-results';
      await db.execute(sql`
        INSERT INTO users (id, name, email, email_verified) 
        VALUES (${testUserId}, 'Test User', 'test-results@example.com', true)
        ON CONFLICT (email) DO NOTHING
      `);

      // Insert test jobs
      const job1Result = await db.execute(sql`
        INSERT INTO jobs (user_id, filename, hash_count, status) 
        VALUES (${testUserId}, 'test1.pcap', 1, 'completed') 
        RETURNING id
      `);
      
      const job2Result = await db.execute(sql`
        INSERT INTO jobs (user_id, filename, hash_count, status) 
        VALUES (${testUserId}, 'test2.pcap', 1, 'completed') 
        RETURNING id
      `);

      const job1Id = (job1Result as any)[0]?.id;
      const job2Id = (job2Result as any)[0]?.id;

      console.log(`[DEBUG] Inserted test jobs with IDs: ${job1Id}, ${job2Id}`);

      // Insert test results (need enough for pagination - 15 results)
      for (let i = 1; i <= 15; i++) {
        const jobId = i <= 7 ? job1Id : job2Id;
        const essid = i <= 7 ? 'TestNetwork-A' : 'TestNetwork-B';
        await db.execute(sql`
          INSERT INTO results (job_id, user_id, essid, password) 
          VALUES (${jobId}, ${testUserId}, ${essid}, ${'password' + i})
        `);
      }

      await client.end();
      console.log('✓ Test results added to database');
    } catch (error: any) {
      console.warn('Failed to add test results:', error?.message || error);
      console.warn('[DEBUG] Test results error details:', error);
    }
  }

  private async cleanup() {
    try {
      // Close database connection
      if (this.client) {
        await this.client.end();
      }

      // Drop test database
      const dbName = this.config.testDbUrl.split('/').pop();
      const baseUrl = this.config.testDbUrl.replace(`/${dbName}`, '/postgres');
      
      try {
        const adminClient = postgres(baseUrl, {
          host: 'localhost',
          // Force IPv4 by using localhost
        });
        await adminClient.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
        await adminClient.end();
      } catch (error) {
        console.warn('Failed to drop test database:', error);
      }

      // Remove test files and directories
      const pathsToRemove = [
        this.config.testInputDir,
        this.config.testOutputDir,
        this.config.testDictDir
      ];

      pathsToRemove.forEach(p => {
        if (fs.existsSync(p)) {
          if (fs.statSync(p).isDirectory()) {
            fs.rmSync(p, { recursive: true, force: true });
          } else {
            fs.unlinkSync(p);
          }
        }
      });
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }

  // Call all cleanup tasks
  async cleanupAll() {
    for (const cleanupTask of this.cleanupTasks) {
      try {
        cleanupTask();
      } catch (error) {
        console.warn('Cleanup task warning:', error);
      }
    }
  }
}

export const expect = {
  toBe: (actual: any, expected: any) => {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, but got ${actual}`);
    }
  },
  toContain: (actual: string, expected: string) => {
    if (!actual.includes(expected)) {
      throw new Error(`Expected "${actual}" to contain "${expected}"`);
    }
  },
  toBeDefined: (actual: any) => {
    if (actual === undefined) {
      throw new Error('Expected value to be defined');
    }
  },
  toBeNull: (actual: any) => {
    if (actual !== null) {
      throw new Error(`Expected null, but got ${actual}`);
    }
  },
  toBeGreaterThan: (actual: number, expected: number) => {
    if (actual <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`);
    }
  }
};

export async function runTest(testName: string, testFn: (utils: TestUtils) => Promise<void>) {
  console.log(`🧪 Running test: ${testName}`);

  let utils: TestUtils | undefined;
  
  try {
    utils = new TestUtils(testName);
    // Wait for async initialization
    await (utils as any).initializeTestDatabase();
    
    await testFn(utils);
    console.log(`✅ ${testName} - PASSED`);
  } catch (error: any) {
    console.log(`❌ ${testName} - FAILED: ${error.message}`);
    throw error;
  } finally {
    if (utils) {
      await utils.cleanupAll();
    }
  }
}

export async function runTests(tests: Array<{ name: string; fn: (utils: TestUtils) => Promise<void> }>) {
  console.log('🚀 Starting E2E Test Suite');
  console.log('='.repeat(50));

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const test of tests) {
    try {
      await runTest(test.name, test.fn);
      passed++;
    } catch (error) {
      failed++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('='.repeat(50));
  console.log('📊 Test Results');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed.`);
    process.exit(1);
  }
}