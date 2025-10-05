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

    const results: PcapFileInfo[] = [];
    for (const pcapInfo of pcapFiles) {
      const sourcePath = path.join(fixturesDir, pcapInfo.filename);
      const targetPath = path.join(this.config.testInputDir, pcapInfo.filename);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        results.push({
          ...pcapInfo
        });
      } else {
        console.warn(`Pcap file not found: ${sourcePath}`);
        // Create minimal test file as fallback
        this.createMockPcap(pcapInfo.filename);
        results.push(pcapInfo);
      }
    }

    return results;
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