import { Hono } from 'hono'
import { authMiddleware, getUserId } from '@/lib/auth'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { uploadRateLimit } from '@/middleware/rate-limit'
import { logger } from '@/lib/logger'
import {
  createValidationError,
  createFileSystemError,
  createSuccessResponse,
} from '@/lib/errors'
import { db } from '@/db'
import { users, networkCaptures, jobs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createJob, checkQueueHealth } from '@/lib/queue'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs/promises'
import * as path from 'path'
import { env } from '@/config/env'

// Upload request validation schema
const uploadSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => {
      const maxSize = parseInt(env.MAX_FILE_SIZE) || 100 * 1024 * 1024 // 100MB default
      return file.size <= maxSize
    },
    {
      message: `File size must be less than ${env.MAX_FILE_SIZE || '100MB'}`
    }
  ),
  jobId: z.string().uuid().optional(),
  metadata: z.record(z.string()).optional()
})

const upload = new Hono()

// Apply authentication and upload-specific rate limiting
upload.use('*', authMiddleware)
upload.use('*', uploadRateLimit())

/**
 * Handle PCAP file uploads and create processing jobs
 */
upload.post('/', zValidator('form', uploadSchema), async (c) => {
  try {
    const userId = getUserId(c)
    const { file, jobId, metadata } = c.req.valid('form')

    // Generate job ID if not provided
    const finalJobId = jobId || uuidv4()

    // Create secure upload directory
    const uploadDir = path.join(env.UPLOAD_DIR, 'uploads', finalJobId)
    await fs.mkdir(uploadDir, { recursive: true })

    // Save uploaded file with secure permissions
    const fileBuffer = await file.arrayBuffer()
    const fileName = `${Date.now()}-${file.name}`
    const filePath = path.join(uploadDir, fileName)

    await fs.writeFile(filePath, Buffer.from(fileBuffer))
    await fs.chmod(filePath, 0o600) // Secure file permissions

    // Validate file is a valid PCAP
    if (!fileName.endsWith('.pcap') && !fileName.endsWith('.cap')) {
      throw createValidationError(
        'Only PCAP files (.pcap, .cap) are allowed',
        'INVALID_FILE_TYPE'
      )
    }

    // Create job record in database
    const [jobRecord] = await db.insert(jobs).values({
      id: finalJobId,
      userId,
      name: `Upload: ${fileName}`,
      description: metadata?.description || `PCAP file upload: ${fileName}`,
      type: 'pcap_processing',
      status: 'pending',
      targetFile: filePath,
      dictionaryId: metadata?.dictionaryId || null,
      hashcatMode: 22000, // Default to handshake mode
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()

    // Create network capture record
    const [networkRecord] = await db.insert(networkCaptures).values({
      id: uuidv4(),
      userId,
      jobId: finalJobId,
      filename: fileName,
      originalName: file.name,
      size: file.size,
      uploadPath: filePath,
      status: 'uploaded',
      createdAt: new Date()
    }).returning()

    // Add job to queue for processing
    const queueHealth = await checkQueueHealth()
    if (queueHealth.status === 'healthy') {
      await createJob({
        id: finalJobId,
        type: 'pcap_processing',
        userId,
        targetFile: filePath,
        options: {
          fileName,
          originalName: file.name,
          size: file.size,
          metadata
        }
      })

      logger.info('job_created', 'upload', {
        jobId: finalJobId,
        userId,
        fileName,
        fileSize: file.size
      })
    }

    return createSuccessResponse(c, 'File uploaded successfully', {
      job: jobRecord,
      networkCapture: networkRecord,
      queuedForProcessing: queueHealth.status === 'healthy'
    })

  } catch (error) {
    logger.error('upload_error', 'upload', {
      error: error.message,
      userId,
      fileName: c.req.valid('form')?.file?.name
    })

    if (error.code === 'INVALID_FILE_TYPE') {
      throw createValidationError(error.message, error.code)
    }

    throw createFileSystemError('File upload failed', 'UPLOAD_ERROR')
  }
})

/**
 * Get upload status for a specific job
 */
upload.get('/:jobId/status', authMiddleware, async (c) => {
  try {
    const { jobId } = c.req.param()
    const userId = getUserId(c)

    // Verify user owns the job
    const [job] = await db.select()
      .from(jobs)
      .where(eq(jobs.id, jobId) && eq(jobs.userId, userId))
      .limit(1)

    if (!job) {
      throw createValidationError('Job not found', 'JOB_NOT_FOUND')
    }

    // Get network capture info
    const [networkCapture] = await db.select()
      .from(networkCaptures)
      .where(eq(networkCaptures.jobId, jobId))
      .limit(1)

    return createSuccessResponse(c, 'Upload status retrieved', {
      job,
      networkCapture,
      uploadPath: job.targetFile
    })

  } catch (error) {
    logger.error('upload_status_error', 'upload', {
      error: error.message,
      jobId: c.req.param('jobId')
    })
    throw createValidationError('Failed to get upload status', 'STATUS_ERROR')
  }
})

export { upload as uploadRoutes }