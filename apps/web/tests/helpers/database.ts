import postgres from 'postgres';

/**
 * Database helper for E2E tests
 * Connects directly to the test database to clean up and seed data
 */

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/autopwn_test';

/**
 * Create a database connection for E2E tests
 */
export function getTestDb() {
  return postgres(DATABASE_URL, { max: 1 });
}

/**
 * Clean all data from the test database
 * Run this before the test suite to ensure a clean state
 */
export async function cleanDatabase() {
  const sql = getTestDb();

  console.log('🧹 Cleaning test database...');

  // Delete all data in reverse order of dependencies
  const tables = [
    'audit_logs',
    'job_results',
    'jobs',
    'captures',
    'dictionaries',
    'networks',
    'verifications',
    'sessions',
    'accounts',
    'users',
    'config',
  ];

  for (const table of tables) {
    try {
      await sql.unsafe(`DELETE FROM ${table} CASCADE`);
    } catch (error) {
      // Table might not exist
    }
  }

  await sql.end();
  console.log('✅ Test database cleaned');
}

/**
 * Create a test user directly in the database
 */
export async function createTestUser(options: {
  email: string;
  password: string;
  name: string;
  role?: string;
}) {
  const sql = getTestDb();
  const bcrypt = await import('bcryptjs');
  const { v4: uuidv4 } = await import('uuid');

  const userId = uuidv4();
  const hashedPassword = await bcrypt.hash(options.password, 10);

  // Create user
  await sql`
    INSERT INTO users (id, email, name, role, email_verified, created_at, updated_at)
    VALUES (${userId}, ${options.email}, ${options.name}, ${options.role || 'user'}, true, NOW(), NOW())
  `;

  // Create account for credential auth
  const accountId = uuidv4();
  await sql`
    INSERT INTO accounts (id, user_id, account_id, provider_id, provider, password, created_at, updated_at)
    VALUES (${accountId}, ${userId}, ${userId}, 'credential', 'credential', ${hashedPassword}, NOW(), NOW())
  `;

  await sql.end();

  return { id: userId, email: options.email, name: options.name, role: options.role || 'user' };
}

/**
 * Delete a test user from the database
 */
export async function deleteTestUser(email: string) {
  const sql = getTestDb();

  try {
    await sql`DELETE FROM users WHERE email = ${email}`;
  } catch (error) {
    // User might not exist
  }

  await sql.end();
}
