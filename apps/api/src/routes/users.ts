import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@/db'
import { users as usersTable, selectUserSchema } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { authenticate, requireAdmin, getUserId } from '@/middleware/auth'

const usersRouter = new Hono()

// Apply authentication middleware to all routes
usersRouter.use('*', authenticate)

// Get all users (admin only)
usersRouter.get('/', requireAdmin, async (c) => {
  try {
    const allUsers = await db.select({
        // Don't return sensitive fields
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        emailVerified: usersTable.emailVerified,
        image: usersTable.image,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)

    return c.json({
      success: true,
      data: allUsers,
      count: allUsers.length,
    })
  } catch (error) {
    console.error('Get users error:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch users',
    }, 500)
  }
})

// Get single user by ID
usersRouter.get('/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const user = await db.select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        emailVerified: usersTable.emailVerified,
        image: usersTable.image,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1)

    if (!user || user.length === 0) {
      return c.json({
        success: false,
        error: 'User not found',
      }, 404)
    }

    return c.json({
      success: true,
      data: user[0],
    })
  } catch (error) {
    console.error('Get user error:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch user',
    }, 500)
  }
})

export { usersRouter as usersRoutes }