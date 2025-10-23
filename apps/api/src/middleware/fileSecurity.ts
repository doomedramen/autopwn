import { Context, Next } from 'hono'
import { z } from 'zod'
import { lookup } from 'mime-types'
import path from 'path'
import { promises as fs } from 'fs'
import crypto from 'crypto'
import {
  createValidationError,
  createFileSystemError,
  ExternalServiceError
} from '../lib/error-handler'
import { logger } from '../lib/logger'

/**
 * File upload security configuration
 */
interface FileSecurityConfig {
  maxFileSize: number
  allowedMimeTypes: string[]
  allowedExtensions: string[]
  blockedExtensions: string[]
  scanFiles: boolean
  quarantineDirectory?: string
}

const defaultFileSecurityConfig: FileSecurityConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedMimeTypes: [
    'application/octet-stream', // For generic binary files
    'application/zip',
    'application/x-gzip',
    'application/pdf',
    'text/plain'
  ],
  allowedExtensions: [
    '.pcap',
    '.cap',
    '.dmp',
    '.cap.gz',
    '.gz',
    '.txt',
    '.json',
    '.xml',
    '.csv'
  ],
  blockedExtensions: [
    '.exe',
    '.bat',
    '.cmd',
    '.com',
    '.pif',
    '.scr',
    '.vbs',
    '.js',
    '.jar',
    '.app',
    '.dll'
  ],
  scanFiles: true,
  quarantineDirectory: './quarantine'
}

/**
 * File scan result
 */
interface ScanResult {
  safe: boolean
  threatLevel: 'safe' | 'suspicious' | 'dangerous'
  issues: string[]
  hash?: string
}

/**
 * Enhanced file scanner with multiple security checks
 */
