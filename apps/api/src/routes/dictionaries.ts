import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@/db'
import { dictionaries as dictionariesSchema, selectDictionarySchema } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { authMiddleware as authenticate, getUserId } from '@/middleware/auth'
// import { uploadRateLimit } from '@/middleware/rateLimit' // Temporarily disabled for testing
import { fileSecurityMiddleware } from '@/middleware/fileSecurity'
import { logger } from '@/lib/logger'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import { env } from '@/config/env'

const dictionariesRouter = new Hono()

// Apply authentication to all routes
dictionariesRouter.use('*', authenticate)

// Get all dictionaries (user's own dictionaries)
dictionariesRouter.get('/', async (c) => {
  try {
    const userId = getUserId(c)

    const allDictionaries = await db.query.dictionaries.findMany({
      where: eq(dictionariesSchema.userId, userId),
      orderBy: [desc(dictionariesSchema.createdAt)],
    })

    return c.json({
      success: true,
      data: allDictionaries,
      count: allDictionaries.length,
    })
  } catch (error) {
    logger.error('Get dictionaries error', 'dictionaries', error instanceof Error ? error : new Error(String(error)))
    return c.json({
      success: false,
      error: 'Failed to fetch dictionaries',
    }, 500)
  }
})

// Get single dictionary by ID (user must own it)
dictionariesRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = getUserId(c)

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

    // Verify user owns this dictionary
    if (dictionary.userId !== userId) {
      return c.json({
        success: false,
        error: 'Access denied',
      }, 403)
    }

    return c.json({
      success: true,
      data: dictionary,
    })
  } catch (error) {
    logger.error('Get dictionary error', 'dictionaries', error instanceof Error ? error : new Error(String(error)))
    return c.json({
      success: false,
      error: 'Failed to fetch dictionary',
    }, 500)
  }
})

// Helper function to parse size strings like "10GB" to bytes
function parseSizeToBytes(sizeStr: string): number {
  const units: {[key: string]: number} = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
  }

  const match = sizeStr.match(/^(\d+(\.\d+)?)\s*(B|KB|MB|GB)$/i)
  if (!match) {
    return 10 * 1024 * 1024 * 1024 // Default to 10GB
  }

  const value = parseFloat(match[1])
  const unit = match[3].toUpperCase()
  return value * (units[unit] || 1)
}

// Upload dictionary file validation schema
const uploadDictionarySchema = z.object({
  file: z.instanceof(File).refine(
    (file) => {
      const maxSize = parseSizeToBytes(env.MAX_DICTIONARY_SIZE)
      return file.size <= maxSize
    },
    {
      message: `File size must be less than ${env.MAX_DICTIONARY_SIZE || '10GB'}`
    }
  ),
  name: z.string().min(1).max(255).optional(),
  metadata: z.record(z.string()).optional()
})

// Helper function to count lines in a file
async function countLines(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n').filter(line => line.trim().length > 0)
    return lines.length
  } catch (error) {
    logger.warn('Failed to count lines in dictionary', 'dictionaries', { filePath, error: error instanceof Error ? error.message : 'Unknown error' })
    return 0
  }
}

// Helper function to calculate file checksum
async function calculateChecksum(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath)
    return crypto.createHash('sha256').update(content).digest('hex')
  } catch (error) {
    logger.warn('Failed to calculate checksum', 'dictionaries', { filePath, error: error instanceof Error ? error.message : 'Unknown error' })
    return ''
  }
}

