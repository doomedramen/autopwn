
import crypto from 'crypto'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Generate a secure random password
function generatePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(crypto.randomInt(0, charset.length))
  }
  return password
}

// Get password based on environment - fixed for test, random for others
function getPasswordForEnvironment(): string {
  if (process.env.NODE_ENV === 'test' || process.env.TEST_ENV) {
    // Use a consistent, known password for testing
    return 'autopwn-test-password';
  }
  return generatePassword();
}

export async function createSuperUser() {
  const email = 'admin@autopwn.local'
  const password = getPasswordForEnvironment();

  try {
    // Check if superuser already exists using database query
    const existingSuperUser = await db.query.users.findFirst({
      where: eq(users.email, email)
    })

    if (existingSuperUser) {
      console.log('✅ Superuser already exists:')
      console.log(`   Email: ${email}`)

      // Only show the actual password in test environments for debugging purposes
      if (process.env.NODE_ENV === 'test' || process.env.TEST_ENV) {
        console.log(`   Password: ${password} (test environment)`)
      } else {
        console.log('   Password: [Use existing password]')
      }
      return
    }

    // Create user manually with proper Better Auth field values
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = crypto.randomUUID();

    // Insert user record
    await db.insert(users).values({
      id: userId,
      email,
      name: 'Admin User',
      role: 'admin',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert account record with correct Better Auth values
    const { accounts } = await import('./schema');
    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      userId: userId,
      accountId: userId,  // For credential accounts, accountId = userId
      providerId: 'credential',  // Better Auth uses "credential" for email/password
      provider: 'credential',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('🎉 Superuser created successfully!')
    console.log('=====================================')
    console.log(`📧 Email: ${email}`)

    // Only show the actual password in test environments for security
    if (process.env.NODE_ENV === 'test' || process.env.TEST_ENV) {
      console.log(`🔑 Password: ${password} (test environment)`)
    } else {
      console.log(`🔑 Password: [Password hidden in non-test environment]`)
    }

    console.log('=====================================')
    console.log('⚠️  Save these credentials securely!')
    console.log('🔗 Login at: http://localhost:3002/auth/sign-in')
  } catch (error) {
    console.error('❌ Error creating superuser:', error)
    throw error
  }
}

// Function to create additional users (admin only)
export async function createUser(email: string, role: 'user' | 'admin' = 'user') {
  const password = getPasswordForEnvironment();

  try {
    // Create user manually with proper Better Auth field values
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = crypto.randomUUID();

    // Insert user record
    await db.insert(users).values({
      id: userId,
      email,
      name: email.split('@')[0],
      role,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert account record with correct Better Auth values
    const { accounts } = await import('./schema');
    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      userId: userId,
      accountId: userId,  // For credential accounts, accountId = userId
      providerId: 'credential',  // Better Auth uses "credential" for email/password
      provider: 'credential',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ User created successfully!`)
    console.log(`📧 Email: ${email}`)

    // Only show the actual password in test environments for security
    if (process.env.NODE_ENV === 'test' || process.env.TEST_ENV) {
      console.log(`🔑 Password: ${password} (test environment)`)
    } else {
      console.log('🔑 Password: [Password hidden in non-test environment]')
    }

    console.log(`👤 Role: ${role}`)

    return { email, password, role }
  } catch (error) {
    console.error('❌ Error creating user:', error)
    throw error
  }
}