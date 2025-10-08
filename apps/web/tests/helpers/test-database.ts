import { db, users, accounts, jobs, results, dictionaries, jobDictionaries } from '@autopwn/shared';
import { eq, and, sql } from 'drizzle-orm';
import { TestDataFactory, type TestUser } from '../fixtures/data-factory';

/**
 * Test database utilities for proper isolation and cleanup
 */
export class TestDatabase {
  private cleanupCallbacks: Array<() => Promise<void>> = [];
  private initialized = false;

  /**
   * Initialize the database connection for testing
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.waitForDatabase();
    this.initialized = true;
  }

  /**
   * Cleanup the database instance
   */
  async cleanup(): Promise<void> {
    // Execute any registered cleanup callbacks
    for (const cleanup of this.cleanupCallbacks) {
      try {
        await cleanup();
      } catch (error: any) {
        console.error('Test cleanup callback failed:', error);
      }
    }
    this.cleanupCallbacks = [];
  }

  /**
   * Setup isolated test environment with a dedicated user
   */
  async setupTestEnvironment(): Promise<TestUser> {
    // Create a unique test user for this test run
    const testUser = TestDataFactory.createTestUser({
      email: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
    });

    // Generate UUID for test user
    const userId = crypto.randomUUID();

    // Insert test user directly into database
    await db.insert(users)
      .values({
        id: userId,
        email: testUser.email,
        name: testUser.name,
        emailVerified: testUser.emailVerified,
        createdAt: testUser.createdAt,
        updatedAt: testUser.updatedAt
      });

    // Insert account with password
    await db.insert(accounts)
      .values({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId: userId,
        password: await this.hashPassword(testUser.password),
        createdAt: new Date(),
        updatedAt: new Date()
      });

    // Update test user with the actual ID
    testUser.id = userId;

    // Register cleanup for this user
    this.cleanupCallbacks.push(() => this.cleanupUserData(userId));

    return testUser;
  }

  /**
   * Create test data with automatic cleanup
   */
  async createTestData(userId: string, config: {
    dictionaryCount?: number;
    jobCount?: number;
    resultCount?: number;
  } = {}) {
    const dictionary = TestDataFactory.createTestDictionary(userId);
    const job = TestDataFactory.createTestJob(userId);
    const result = TestDataFactory.createTestResult(job.id, userId);

    // Create dictionary in database
    const [createdDict] = await db.insert(dictionaries)
      .values({
        userId: dictionary.userId,
        name: dictionary.name,
        path: dictionary.path,
        size: dictionary.size
      })
      .returning();

    // Create job in database
    const [createdJob] = await db.insert(jobs)
      .values({
        userId: job.userId,
        filename: job.filename,
        status: job.status,
        priority: job.priority,
        paused: job.paused,
        batchMode: job.batchMode,
        itemsTotal: job.itemsTotal,
        itemsCracked: job.itemsCracked,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        currentDictionary: job.currentDictionary,
        progress: job.progress,
        hashCount: job.hashCount,
        speed: job.speed,
        eta: job.eta,
        error: job.error,
        logs: job.logs,
        captures: job.captures
      })
      .returning();

    // Create job-dictionary relationship
    await db.insert(jobDictionaries)
      .values({
        jobId: createdJob.id,
        dictionaryId: createdDict.id,
        status: 'pending'
      });

    // Create result if specified
    let createdResult = null;
    if (config.resultCount && config.resultCount > 0) {
      [createdResult] = await db.insert(results)
        .values({
          jobId: createdJob.id,
          userId: result.userId,
          essid: result.essid,
          password: result.password,
          crackedAt: result.crackedAt,
          pcapFilename: result.pcapFilename
        })
        .returning();
    }

    return { dictionary: createdDict, job: createdJob, result: createdResult };
  }

  /**
   * Cleanup all data for a specific user
   */
  async cleanupUserData(userId: string): Promise<void> {
    try {
      // Delete in proper order to respect foreign key constraints
      await db.delete(results).where(eq(results.userId, userId));
      await db.delete(jobDictionaries)
        .where(sql`job_id IN (SELECT id FROM jobs WHERE user_id = ${userId})`);
      await db.delete(jobs).where(eq(jobs.userId, userId));
      await db.delete(dictionaries).where(eq(dictionaries.userId, userId));
      await db.delete(accounts).where(eq(accounts.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    } catch (error: any) {
      console.error('Failed to cleanup user data:', error);
    }
  }

  /**
   * Cleanup all test data (call this in global teardown)
   */
  async cleanupAllTestData(): Promise<void> {
    // Delete all test users (those with test- prefix in email)
    try {
      const testUsers = await db.select({ id: users.id })
        .from(users)
        .where(sql`email LIKE 'test-%'`);

      for (const user of testUsers) {
        await this.cleanupUserData(user.id);
      }
    } catch (error: any) {
      console.error('Failed to cleanup all test data:', error);
    }

    // Execute any registered cleanup callbacks
    for (const cleanup of this.cleanupCallbacks) {
      try {
        await cleanup();
      } catch (error: any) {
        console.error('Test cleanup callback failed:', error);
      }
    }

    this.cleanupCallbacks = [];
  }

  /**
   * Get user by email for test verification
   */
  async getUserByEmail(email: string) {
    return await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
  }

  /**
   * Get job count for user
   */
  async getJobCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql`count(*)` })
      .from(jobs)
      .where(eq(jobs.userId, userId));
    return Number(result[0]?.count || 0);
  }

  /**
   * Get result count for user
   */
  async getResultCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql`count(*)` })
      .from(results)
      .where(eq(results.userId, userId));
    return Number(result[0]?.count || 0);
  }

  /**
   * Wait for database operations to complete
   */
  async waitForDatabase(): Promise<void> {
    // Simple health check - try to query the database
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      try {
        await db.select({ count: sql`count(*)` }).from(users).limit(1);
        return;
      } catch (error: any) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('Database not available after 30 seconds');
  }

  /**
   * Hash password for better-auth compatibility
   */
  private async hashPassword(password: string): Promise<string> {
    // Using bcrypt similar to better-auth's default
    const bcrypt = await import('bcrypt');
    return bcrypt.hash(password, 10);
  }

  /**
   * Verify password (for test assertions)
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcrypt');
    return bcrypt.compare(password, hash);
  }
}