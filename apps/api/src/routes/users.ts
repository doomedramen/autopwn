import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@/db'
import { users, selectUserSchema } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { authenticate, requireAdmin, getUserId } from '@/middleware/auth'

const users = new Hono()

// Apply authentication middleware to all routes
users.use('*', authenticate)

// Get all users (admin only)
users.get('/', requireAdmin, async (c) => {
  try {
    const allUsers = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
      columns: {
        // Don't return sensitive fields
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    })

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
users.get('/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return c.json({
        success: false,
        error: 'User not found',
      }, 404)
    }

    return c.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error('Get user error:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch user',
    }, 500)
  }
})

export { users as usersRoutes }