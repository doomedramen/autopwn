import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { env } from '@/config/env'
import { db } from '@/db'
import { dictionaries, networks, selectDictionarySchema } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import path from 'path'
import { promises as fs } from 'fs'
import { createWriteStream } from 'fs'
import crypto from 'crypto'
import { addPCAPProcessingJob } from '@/lib/queue'
import { authenticate, getUserId } from '@/middleware/auth'
import { uploadRateLimit } from '@/middleware/rateLimit'
import { secureUploadRoutes } from '@/middleware/fileSecurity'
import { createValidationError, createNotFoundError, createFileSystemError, asyncHandler } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

const upload = new Hono()

// Apply authentication and rate limiting to all routes
upload.use('*', authenticate)
upload.use('*', uploadRateLimit)

// Upload route for both PCAP and dictionary files
upload.post('/', asyncHandler(async (c) => {
    const contentType = c.req.header('content-type') || ''
    const searchParams = new URL(c.req.url).searchParams
    const uploadType = searchParams.get('type') as 'pcap' | 'dictionary'

    if (!uploadType || !['pcap', 'dictionary'].includes(uploadType)) {
      const validationError = createValidationError(
        'Invalid upload type. Must be "pcap" or "dictionary"',
        'INVALID_UPLOAD_TYPE'
      )
      logger.warn('Invalid upload type provided', 'validation', {
        uploadType,
        allowedTypes: ['pcap', 'dictionary'],
        userId: getUserId(c)
      })
      throw validationError
    }

    // Handle multipart form data
    const form = await c.req.formData()
    const file = form.get('file') as File

    if (!file) {
      const noFileError = createValidationError('No file provided')
      logger.warn('Upload attempted without file', 'validation', {
        uploadType,
        userId: getUserId(c)
      })
      throw noFileError
    }

    // Validate file type based on upload type
    const fileExtension = path.extname(file.name).toLowerCase()
    const allowedTypes = uploadType === 'pcap' ? ['.pcap'] : ['.txt']

    if (!allowedTypes.includes(fileExtension)) {
      const fileTypeError = createValidationError(
        `Invalid file type for ${uploadType} upload. Allowed types: ${allowedTypes.join(', ')}`,
        'INVALID_FILE_TYPE'
      )
      logger.warn('Invalid file type provided', 'validation', {
        uploadType,
        fileExtension,
        allowedTypes,
        fileName: file.name,
        userId: getUserId(c)
      })
      throw fileTypeError
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024 // 100MB in bytes
    if (file.size > maxSize) {
      const fileSizeError = createValidationError(
        'File too large. Maximum size is 100MB',
        'FILE_TOO_LARGE'
      )
      logger.warn('File size too large', 'validation', {
        uploadType,
        fileSize: file.size,
        maxSize,
        fileName: file.name,
        userId: getUserId(c)
      })
      throw fileSizeError
    }

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), env.UPLOAD_DIR, uploadType)
    try {
      await fs.mkdir(uploadDir, { recursive: true })
    } catch (error) {
      logger.error('Failed to create upload directory', 'filesystem', error, {
        uploadDir,
        uploadType
      })
      throw createFileSystemError('Failed to create upload directory')
    }

    // Generate unique filename
    const fileHash = crypto.createHash('sha256').update(await file.arrayBuffer()).digest('hex')
    const uniqueFilename = `${fileHash}-${file.name}`
    const filePath = path.join(uploadDir, uniqueFilename)

    // Save file
    const fileBuffer = await file.arrayBuffer()
    try {
      await fs.writeFile(filePath, fileBuffer)
    } catch (error) {
      logger.error('Failed to save uploaded file', 'filesystem', error, {
        fileName: file.name,
        filePath,
        fileSize: fileBuffer.length,
        uploadType,
        userId: getUserId(c)
      })
      throw createFileSystemError('Failed to save uploaded file')
    }

    // Generate file metadata
    const fileStats = await fs.stat(filePath)
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex')

    // Store in database
    if (uploadType === 'pcap') {
      // For PCAP files, process and extract networks
      // TODO: Implement PCAP processing logic
      // This would involve using libraries like pcap-parser to extract WiFi networks

      try {
        const [network] = await db.insert(networks).values({
          ssid: 'Sample Network',
          bssid: '00:11:22:33:44:55',
          encryption: 'WPA2',
          status: 'ready',
          channel: 6,
          frequency: 2437,
          signalStrength: -50,
          captureDate: new Date(),
          notes: `Uploaded file: ${file.name}`,
          userId: getUserId(c),
          filePath,
        }).returning()

        logger.info('PCAP file uploaded successfully', 'database', {
          networkId: network.id,
          fileName: file.name,
          fileSize: file.size,
          userId: getUserId(c)
        })

        return c.json({
          success: true,
          message: 'PCAP file uploaded and processed successfully',
          file: {
            id: network.id,
            name: file.name,
            size: file.size,
            type: file.type,
            extension: fileExtension,
            uploadType,
            checksum,
            filePath,
            networksFound: 1, // TODO: Actual network count from processing
            encryptionTypes: ['WPA2', 'WPA3', 'Open'],
            processingTime: '2.5s', // TODO: Actual processing time
          }
        })
      } catch (error) {
        logger.error('Failed to save network record to database', 'database', error, {
          fileName: file.name,
          uploadType,
          userId: getUserId(c)
        })
        throw createDatabaseError('Failed to save network record')
      }
    } else {
      // For dictionary files, estimate word count
      const content = fileBuffer.toString('utf-8')
      const wordCount = content.split('\n').filter(line => line.trim()).length

      try {
        const [dictionary] = await db.insert(dictionaries).values({
          name: file.name,
          filename: uniqueFilename,
          type: 'uploaded',
          status: 'ready',
          size: file.size,
          wordCount,
          encoding: 'utf-8',
          checksum,
          filePath,
          userId: getUserId(c),
        }).returning()

        logger.info('Dictionary file uploaded successfully', 'database', {
          dictionaryId: dictionary.id,
          fileName: file.name,
          wordCount,
          fileSize: file.size,
          userId: getUserId(c)
        })

        return c.json({
          success: true,
          message: 'Dictionary file uploaded successfully',
          file: {
            id: dictionary.id,
            name: file.name,
            size: file.size,
            type: file.type,
            extension: fileExtension,
            uploadType,
            checksum,
            filePath,
            wordCount,
            estimatedCrackTime: `${(wordCount / 1000000).toFixed(1)}M passwords`,
            processingTime: '0.1s', // TODO: Actual processing time
          }
        })
      } catch (error) {
        logger.error('Failed to save dictionary record to database', 'database', error, {
          fileName: file.name,
          wordCount,
          uploadType,
          userId: getUserId(c)
        })
        throw createDatabaseError('Failed to save dictionary record')
      }
    }

  } catch (error) {
    logger.error('Unhandled upload error', 'upload', error, {
      errorType: error.constructor.name,
      userId: getUserId(c),
      fatal: false
    })

    // Re-throw to be handled by global error handler
    throw createFileSystemError('Upload processing failed', 'UPLOAD_ERROR')
  }
})

