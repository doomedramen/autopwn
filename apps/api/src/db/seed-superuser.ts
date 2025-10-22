
import crypto from 'crypto'
import { authClient } from '@/lib/auth'
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

    // Since Better Auth signup is disabled, and the admin plugin doesn't have a create method,
    // we need to directly create the user in the database with properly hashed password
    // Better Auth uses bcrypt internally to hash passwords, let's import bcrypt and use it
    
    // Import the password hashing function from Better Auth
    // For direct database insertion, we need to hash the password properly
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create a unique ID for the user
    const userId = crypto.randomUUID();
    
    // Insert user record into the users table
    await db.insert(users).values({
      id: userId,
      email,
      name: 'Admin User',
      role: 'admin',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert account record into the accounts table with the hashed password
    // The accounts table links users to their authentication details
    const { accounts } = await import('./schema');  // Import accounts schema
    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      userId: userId,
      accountId: userId, // For local accounts, account ID can be same as user ID
      providerId: 'credentials', // For email/password authentication
      provider: 'credentials',
      password: hashedPassword, // Store the properly hashed password
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
    // For creating additional users when signup is disabled, use the same direct approach
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create a unique ID for the user
    const userId = crypto.randomUUID();
    
    // Insert user record into the users table
    await db.insert(users).values({
      id: userId,
      email,
      name: email.split('@')[0],
      role,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert account record into the accounts table with the hashed password
    const { accounts } = await import('./schema');
    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      userId: userId,
      accountId: userId,
      providerId: 'credentials',
      provider: 'credentials',
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