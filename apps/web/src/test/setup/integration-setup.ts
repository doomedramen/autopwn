import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from '../mocks/server'

// Start MSW server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error'
  })
})

// Reset request handlers after each test
afterEach(() => {
  server.resetHandlers()
  cleanup()
})

// Close MSW server after all tests
afterAll(() => {
  server.close()
})

// Global test cleanup
afterEach(() => {
  // Clear any DOM state between tests
  document.body.innerHTML = ''
})

// Mock API base URL
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001'

// Extend vitest's expect with testing-library matchers
import '@testing-library/jest-dom'

// Export test utilities
export * from '@testing-library/react'
export { server }