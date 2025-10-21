import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@/db'
import { users, selectUserSchema } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

const users = new Hono()

// Get all users (admin only)
users.get('/', async (c) => {
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