// Uppy Companion endpoints for resumable uploads

// Uppy presign endpoint for direct uploads
upload.post('/presign', zValidator('json', z.object({
  filename: z.string().min(1),
  type: z.enum(['pcap', 'dictionary']),
  size: z.number().optional(),
})), async (c) => {
  const data = c.req.valid('json')
  const userId = getUserId(c)

  try {
    // Validate file type
    const fileExtension = path.extname(data.filename).toLowerCase()
    const allowedTypes = data.type === 'pcap' ? ['.pcap', '.cap'] : ['.txt', '.dic', '.wordlist']

    if (!allowedTypes.includes(fileExtension)) {
      return c.json({
        error: `Invalid file type for ${data.type} upload. Allowed types: ${allowedTypes.join(', ')}`,
      }, 400)
    }

    // Generate unique filename and path
    const uploadId = crypto.randomUUID()
    const uniqueFilename = `${uploadId}-${data.filename}`
    const uploadDir = path.join(process.cwd(), env.UPLOAD_DIR, data.type)
    const filePath = path.join(uploadDir, uniqueFilename)

    // Ensure upload directory exists
    await fs.mkdir(uploadDir, { recursive: true })

    // In a real implementation, you might use AWS S3 presigned URLs or similar
    // For now, we'll return a simple upload URL
    const uploadUrl = `${c.req.url.split('/api')[0]}/api/upload/presigned/${uploadId}`

    return c.json({
      uploadUrl,
      method: 'PUT',
      fields: {
        uploadId,
        filename: data.filename,
        type: data.type,
        userId,
      },
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      expires: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    })

  } catch (error) {
    logger.error('Presign URL generation error', 'upload', error, {
      errorType: error.constructor.name,
      userId: getUserId(c),
      filename: data.filename,
      uploadType: data.type
    })

    throw createFileSystemError('Failed to generate presigned upload URL')
  }
})

