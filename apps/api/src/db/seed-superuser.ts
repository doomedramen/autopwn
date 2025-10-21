import { authClient } from '@/lib/auth'
import crypto from 'crypto'

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
    // Check if superuser already exists
    const existingUsers = await authClient.admin.listUsers()
    const existingSuperUser = existingUsers.users?.find(user => user.email === email)

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

    // Create superuser with admin role
    const result = await authClient.admin.createUser({
      email,
      password,
      role: 'admin',
    })

    if (result.error) {
      console.error('❌ Failed to create superuser:', result.error)
      throw result.error
    }

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
    const result = await authClient.admin.createUser({
      email,
      password,
      role,
    })

    if (result.error) {
      throw new Error(result.error.message || 'Failed to create user')
    }

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