const enhancedFileScanner = {
  scan: async (filePath: string, fileBuffer?: Buffer): Promise<ScanResult> => {
    const issues: string[] = []
    let threatLevel: 'safe' | 'suspicious' | 'dangerous' = 'safe'

    try {
      // Check file extension
      const ext = path.extname(filePath).toLowerCase()
      const isAllowed = defaultFileSecurityConfig.allowedExtensions.includes(ext)
      const isBlocked = defaultFileSecurityConfig.blockedExtensions.includes(ext)

      if (!isAllowed) {
        issues.push(`File type .${ext} is not allowed`)
        threatLevel = 'dangerous'
      }

      if (isBlocked) {
        issues.push(`File type .${ext} is blocked for security reasons`)
        threatLevel = 'dangerous'
      }

      // Check file size
      const fileSize = fileBuffer ? fileBuffer.length : (await fs.stat(filePath)).size
      if (fileSize > defaultFileSecurityConfig.maxFileSize) {
        issues.push(`File size ${fileSize} exceeds maximum ${defaultFileSecurityConfig.maxFileSize} bytes`)
        threatLevel = 'dangerous'
      }

      // Content-based scanning if buffer is available
      if (fileBuffer && fileSize > 0) {
        const content = fileBuffer.toString('utf8', 0, Math.min(1024, fileSize)) // Check first 1KB

        // Check for suspicious patterns
        const suspiciousPatterns = [
          /<script[^>]*>/i,
          /javascript:/i,
          /eval\s*\(/i,
          /document\.cookie/i,
          /exec\s*\(/i,
          /system\s*\(/i,
          /vbscript:/i,
          /on\w+\s*=/i,
          /\$\{.*\}/,  // Template literals
        ]

        for (const pattern of suspiciousPatterns) {
          if (pattern.test(content)) {
            issues.push('Suspicious script-like content detected')
            threatLevel = 'dangerous'
            break
          }
        }

        // Check for PE header (Windows executable)
        if (fileBuffer.length >= 2 && fileBuffer[0] === 0x4D && fileBuffer[1] === 0x5A) {
          issues.push('Windows executable detected')
          threatLevel = 'dangerous'
        }

        // Check for ELF header (Linux executable)
        if (fileBuffer.length >= 4 &&
            fileBuffer[0] === 0x7F &&
            fileBuffer[1] === 0x45 &&
            fileBuffer[2] === 0x4C &&
            fileBuffer[3] === 0x46) {
          issues.push('Linux executable detected')
          threatLevel = 'dangerous'
        }

        // Check for ZIP bombs (high compression ratio)
        if (ext === '.zip' || ext === '.gz') {
          const maxUncompressedRatio = 100 // Max 100:1 compression ratio
          // This is a simplified check - in production you'd use proper ZIP inspection
          if (fileSize > 1024 * 1024) { // If compressed file > 1MB
            issues.push('Large compressed file - potential ZIP bomb')
            threatLevel = 'suspicious'
          }
        }
      }

      // Generate file hash
      const hash = crypto.createHash('sha256').update(fileBuffer || await fs.readFile(filePath)).digest('hex')

      return {
        safe: threatLevel === 'safe',
        threatLevel,
        issues,
        hash
      }

    } catch (error) {
      return {
        safe: false,
        threatLevel: 'suspicious',
        issues: [`File scanning error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }
}

/**
 * File security middleware
 * Provides comprehensive file upload security
 */
export const fileSecurityMiddleware = (config: FileSecurityConfig = {}) => {
  const {
    maxFileSize = config.maxFileSize ?? defaultFileSecurityConfig.maxFileSize,
    allowedMimeTypes = config.allowedMimeTypes ?? defaultFileSecurityConfig.allowedMimeTypes,
    allowedExtensions = config.allowedExtensions ?? defaultFileSecurityConfig.allowedExtensions,
    blockedExtensions = config.blockedExtensions ?? defaultFileSecurityConfig.blockedExtensions,
    scanFiles = config.scanFiles ?? defaultFileSecurityConfig.scanFiles,
    quarantineDirectory = config.quarantineDirectory ?? defaultFileSecurityConfig.quarantineDirectory
  } = config

  return async (c: Context, next: Next) => {
    try {
      // Handle form data uploads
      const contentType = c.req.header('content-type') || ''

      if (!contentType.includes('multipart/form-data')) {
        // For non-form uploads, just add security headers and continue
        c.res.headers.set('X-Content-Type-Options', 'nosniff')
        c.res.headers.set('X-Download-Options', 'noopen')
        c.res.headers.set('X-XSS-Protection', '1; mode=block')
        await next()
        return
      }

      // Handle multipart form data
      const formData = await c.req.formData()
      const file = formData.get('file') as File

      if (!file) {
        return c.json({
          success: false,
          error: 'No file provided',
          code: 'NO_FILE'
        }, 400)
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer())
      const fileName = file.name
      const fileSize = fileBuffer.length
      const ext = path.extname(fileName).toLowerCase()

      // Validate file extension
      if (!allowedExtensions.includes(ext)) {
        return c.json({
          success: false,
          error: 'File type not allowed',
          code: 'FILE_TYPE_NOT_ALLOWED',
          message: `Files of type .${ext} are not allowed for upload`,
          allowedExtensions
        }, 400)
      }

      // Validate file size
      if (fileSize > maxFileSize) {
        return c.json({
          success: false,
          error: 'File too large',
          code: 'FILE_TOO_LARGE',
          message: `File size ${fileSize} exceeds maximum allowed size of ${maxFileSize} bytes`,
          maxSize: maxFileSize
        }, 413)
      }

      // Scan file content if enabled
      let scanResult: ScanResult = { safe: true, threatLevel: 'safe', issues: [] }
      if (scanFiles) {
        scanResult = await enhancedFileScanner.scan(fileName, fileBuffer)
      }

      // Move file to quarantine if suspicious or dangerous
      if (!scanResult.safe && scanResult.threatLevel !== 'safe') {
        try {
          await fs.mkdir(quarantineDirectory!, { recursive: true })
          const quarantinePath = path.join(quarantineDirectory!, `${Date.now()}-${fileName}`)
          await fs.writeFile(quarantinePath, fileBuffer)
        } catch (error) {
          console.error('Failed to quarantine file:', error)
        }

        return c.json({
          success: false,
          error: 'File quarantined due to security scan',
          code: 'FILE_QUARANTINED',
          message: scanResult.threatLevel === 'dangerous'
            ? 'File was quarantined for security reasons'
            : 'File appears suspicious and was quarantined',
          issues: scanResult.issues,
          threatLevel: scanResult.threatLevel,
          hash: scanResult.hash
        }, scanResult.threatLevel === 'dangerous' ? 403 : 202)
      }

      // Add security headers and scan metadata to response
      c.res.headers.set('X-Content-Type-Options', 'nosniff')
      c.res.headers.set('X-Download-Options', 'noopen')
      c.res.headers.set('X-XSS-Protection', '1; mode=block')

      if (scanResult.hash) {
        c.res.headers.set('X-File-Hash', scanResult.hash)
      }

      // Store file info in context for downstream handlers
      c.set('fileInfo', {
        name: fileName,
        size: fileSize,
        type: file.type,
        ext,
        hash: scanResult.hash,
        scanResult
      })

      await next()

    } catch (error) {
      const fileError = error instanceof ExternalServiceError
        ? error
        : createFileSystemError('File processing error', 'PROCESSING_ERROR')

      // Get file info before throwing error for logging
      const fileInfo = c.get('fileInfo')

      logger.error('File security middleware error', 'file_security', error, {
        errorType: fileError.constructor.name,
        code: fileError.code,
        fileName: fileInfo?.name || file?.name,
        fileSize: fileInfo?.size || file?.size,
        fileType: fileInfo?.type || file?.type
      })

      // Re-throw to be handled by global error handler
      throw fileError
    }
  }
}

/**
 * Enhanced upload routes with file security
 */
export const secureUploadRoutes = (fileSecurityConfig: FileSecurityConfig = {}) => {
  const middleware = fileSecurityMiddleware(fileSecurityConfig)

  return async (c: Context, next: Next) => {
    // Apply file security middleware
    return middleware(c, next)
  }
}