// POST /api/dictionaries/upload - Upload a dictionary file
dictionariesRouter.post(
  '/upload',
  // uploadRateLimit(), // Temporarily disabled for testing
  fileSecurityMiddleware({
    maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
    allowedExtensions: ['.txt', '.lst', '.dict', '.wordlist'],
    allowedMimeTypes: [
      'text/plain',
      'application/octet-stream',
    ],
    scanFiles: true,
    virusScanning: false,
    enableDeepScanning: true
  }),
  zValidator('form', uploadDictionarySchema),
  async (c) => {
    try {
      const userId = getUserId(c)
      const { file, name, metadata } = c.req.valid('form')

      // Use provided name or default to filename
      const dictionaryName = name || file.name.replace(/\.[^/.]+$/, '')

      // Create secure upload directory for dictionaries
      const uploadDir = path.join(env.UPLOAD_DIR, 'dictionaries', userId)
      await fs.mkdir(uploadDir, { recursive: true })

      // Save uploaded file with secure permissions
      const fileBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(fileBuffer)
      const fileName = `${Date.now()}-${file.name}`
      const filePath = path.join(uploadDir, fileName)

      await fs.writeFile(filePath, buffer)
      await fs.chmod(filePath, 0o600) // Secure file permissions

      logger.info('Dictionary file uploaded', 'dictionaries', {
        userId,
        fileName,
        originalName: file.name,
        fileSize: file.size
      })

      // Calculate word count and checksum asynchronously
      const [wordCount, checksum] = await Promise.all([
        countLines(filePath),
        calculateChecksum(filePath)
      ])

      // Create dictionary record in database
      const [dictionaryRecord] = await db.insert(dictionariesSchema).values({
        name: dictionaryName,
        filename: fileName,
        type: 'uploaded',
        status: 'ready',
        size: file.size,
        wordCount,
        encoding: 'utf-8',
        checksum,
        filePath,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      logger.info('Dictionary created', 'dictionaries', {
        dictionaryId: dictionaryRecord.id,
        userId,
        name: dictionaryName,
        wordCount,
        size: file.size
      })

      return c.json({
        success: true,
        message: 'Dictionary uploaded successfully',
        data: dictionaryRecord
      })

    } catch (error) {
      logger.error('Dictionary upload error', 'dictionaries', error instanceof Error ? error : new Error(String(error)), {
        userId: getUserId(c),
        fileName: c.req.valid('form')?.file?.name
      })

      if (error instanceof Error && error.message.includes('INVALID_FILE_TYPE')) {
        return c.json({
          success: false,
          error: 'Invalid file type',
          message: error.message,
          code: 'INVALID_FILE_TYPE'
        }, 400)
      }

      return c.json({
        success: false,
        error: 'Dictionary upload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  }
)

// DELETE /api/dictionaries/:id - Delete a dictionary
dictionariesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = getUserId(c)

  try {
    // Find the dictionary
    const dictionary = await db.query.dictionaries.findFirst({
      where: eq(dictionariesSchema.id, id),
    })

    if (!dictionary) {
      return c.json({
        success: false,
        error: 'Dictionary not found',
      }, 404)
    }

    // Verify user owns this dictionary
    if (dictionary.userId !== userId) {
      return c.json({
        success: false,
        error: 'Access denied',
      }, 403)
    }

    // Delete the physical file
    if (dictionary.filePath) {
      try {
        await fs.unlink(dictionary.filePath)
        logger.info('Dictionary file deleted', 'dictionaries', {
          dictionaryId: id,
          filePath: dictionary.filePath
        })
      } catch (fileError) {
        logger.warn('Failed to delete dictionary file', 'dictionaries', {
          dictionaryId: id,
          filePath: dictionary.filePath,
          error: fileError instanceof Error ? fileError.message : 'Unknown error'
        })
      }
    }

    // Delete from database
    await db.delete(dictionariesSchema).where(eq(dictionariesSchema.id, id))

    logger.info('Dictionary deleted', 'dictionaries', {
      dictionaryId: id,
      userId,
      name: dictionary.name
    })

    return c.json({
      success: true,
      message: 'Dictionary deleted successfully',
    })
  } catch (error) {
    logger.error('Delete dictionary error', 'dictionaries', error instanceof Error ? error : new Error(String(error)), {
      dictionaryId: id,
      userId
    })
    return c.json({
      success: false,
      error: 'Failed to delete dictionary',
    }, 500)
  }
})

export { dictionariesRouter as dictionariesRoutes }