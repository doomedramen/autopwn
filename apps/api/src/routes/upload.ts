import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
// import { uploadRateLimit } from '@/middleware/rateLimit' // Temporarily disabled for testing
import { fileSecurityMiddleware } from '@/middleware/fileSecurity'
import { logger } from '@/lib/logger'
import {
  createValidationError,
  createFileSystemError,
} from '@/lib/error-handler'
import { db } from '@/db'
import { users, networks, dictionaries, jobs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { addPCAPProcessingJob, checkQueueHealth } from '@/lib/queue'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs/promises'
import * as path from 'path'
import { env } from '@/config/env'
import { authMiddleware as authenticate, getUserId } from '@/middleware/auth'
import { validatePCAPFileByName, quickPCAPValidation, getPCAPFileInfo } from '@/lib/pcap-validator'
import { analyzePCAPFile } from '@/lib/pcap-analyzer'
import { storageManager } from '@/lib/storage-manager'

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

// Apply authentication and upload-specific middleware
upload.use('*', authenticate)
// upload.use('*', uploadRateLimit()) // Temporarily disabled for testing
upload.use('*', fileSecurityMiddleware({
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedExtensions: ['.pcap', '.cap', '.pcapng', '.dmp'],
  allowedMimeTypes: [
    'application/octet-stream',
    'application/vnd.tcpdump.pcap',
    'application/x-pcap'
  ],
  scanFiles: true,
  virusScanning: false, // Disable virus scanning for PCAP files (binary network data)
  enableDeepScanning: true
}))

/**
 * Handle PCAP file uploads and create processing jobs
 */
upload.post('/', zValidator('form', uploadSchema), async (c) => {
  try {
    const userId = getUserId(c)
    const { file, jobId, metadata } = c.req.valid('form')

    if (!userId) {
      return c.json({
        success: false,
        error: 'User not authenticated'
      }, 401)
    }

    // Check storage quota before processing
    const canUpload = await storageManager.checkUserQuota(userId, file.size)
    if (!canUpload) {
      const quotaInfo = await storageManager.getUserQuotaInfo(userId)
      return c.json({
        success: false,
        error: 'QUOTA_EXCEEDED',
        message: 'Storage quota exceeded',
        data: {
          quota: quotaInfo,
          requestedSize: file.size
        }
      }, 413) // HTTP 413 Payload Too Large
    }

    // Generate job ID if not provided
    const finalJobId = jobId || uuidv4()

    // Create secure upload directory
    const uploadDir = path.join(env.UPLOAD_DIR, 'uploads', finalJobId)
    await fs.mkdir(uploadDir, { recursive: true })

    // Save uploaded file with secure permissions
    const fileBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(fileBuffer)
    const fileName = `${Date.now()}-${file.name}`
    const filePath = path.join(uploadDir, fileName)

    await fs.writeFile(filePath, buffer)
    await fs.chmod(filePath, 0o600) // Secure file permissions

    // Quick PCAP validation using magic bytes
    const isValidPCAP = await quickPCAPValidation(file.name, buffer)
    if (!isValidPCAP) {
      // Clean up invalid file
      await fs.rm(uploadDir, { recursive: true, force: true }).catch(() => {})

      return c.json({
        success: false,
        error: 'Invalid PCAP file',
        message: 'The uploaded file is not a valid PCAP file. Please ensure the file is in PCAP format.',
        code: 'INVALID_PCAP_FILE'
      }, 400)
    }

    // Detailed PCAP validation
    try {
      await validatePCAPFileByName(file.name, filePath)
    } catch (validationError) {
      // Clean up invalid file
      await fs.rm(uploadDir, { recursive: true, force: true }).catch(() => {})

      return c.json({
        success: false,
        error: 'PCAP validation failed',
        message: validationError instanceof Error ? validationError.message : 'Unknown validation error',
        code: 'PCAP_VALIDATION_ERROR'
      }, 400)
    }

    // Get PCAP file information and analysis
    let pcapInfo = null
    let pcapAnalysis = null

    try {
      pcapInfo = await getPCAPFileInfo(filePath)

      // Perform basic PCAP analysis
      pcapAnalysis = await analyzePCAPFile(filePath, 50) // Analyze first 50 packets
    } catch (error) {
      logger.warn('Failed to analyze PCAP file', 'upload', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Queue PCAP file for automatic network extraction
    // No need for networkId at upload time - networks will be auto-created from PCAP
    const queueHealth = await checkQueueHealth()
    if (queueHealth.status === 'healthy') {
      await addPCAPProcessingJob({
        // networkId is optional - not provided means auto-create networks
        filePath,
        originalFilename: file.name,
        userId,
        metadata: {
          pcapInfo,
          pcapAnalysis,
          uploadId: finalJobId
        }
      })

      logger.info('pcap_queued_for_processing', 'upload', {
        uploadId: finalJobId,
        userId,
        fileName,
        originalName: file.name,
        fileSize: file.size,
        pcapInfo: pcapInfo ? {
          version: pcapInfo.version,
          network: pcapInfo.network,
          snaplen: pcapInfo.snaplen
        } : null
      })
    }

    return c.json({
      success: true,
      message: 'PCAP file uploaded successfully and queued for processing',
      data: {
        uploadId: finalJobId,
        fileName,
        originalName: file.name,
        size: file.size,
        queuedForProcessing: queueHealth.status === 'healthy',
        pcapInfo,
        pcapAnalysis: pcapAnalysis ? {
          totalPackets: pcapAnalysis.analysis.totalPackets,
          estimatedNetworkCount: pcapAnalysis.estimatedNetworkCount,
        } : null
      }
    })

  } catch (error) {
    logger.error('upload_error', 'upload', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
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
      error: 'File upload failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * Get upload status for a specific job
 */
upload.get('/:jobId/status', async (c) => {
  try {
    const { jobId } = c.req.param()
    const userId = getUserId(c)

    // Verify user owns the job
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, jobId) && eq(jobs.userId, userId)
    })

    if (!job) {
      return c.json({
        success: false,
        error: 'Job not found',
        message: `No job found with ID: ${jobId}`,
        code: 'JOB_NOT_FOUND'
      }, 404)
    }

    // Get network info if available
    let networkInfo = null
    if (job.networkId) {
      [networkInfo] = await db.select()
        .from(networks)
        .where(eq(networks.id, job.networkId))
        .limit(1)
    }

    // Get upload path from config
    const config = job.config as any
    const uploadPath = config?.targetFile

    return c.json({
      success: true,
      message: 'Upload status retrieved',
      data: {
        job,
        network: networkInfo,
        uploadPath
      }
    })

  } catch (error) {
    logger.error('upload_status_error', 'upload', {
      error: error instanceof Error ? error.message : 'Unknown error',
      jobId: c.req.param('jobId')
    })
    return c.json({
      success: false,
      error: 'Failed to get upload status',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'STATUS_ERROR'
    }, 500)
  }
})

export { upload as uploadRoutes }