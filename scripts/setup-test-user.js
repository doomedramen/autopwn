#!/usr/bin/env node

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://autopwn:autopwn_password@localhost:5432/autopwn'
});

async function setupTestUser() {
  const email = process.env.TEST_EMAIL || 'test@example.com';
  const password = process.env.TEST_PASSWORD || 'testpassword123';

  console.log(`Setting up test user: ${email}`);

  try {
    // Hash the password using bcrypt (simplified for testing)
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log('Test user already exists, updating password...');
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [passwordHash, email]
      );
    } else {
      console.log('Creating new test user...');
      await pool.query(
        'INSERT INTO users (email, password_hash, name, email_verified) VALUES ($1, $2, $3, false)',
        [email, passwordHash, 'Test User']
      );
    }

    console.log('✅ Test user setup complete!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('You can now use these credentials for e2e testing.');

  } catch (error) {
    console.error('❌ Error setting up test user:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupTestUser();