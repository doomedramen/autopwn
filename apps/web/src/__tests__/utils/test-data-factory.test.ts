import { describe, it, expect } from 'vitest'
import { TestDataFactory } from '../../test/utils/test-data-factory'

describe('TestDataFactory', () => {
  describe('User Data Generation', () => {
    it('should create a valid user with default values', () => {
      const user = TestDataFactory.createUser()

      expect(user).toBeDefined()
      expect(user.id).toBeTruthy()
      expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      expect(user.role).toBe('user')
      expect(user.isActive).toBe(true)
      expect(user.emailVerified).toBe(true)
    })

    it('should create an admin user', () => {
      const admin = TestDataFactory.createAdminUser()

      expect(admin.role).toBe('admin')
      expect(admin.email).toBe('admin@autopwn.local')
      expect(admin.username).toBe('admin')
    })

    it('should allow user customization with overrides', () => {
      const customUser = TestDataFactory.createUser({
        email: 'custom@example.com',
        role: 'custom_role'
      })

      expect(customUser.email).toBe('custom@example.com')
      expect(customUser.role).toBe('custom_role')
    })
  })

  describe('Job Data Generation', () => {
    it('should create a valid job with default values', () => {
      const job = TestDataFactory.createJob()

      expect(job).toBeDefined()
      expect(job.id).toBeTruthy()
      expect(job.name).toBeTruthy()
      expect(job.type).toMatch(/^(wordlist|mask|hybrid)$/)
      expect(job.status).toMatch(/^(pending|running|completed|failed)$/)
      expect(job.hashcatMode).toMatch(/^(22000|16800)$/)
    })

    it('should create a completed job with results', () => {
      const completedJob = TestDataFactory.createJob({
        status: 'completed',
        results: {
          cracked: 10,
          total: 100,
          timeTaken: 5000,
          speed: 1500
        }
      })

      expect(completedJob.status).toBe('completed')
      expect(completedJob.results).toBeDefined()
      expect(completedJob.results!.cracked).toBe(10)
      expect(completedJob.results!.total).toBe(100)
    })

    it('should handle different job types', () => {
      const wordlistJob = TestDataFactory.createJob({ type: 'wordlist' })
      const maskJob = TestDataFactory.createJob({ type: 'mask' })
      const hybridJob = TestDataFactory.createJob({ type: 'hybrid' })

      expect(wordlistJob.type).toBe('wordlist')
      expect(maskJob.type).toBe('mask')
      expect(hybridJob.type).toBe('hybrid')
    })
  })

  describe('Network Capture Data Generation', () => {
    it('should create a valid network capture', () => {
      const capture = TestDataFactory.createNetworkCapture()

      expect(capture).toBeDefined()
      expect(capture.id).toBeTruthy()
      expect(capture.filename).toMatch(/\.pcap$/)
      expect(capture.networks).toBeInstanceOf(Array)
      expect(capture.networks.length).toBeGreaterThan(0)
    })

    it('should create networks with valid properties', () => {
      const capture = TestDataFactory.createNetworkCapture({
        networks: [
          {
            ssid: 'TestNetwork',
            bssid: '00:11:22:33:44:55',
            channel: 6,
            frequency: 2437,
            encryption: 'WPA2'
          }
        ]
      })

      const network = capture.networks[0]
      expect(network.ssid).toBe('TestNetwork')
      expect(network.bssid).toMatch(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)
      expect(network.channel).toBeGreaterThan(0)
      expect(network.frequency).toBeGreaterThan(0)
      expect(network.encryption).toMatch(/^(WPA2|WPA3|WPA\/WPA2|OPEN)$/)
    })

    it('should support multiple networks in a capture', () => {
      const capture = TestDataFactory.createNetworkCapture({ networks: undefined }) // Use default generation

      expect(capture.networks.length).toBeGreaterThanOrEqual(1)
      expect(capture.networks.length).toBeLessThanOrEqual(5) // Default limit
    })
  })

  describe('Dictionary Data Generation', () => {
    it('should create a valid dictionary', () => {
      const dict = TestDataFactory.createDictionary()

      expect(dict).toBeDefined()
      expect(dict.id).toBeTruthy()
      expect(dict.name).toBeTruthy()
      expect(dict.type).toMatch(/^(wordlist|rule|combined)$/)
      expect(dict.format).toBe('txt')
      expect(dict.size).toBeGreaterThan(0)
    })

    it('should support different dictionary sources', () => {
      const rockyou = TestDataFactory.createDictionary({ source: 'rockyou' })
      const custom = TestDataFactory.createDictionary({ source: 'custom' })
      const generated = TestDataFactory.createDictionary({ source: 'generated' })

      expect(rockyou.source).toBe('rockyou')
      expect(custom.source).toBe('custom')
      expect(generated.source).toBe('generated')
    })

    it('should handle public/private dictionary settings', () => {
      const publicDict = TestDataFactory.createDictionary({ isPublic: true })
      const privateDict = TestDataFactory.createDictionary({ isPublic: false })

      expect(publicDict.isPublic).toBe(true)
      expect(privateDict.isPublic).toBe(false)
    })
  })

  describe('Form Data Generation', () => {
    it('should create valid job form data', () => {
      const formData = TestDataFactory.createJobFormData()

      expect(formData).toBeDefined()
      expect(formData.name).toBeTruthy()
      expect(formData.type).toMatch(/^(wordlist|mask|hybrid)$/)
      expect(formData.dictionaryId).toBeTruthy()
      expect(formData.captureId).toBeTruthy()
      expect(formData.hashcatMode).toMatch(/^(22000|16800)$/)
    })

    it('should create valid authentication form data', () => {
      const authData = TestDataFactory.createAuthFormData()

      expect(authData).toBeDefined()
      expect(authData.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      expect(authData.password).toBeTruthy()
      expect(authData.password.length).toBeGreaterThanOrEqual(8)
    })

    it('should support custom form data overrides', () => {
      const customForm = TestDataFactory.createJobFormData({
        name: 'Custom Job',
        type: 'mask',
        mask: '?d?d?d?d'
      })

      expect(customForm.name).toBe('Custom Job')
      expect(customForm.type).toBe('mask')
      expect(customForm.mask).toBe('?d?d?d?d')
    })
  })

  describe('API Response Data Generation', () => {
    it('should create successful API response', () => {
      const response = TestDataFactory.createApiResponse({
        success: true,
        data: { message: 'Operation successful' }
      })

      expect(response.success).toBe(true)
      expect(response.data).toEqual({ message: 'Operation successful' })
      expect(response.error).toBeNull()
    })

    it('should create error API response', () => {
      const response = TestDataFactory.createApiResponse({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input'
        }
      })

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe('VALIDATION_ERROR')
      expect(response.data).toBeNull()
    })
  })

  describe('Pagination Data Generation', () => {
    it('should create paginated response with correct structure', () => {
      const paginated = TestDataFactory.createPaginationResponse({
        page: 2,
        limit: 20,
        total: 100
      })

      expect(paginated.items).toBeInstanceOf(Array)
      expect(paginated.items.length).toBe(20)
      expect(paginated.pagination.page).toBe(2)
      expect(paginated.pagination.limit).toBe(20)
      expect(paginated.pagination.total).toBe(100)
      expect(paginated.pagination.pages).toBe(5) // Math.ceil(100/20)
    })

    it('should handle pagination edge cases correctly', () => {
      const firstPage = TestDataFactory.createPaginationResponse({ page: 1, limit: 10, total: 5 })
      const lastPage = TestDataFactory.createPaginationResponse({ page: 1, limit: 10, total: 10 })

      expect(firstPage.pagination.hasPrev).toBe(false)
      expect(firstPage.pagination.hasNext).toBe(false)
      expect(lastPage.pagination.hasPrev).toBe(false)
      expect(lastPage.pagination.hasNext).toBe(false)
    })
  })

  describe('Queue Status Generation', () => {
    it('should create valid queue status', () => {
      const status = TestDataFactory.createQueueStatus()

      expect(status).toBeDefined()
      expect(status.waiting).toBeGreaterThanOrEqual(0)
      expect(status.active).toBeGreaterThanOrEqual(0)
      expect(status.completed).toBeGreaterThanOrEqual(0)
      expect(status.failed).toBeGreaterThanOrEqual(0)
      expect(status.workerStatus).toMatch(/^(healthy|busy|idle|error)$/)
    })

    it('should support different worker statuses', () => {
      const healthy = TestDataFactory.createQueueStatus({ workerStatus: 'healthy' })
      const busy = TestDataFactory.createQueueStatus({ workerStatus: 'busy' })
      const idle = TestDataFactory.createQueueStatus({ workerStatus: 'idle' })
      const error = TestDataFactory.createQueueStatus({ workerStatus: 'error' })

      expect(healthy.workerStatus).toBe('healthy')
      expect(busy.workerStatus).toBe('busy')
      expect(idle.workerStatus).toBe('idle')
      expect(error.workerStatus).toBe('error')
    })
  })

  describe('File Upload Data Generation', () => {
    it('should create valid file upload data', () => {
      const fileUpload = TestDataFactory.createFileUpload()

      expect(fileUpload).toBeDefined()
      expect(fileUpload.file).toBeInstanceOf(File)
      expect(fileUpload.name).toMatch(/\.pcap$/)
      expect(fileUpload.size).toBeGreaterThan(0)
      expect(fileUpload.type).toBe('application/octet-stream')
    })

    it('should support custom file upload data', () => {
      const customFile = TestDataFactory.createFileUpload({
        name: 'custom_capture.cap',
        size: 5000
      })

      expect(customFile.name).toBe('custom_capture.cap')
      expect(customFile.size).toBe(5000)
    })
  })
})