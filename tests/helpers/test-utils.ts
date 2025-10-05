import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

export interface TestConfig {
  testDbPath: string;
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

  constructor(testName: string) {
    const testId = `${testName}-${Date.now()}`;
    this.config = {
      testDbPath: path.join(__dirname, '../fixtures', `${testId}.db`),
      testInputDir: path.join(__dirname, '../fixtures', `${testId}-input`),
      testOutputDir: path.join(__dirname, '../fixtures', `${testId}-output`),
      testDictDir: path.join(__dirname, '../fixtures', `${testId}-dicts`)
    };

    // Setup test environment
    this.setupTestEnvironment();
    this.cleanupTasks.push(() => this.cleanup());
  }

  private setupTestEnvironment() {
    // Create test directories
    fs.mkdirSync(this.config.testInputDir, { recursive: true });
    fs.mkdirSync(this.config.testOutputDir, { recursive: true });
    fs.mkdirSync(this.config.testDictDir, { recursive: true });

    // Initialize test database with schema
    this.initializeTestDatabase();
  }

  private initializeTestDatabase() {
    const schemaPath = path.join(__dirname, '../../packages/shared/src/schema.ts');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    const schemaMatch = schemaContent.match(/export const DB_SCHEMA = `\n([\s\S]*?)\n`;/);
    if (!schemaMatch) {
      throw new Error('Could not extract database schema');
    }

    const createTablesSql = schemaMatch[1];

    const db = new Database(this.config.testDbPath);
    db.exec(createTablesSql);

    // Insert test dictionaries
    db.exec(`
      INSERT OR IGNORE INTO dictionaries (id, name, path, size) VALUES
        (1, 'test-dict-small', '${path.join(this.config.testDictDir, 'small.txt')}', 100),
        (2, 'test-dict-medium', '${path.join(this.config.testDictDir, 'medium.txt')}', 1000),
        (3, 'test-dict-large', '${path.join(this.config.testDictDir, 'large.txt')}', 10000);
    `);

    db.close();
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

  getDatabase(): Database.Database {
    return new Database(this.config.testDbPath);
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
  clearAppDatabase() {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../volumes/db/autopwn.db');
    console.log(`[DEBUG] Attempting to clear database at: ${dbPath}`);
    console.log(`[DEBUG] Database exists: ${fs.existsSync(dbPath)}`);
    
    if (fs.existsSync(dbPath)) {
      try {
        const db = new Database(dbPath);
        // Use PRAGMA to ensure we can modify
        db.pragma('journal_mode = WAL');

        // Clear tables in correct order (respect foreign keys)
        db.exec('DELETE FROM results');
        db.exec('DELETE FROM job_dictionaries');
        db.exec('DELETE FROM job_items');
        db.exec('DELETE FROM jobs');
        db.exec('DELETE FROM dictionaries');

        db.close();
        console.log('✓ Application database cleared');
      } catch (error: any) {
        console.warn('Failed to clear app database:', error?.message || error);
        console.warn('[DEBUG] Database error details:', error);
      }
    } else {
      console.warn('App database not found at', dbPath);
      // Try to create the database directory if it doesn't exist
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        console.log(`[DEBUG] Creating database directory: ${dbDir}`);
        try {
          fs.mkdirSync(dbDir, { recursive: true });
          console.log(`[DEBUG] Database directory created successfully`);
        } catch (mkdirError: any) {
          console.warn(`[DEBUG] Failed to create database directory: ${mkdirError?.message || mkdirError}`);
        }
      }
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
  clearAllAppData() {
    this.clearAppDatabase();
    this.clearDictionariesFolder();
    this.clearUploadsFolder();
  }

  /**
   * Add test results data to database (for UI testing)
   */
  addTestResults() {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../volumes/db/autopwn.db');
    console.log(`[DEBUG] Attempting to add test results to database at: ${dbPath}`);
    console.log(`[DEBUG] Database exists: ${fs.existsSync(dbPath)}`);
    
    if (fs.existsSync(dbPath)) {
      try {
        const db = new Database(dbPath);
        db.pragma('journal_mode = WAL');

        // Insert test jobs
        const job1 = db.prepare('INSERT INTO jobs (filename, hash_count, status) VALUES (?, ?, ?)').run('test1.pcap', 1, 'completed');
        const job2 = db.prepare('INSERT INTO jobs (filename, hash_count, status) VALUES (?, ?, ?)').run('test2.pcap', 1, 'completed');
        console.log(`[DEBUG] Inserted test jobs with IDs: ${job1.lastInsertRowid}, ${job2.lastInsertRowid}`);

        // Insert test results (need enough for pagination - 15 results)
        for (let i = 1; i <= 15; i++) {
          const jobId = i <= 7 ? job1.lastInsertRowid : job2.lastInsertRowid;
          const essid = i <= 7 ? 'TestNetwork-A' : 'TestNetwork-B';
          db.prepare('INSERT INTO results (job_id, essid, password) VALUES (?, ?, ?)').run(
            jobId,
            essid,
            `password${i}`
          );
        }

        db.close();
        console.log('✓ Test results added to database');
      } catch (error: any) {
        console.warn('Failed to add test results:', error?.message || error);
        console.warn('[DEBUG] Test results error details:', error);
      }
    } else {
      console.warn('[DEBUG] Cannot add test results - database does not exist');
    }
  }

  private cleanup() {
    try {
      // Remove test files and directories
      const pathsToRemove = [
        this.config.testDbPath,
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

  const utils = new TestUtils(testName);

  try {
    await testFn(utils);
    console.log(`✅ ${testName} - PASSED`);
  } catch (error: any) {
    console.log(`❌ ${testName} - FAILED: ${error.message}`);
    throw error;
  } finally {
    await utils.cleanupAll();
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