import { db } from './src/db'
import { users, accounts } from './src/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function createTestUser() {
  try {
    console.log('🔄 Creating test user...')

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, 'admin@autopwn.local')
    })

    if (existingUser) {
      console.log('✅ User already exists, deleting...')
      // Delete accounts first
      await db.delete(accounts).where(eq(accounts.userId, existingUser.id))
      // Delete user
      await db.delete(users).where(eq(users.id, existingUser.id))
    }

    // Create new user
    const userId = 'admin-test-user-id'
    const email = 'admin@autopwn.local'
    const password = 'autopwn-test-password'

    console.log('📧 Creating user record...')
    await db.insert(users).values({
      id: userId,
      email,
      name: 'Admin User',
      role: 'admin',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log('🔐 Creating account record...')
    const hashedPassword = await bcrypt.hash(password, 10)
    await db.insert(accounts).values({
      id: 'admin-test-account-id',
      userId: userId,
      accountId: userId, // This is key - accountId should equal userId for credential providers
      providerId: 'credential', // This must be 'credential' for Better Auth
      provider: 'credential',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log('✅ Test user created successfully!')
    console.log(`📧 Email: ${email}`)
    console.log(`🔑 Password: ${password}`)

    // Verify user was created
    const createdUser = await db.query.users.findFirst({
      where: eq(users.email, email)
    })

    console.log('🔍 Verification - User created:', !!createdUser)

  } catch (error) {
    console.error('❌ Error creating test user:', error)
  }
}

createTestUser()