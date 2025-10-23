import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import { secureUploadRoutes, FileSecurityConfig } from '../../middleware/fileSecurity'

describe('Enhanced File Security Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should allow safe PCAP files with valid extension', async () => {
    const fileSecurityConfig: FileSecurityConfig = {
      allowedMimeTypes: ['application/octet-stream'],
      blockedExtensions: ['.exe'],
      scanFiles: true,
      maxFileSize: 100 * 1024 * 1024 // 100MB
    }

    const secureUpload = secureUploadRoutes(fileSecurityConfig)

    const app = new Hono()
    app.post('/secure-upload', secureUpload)

    // Create a mock PCAP file
    const pcapContent = new Uint8Array([0xd4, 0xc3, 0xb2, 0xa1, 0x02, 0x00, 0x04, 0x00]) // PCAP header
    const mockFile = new File([pcapContent], 'test.pcap', { type: 'application/octet-stream' })

    const formData = new FormData()
    formData.append('file', mockFile)

    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue('multipart/form-data; boundary=----WebKitFormBoundary'),
        formData: vi.fn().mockResolvedValue(formData)
      },
      res: {
        headers: {
          set: vi.fn(),
          get: vi.fn()
        },
        json: vi.fn(),
        status: vi.fn()
      },
      set: vi.fn()
    }

    const mockNext = vi.fn()
    await secureUpload(mockContext as any, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockContext.set).toHaveBeenCalledWith('fileInfo', expect.objectContaining({
      name: 'test.pcap',
      size: 8,
      ext: '.pcap'
    }))

    // Should have security headers set
    expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
    expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block')
  })

  it('should reject files with blocked extensions', async () => {
    const fileSecurityConfig: FileSecurityConfig = {
      allowedMimeTypes: ['text/plain'],
      blockedExtensions: ['.exe', '.bat'],
      scanFiles: true
    }

    const secureUpload = secureUploadRoutes(fileSecurityConfig)

    // Create a mock executable file
    const exeContent = new Uint8Array([0x4D, 0x5A, 0x90, 0x00]) // PE header
    const maliciousFile = new File([exeContent], 'malware.exe', { type: 'application/octet-stream' })

    const formData = new FormData()
    formData.append('file', maliciousFile)

    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue('multipart/form-data; boundary=----WebKitFormBoundary'),
        formData: vi.fn().mockResolvedValue(formData)
      },
      res: {
        headers: {
          set: vi.fn(),
          get: vi.fn()
        },
        json: vi.fn(),
        status: vi.fn()
      },
      json: vi.fn()
    }

    const mockNext = vi.fn()
    await secureUpload(mockContext as any, mockNext)

    expect(mockNext).not.toHaveBeenCalled()

    // Should be rejected due to extension first
    expect(mockContext.json).toHaveBeenCalledWith({
      success: false,
      error: 'File type not allowed',
      code: 'FILE_TYPE_NOT_ALLOWED',
      message: expect.stringContaining('.exe are not allowed for upload'),
      allowedExtensions: expect.any(Array)
    }, 400)
  })

  it('should reject files exceeding size limit', async () => {
    const fileSecurityConfig: FileSecurityConfig = {
      maxFileSize: 100 // 100 bytes
    }

    const secureUpload = secureUploadRoutes(fileSecurityConfig)

    // Create a large file
    const largeContent = new Array(200).fill('A').join('') // 200 bytes
    const largeFile = new File([largeContent], 'large.pcap', { type: 'application/octet-stream' })

    const formData = new FormData()
    formData.append('file', largeFile)

    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue('multipart/form-data; boundary=----WebKitFormBoundary'),
        formData: vi.fn().mockResolvedValue(formData)
      },
      res: {
        headers: {
          set: vi.fn(),
          get: vi.fn()
        },
        json: vi.fn(),
        status: vi.fn()
      },
      json: vi.fn()
    }

    const mockNext = vi.fn()
    await secureUpload(mockContext as any, mockNext)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockContext.json).toHaveBeenCalledWith({
      success: false,
      error: 'File too large',
      code: 'FILE_TOO_LARGE',
      message: 'File size 200 exceeds maximum allowed size of 100 bytes',
      maxSize: 100
    }, 413)
  })

  it('should detect and quarantine files with malicious content', async () => {
    const fileSecurityConfig: FileSecurityConfig = {
      scanFiles: true,
      allowedExtensions: ['.txt', '.js'] // Allow .js for testing
    }

    const secureUpload = secureUploadRoutes(fileSecurityConfig)

    // Create a file with malicious JavaScript content
    const maliciousContent = '<script>alert("XSS")</script>'
    const maliciousFile = new File([maliciousContent], 'malicious.txt', { type: 'text/plain' })

    const formData = new FormData()
    formData.append('file', maliciousFile)

    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue('multipart/form-data; boundary=----WebKitFormBoundary'),
        formData: vi.fn().mockResolvedValue(formData)
      },
      res: {
        headers: {
          set: vi.fn(),
          get: vi.fn()
        },
        json: vi.fn(),
        status: vi.fn()
      },
      json: vi.fn()
    }

    const mockNext = vi.fn()
    await secureUpload(mockContext as any, mockNext)

    expect(mockNext).not.toHaveBeenCalled()

    // Should have been quarantined for suspicious content
    expect(mockContext.json).toHaveBeenCalledWith({
      success: false,
      error: 'File quarantined due to security scan',
      code: 'FILE_QUARANTINED',
      message: expect.stringContaining('quarantined'),
      issues: expect.arrayContaining([
        'Suspicious script-like content detected'
      ]),
      threatLevel: 'dangerous',
      hash: expect.any(String)
    }, 403)
  })

  it('should handle non-multipart requests with security headers', async () => {
    const fileSecurityConfig: FileSecurityConfig = {
      scanFiles: false
    }

    const secureUpload = secureUploadRoutes(fileSecurityConfig)

    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue('application/json'),
        json: vi.fn().mockResolvedValue({ name: 'test' })
      },
      res: {
        headers: {
          set: vi.fn(),
          get: vi.fn()
        },
        json: vi.fn(),
        status: vi.fn()
      }
    }

    const mockNext = vi.fn()
    await secureUpload(mockContext as any, mockNext)

    expect(mockNext).toHaveBeenCalled()

    // Should still add security headers
    expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
    expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-Download-Options', 'noopen')
    expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block')
  })

  it('should reject requests with no file provided', async () => {
    const fileSecurityConfig: FileSecurityConfig = {}

    const secureUpload = secureUploadRoutes(fileSecurityConfig)

    const formData = new FormData()
    // No file added

    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue('multipart/form-data; boundary=----WebKitFormBoundary'),
        formData: vi.fn().mockResolvedValue(formData)
      },
      res: {
        headers: {
          set: vi.fn(),
          get: vi.fn()
        },
        json: vi.fn(),
        status: vi.fn()
      },
      json: vi.fn()
    }

    const mockNext = vi.fn()
    await secureUpload(mockContext as any, mockNext)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockContext.json).toHaveBeenCalledWith({
      success: false,
      error: 'No file provided',
      code: 'NO_FILE'
    }, 400)
  })

  it('should detect Linux executables', async () => {
    const fileSecurityConfig: FileSecurityConfig = {
      scanFiles: true,
      allowedExtensions: ['.pcap', '.cap', '.bin'] // Add .bin for testing
    }

    const secureUpload = secureUploadRoutes(fileSecurityConfig)

    // Create a file with ELF header but .pcap extension to test content scanning
    const elfContent = new Uint8Array([0x7F, 0x45, 0x4C, 0x46]) // ELF header
    const elfFile = new File([elfContent], 'malicious.pcap', { type: 'application/octet-stream' })

    const formData = new FormData()
    formData.append('file', elfFile)

    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue('multipart/form-data; boundary=----WebKitFormBoundary'),
        formData: vi.fn().mockResolvedValue(formData)
      },
      res: {
        headers: {
          set: vi.fn(),
          get: vi.fn()
        },
        json: vi.fn(),
        status: vi.fn()
      },
      json: vi.fn()
    }

    const mockNext = vi.fn()
    await secureUpload(mockContext as any, mockNext)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockContext.json).toHaveBeenCalledWith({
      success: false,
      error: 'File quarantined due to security scan',
      code: 'FILE_QUARANTINED',
      message: expect.stringContaining('quarantined'),
      issues: expect.arrayContaining([
        'Linux executable detected'
      ]),
      threatLevel: 'dangerous',
      hash: expect.any(String)
    }, 403)
  })

  it('should generate and store file hash', async () => {
    const fileSecurityConfig: FileSecurityConfig = {
      scanFiles: true
    }

    const secureUpload = secureUploadRoutes(fileSecurityConfig)

    const fileContent = 'test file content for hashing'
    const testFile = new File([fileContent], 'test.pcap', { type: 'application/octet-stream' })

    const formData = new FormData()
    formData.append('file', testFile)

    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue('multipart/form-data; boundary=----WebKitFormBoundary'),
        formData: vi.fn().mockResolvedValue(formData)
      },
      res: {
        headers: {
          set: vi.fn(),
          get: vi.fn()
        },
        json: vi.fn(),
        status: vi.fn()
      },
      set: vi.fn()
    }

    const mockNext = vi.fn()
    await secureUpload(mockContext as any, mockNext)

    expect(mockNext).toHaveBeenCalled()

    // Should have stored file info with hash
    expect(mockContext.set).toHaveBeenCalledWith('fileInfo', expect.objectContaining({
      name: 'test.pcap',
      size: fileContent.length,
      ext: '.pcap',
      hash: expect.stringMatching(/^[a-f0-9]{64}$/), // SHA-256 hash
      scanResult: expect.objectContaining({
        safe: true,
        threatLevel: 'safe',
        issues: []
      })
    }))

    // Should have added hash header
    expect(mockContext.res.headers.set).toHaveBeenCalledWith('X-File-Hash', expect.stringMatching(/^[a-f0-9]{64}$/))
  })

  it('should handle scan errors gracefully', async () => {
    const fileSecurityConfig: FileSecurityConfig = {
      scanFiles: true
    }

    const secureUpload = secureUploadRoutes(fileSecurityConfig)

    // Mock a file that will cause scanning issues
    const testFile = new File(['test'], 'test.pcap', { type: 'application/octet-stream' })

    const formData = new FormData()
    formData.append('file', testFile)

    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue('multipart/form-data; boundary=----WebKitFormBoundary'),
        formData: vi.fn().mockResolvedValue(formData)
      },
      res: {
        headers: {
          set: vi.fn(),
          get: vi.fn()
        },
        json: vi.fn(),
        status: vi.fn()
      },
      set: vi.fn()
    }

    const mockNext = vi.fn()
    await secureUpload(mockContext as any, mockNext)

    expect(mockNext).toHaveBeenCalled()
    // Should handle errors gracefully and still allow the file through
    expect(mockContext.set).toHaveBeenCalledWith('fileInfo', expect.objectContaining({
      name: 'test.pcap'
    }))
  })
})