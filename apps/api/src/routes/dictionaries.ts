import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@/db'
import { dictionaries as dictionariesSchema, selectDictionarySchema } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

const dictionariesRouter = new Hono()

// Get all dictionaries
dictionariesRouter.get('/', async (c) => {
  try {
    const allDictionaries = await db.query.dictionaries.findMany({
      orderBy: [desc(dictionariesSchema.createdAt)],
    })

    return c.json({
      success: true,
      data: allDictionaries,
      count: allDictionaries.length,
    })
  } catch (error) {
    console.error('Get dictionaries error:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch dictionaries',
    }, 500)
  }
})

// Get single dictionary by ID
dictionariesRouter.get('/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const dictionary = await db.query.dictionaries.findFirst({
      where: eq(dictionariesSchema.id, id),
    })

    if (!dictionary) {
      return c.json({
        success: false,
        error: 'Dictionary not found',
      }, 404)
    }

    return c.json({
      success: true,
      data: dictionary,
    })
  } catch (error) {
    console.error('Get dictionary error:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch dictionary',
    }, 500)
  }
})

export { dictionariesRouter as dictionariesRoutes }