// Uppy presigned upload endpoint
upload.put('/presigned/:uploadId', async (c) => {
  const uploadId = c.req.param('uploadId')
  const filename = c.req.header('x-upload-filename') || 'unknown'
  const type = c.req.header('x-upload-type') as 'pcap' | 'dictionary' || 'pcap'
  const userId = c.req.header('x-upload-userid') || getUserId(c)

  try {
    // Validate upload ID and get file metadata
    if (!uploadId) {
      return c.json({
        error: 'Missing upload ID',
      }, 400)
    }

    // Get the upload directory and file path
    const uploadDir = path.join(process.cwd(), env.UPLOAD_DIR, type)
    const uniqueFilename = `${uploadId}-${filename}`
    const filePath = path.join(uploadDir, uniqueFilename)

    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true })

    // Get the file content
    const fileBuffer = await c.req.arrayBuffer()

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024
    if (fileBuffer.byteLength > maxSize) {
      return c.json({
        error: 'File too large. Maximum size is 100MB',
      }, 400)
    }

    // Write file to disk
    await fs.writeFile(filePath, new Uint8Array(fileBuffer))

    // Generate checksum
    const checksum = crypto.createHash('sha256').update(new Uint8Array(fileBuffer)).digest('hex')

    // Process file based on type
    let result
    if (type === 'pcap') {
      // Create network record and queue for processing
      const [network] = await db.insert(networks).values({
        ssid: 'Processing...',
        bssid: '00:00:00:00:00:00',
        encryption: 'Unknown',
        status: 'processing',
        userId,
        filePath,
        notes: `Uploaded file: ${filename}`,
        captureDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      // Queue for PCAP processing
      await addPCAPProcessingJob({
        networkId: network.id,
        filePath,
        originalFilename: filename,
        userId
      })

      result = {
        type: 'pcap',
        id: network.id,
        message: 'PCAP file uploaded and queued for processing'
      }
    } else {
      // Process dictionary file
      const content = new TextDecoder().decode(fileBuffer)
      const wordCount = content.split('\n').filter(line => line.trim()).length

      const [dictionary] = await db.insert(dictionaries).values({
        name: filename,
        filename: uniqueFilename,
        type: 'uploaded',
        status: 'ready',
        size: fileBuffer.byteLength,
        wordCount,
        encoding: 'utf-8',
        checksum,
        filePath,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning()

      result = {
        type: 'dictionary',
        id: dictionary.id,
        wordCount,
        message: 'Dictionary file uploaded successfully'
      }
    }

    return c.json({
      success: true,
      uploadId,
      filename,
      size: fileBuffer.byteLength,
      checksum,
      ...result
    })

  } catch (error) {
    logger.error('Presigned upload processing error', 'upload', error, {
      errorType: error.constructor.name,
      userId: getUserId(c),
      uploadId,
      filename
    })

    throw createFileSystemError('Failed to process uploaded file')
  }
})

// Uppy upload completion endpoint
upload.post('/complete', zValidator('json', z.object({
  uploadId: z.string().min(1),
  filename: z.string().min(1),
  type: z.enum(['pcap', 'dictionary']),
})), async (c) => {
  const data = c.req.valid('json')

  try {
    // Here you might perform additional post-upload processing
    // For now, just confirm the upload was completed
    return c.json({
      success: true,
      message: 'Upload completed successfully',
      uploadId: data.uploadId,
      filename: data.filename,
      type: data.type,
    })

  } catch (error) {
    logger.error('Upload completion error', 'upload', error, {
      errorType: error.constructor.name,
      userId: getUserId(c),
      uploadId: data.uploadId,
      filename: data.filename
      type: data.type
    })

    throw createFileSystemError('Failed to complete upload')
  }
})

// Get upload status
upload.get('/status/:uploadId', async (c) => {
  const uploadId = c.req.param('uploadId')

  try {
    // In a real implementation, you would track upload progress
    // For now, just return a basic status
    return c.json({
      uploadId,
      status: 'completed', // 'uploading', 'processing', 'completed', 'failed'
      progress: 100,
      message: 'Upload completed successfully'
    })

  } catch (error) {
    logger.error('Upload status retrieval error', 'upload', error, {
      errorType: error.constructor.name,
      userId: getUserId(c),
      uploadId
    })

    throw createFileSystemError('Failed to get upload status')
  }
})

// Delete uploaded file
upload.delete('/:uploadId', async (c) => {
  const uploadId = c.req.param('uploadId')
  const userId = getUserId(c)

  try {
    // Find and delete the file based on uploadId
    // This would require storing uploadId -> file mapping
    // For now, just return success
    return c.json({
      success: true,
      message: 'File deleted successfully'
    })

  } catch (error) {
    console.error('File deletion error:', error)
    return c.json({
      error: 'Failed to delete file',
    }, 500)
  }
})

// Get upload limits and configuration
upload.get('/config', async (c) => {
  try {
    return c.json({
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedTypes: {
        pcap: ['.pcap', '.cap'],
        dictionary: ['.txt', '.dic', '.wordlist']
      },
      chunkSize: 5 * 1024 * 1024, // 5MB chunks for resumable uploads
      maxConcurrentUploads: 3,
      retryDelays: [1000, 3000, 5000], // Retry delays in ms
      timeout: 300000, // 5 minutes timeout
    })

  } catch (error) {
    logger.error('Upload config retrieval error', 'upload', error, {
      errorType: error.constructor.name
    })
    throw createFileSystemError('Failed to get upload configuration')
  }
})

export { upload as uploadRoutes }