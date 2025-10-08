import { faker } from '@faker-js/faker';
import {
  db,
  users,
  dictionaries,
  jobs,
  jobItems,
  jobDictionaries,
  results,
  type User,
  type Dictionary,
  type Job,
  type Result
} from '@autopwn/shared';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export type TestUser = User & {
  password: string;
};

export class TestDataFactory {
  /**
   * Create a test user with generated data
   */
  static createTestUser(overrides: Partial<TestUser> = {}): TestUser {
    const password = overrides.password || faker.internet.password({ length: 12 });
    return {
      id: '', // Will be set by database - it's a text field (UUID)
      email: faker.internet.email(),
      name: faker.person.fullName(),
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      password,
      ...overrides
    };
  }

  /**
   * Create a test dictionary entry
   */
  static createTestDictionary(userId: string, overrides: Partial<Dictionary> = {}): Dictionary {
    return {
      id: 0, // Will be set by database
      userId: userId,
      name: `${faker.system.commonFileName('txt')}.txt`,
      path: `/tmp/dicts/${faker.system.fileName()}`,
      size: faker.number.int({ min: 1000, max: 100000 }),
      ...overrides
    };
  }

  /**
   * Create a test job
   */
  static createTestJob(userId: string, overrides: Partial<Job> = {}): Job {
    return {
      id: 0, // Will be set by database
      jobId: null,
      userId: userId,
      filename: faker.system.fileName({ extensionCount: 1 }) + '.pcap',
      status: 'pending',
      priority: 0,
      paused: 0,
      batchMode: 0,
      itemsTotal: 0,
      itemsCracked: 0,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      currentDictionary: null,
      progress: null,
      hashCount: 0,
      speed: null,
      eta: null,
      error: null,
      logs: null,
      captures: null,
      totalHashes: 0,
      ...overrides
    };
  }

  /**
   * Create a test result
   */
  static createTestResult(jobId: number, userId: string, overrides: Partial<Result> = {}): Result {
    return {
      id: 0, // Will be set by database
      jobId,
      userId,
      essid: faker.string.alphanumeric({ length: faker.number.int({ min: 8, max: 32 }) }),
      password: faker.internet.password({ length: 8, memorable: true }),
      crackedAt: faker.date.recent(),
      pcapFilename: faker.system.fileName({ extensionCount: 1 }) + '.pcap',
      ...overrides
    };
  }

  /**
   * Create WPA2 test PCAP file for testing
   */
  static createWPA2TestPcap(): string {
    const path = '/tmp/wpa2-test.pcap';
    require('fs').writeFileSync(path, Buffer.from('fake-pcap-content-wpa2'));
    return path;
  }

  /**
   * Create mock PCAP file
   */
  static createMockPcap(filename: string, content?: Buffer): string {
    const path = `/tmp/${filename}`;
    const buffer = content || Buffer.from(`fake-pcap-content-${randomBytes(16).toString('hex')}`);
    require('fs').writeFileSync(path, buffer);
    return path;
  }

  /**
   * Generate test ESSID list
   */
  static generateTestEssids(count: number = 5): string[] {
    const essids = [];
    for (let i = 0; i < count; i++) {
      essids.push(faker.string.alphanumeric({ length: faker.number.int({ min: 8, max: 32 }) }));
    }
    return essids;
  }

  /**
   * Generate test passwords
   */
  static generateTestPasswords(count: number = 5): string[] {
    const passwords = [];
    for (let i = 0; i < count; i++) {
      passwords.push(faker.internet.password({ length: 8, memorable: true }));
    }
    return passwords;
  }

  /**
   * Generate realistic test data for analytics
   */
  static generateAnalyticsTestData(userId: string, jobCount: number = 10) {
    const jobs: Job[] = [];
    const results: Result[] = [];

    for (let i = 0; i < jobCount; i++) {
      const job = this.createTestJob(userId, {
        status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
        progress: faker.helpers.arrayElement([0, 25, 50, 75, 100]),
        itemsCracked: faker.number.int({ min: 0, max: 10 }),
        createdAt: faker.date.past({ years: 1 })
      });
      jobs.push(job);

      // Add results for completed jobs
      if (job.status === 'completed' && job.itemsCracked && job.itemsCracked > 0) {
        for (let j = 0; j < job.itemsCracked; j++) {
          const result = this.createTestResult(job.id, userId, {
            crackedAt: faker.date.between({ from: job.createdAt, to: new Date() })
          });
          results.push(result);
        }
      }
    }

    return { jobs, results };
  }
}