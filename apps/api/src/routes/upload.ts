import { Hono } from 'hono'
import { authMiddleware, getUserId } from '@/lib/auth'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { rateLimitMiddleware } from '@/middleware/rate-limit'
import { logger } from '@/lib/logger'
import {
  createValidationError,
  createFileSystemError
} from '@/lib/errors'

const upload = new Hono()

// Apply authentication and rate limiting
upload.use('*', authMiddleware)
upload.use('*', rateLimitMiddleware)

// Simple upload endpoint for testing
upload.post('/', async (c) => {
  try {
    return c.json({
      success: true,
      message: 'Upload endpoint is working',
      data: null
    })
  } catch (error) {
    logger.error('Upload error', 'upload', error)
    throw createFileSystemError('Upload failed', 'UPLOAD_ERROR')
  }
})

export { upload }