/**
 * Global E2E test teardown
 * Runs once after all tests to:
 * 1. Clean up test data
 * 2. Close any open resources
 */

import { FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test global teardown...')

  // Optionally clean up test data
  // Note: We typically want to keep test data for debugging, so this is optional
  const cleanup = process.env.CLEANUP_AFTER_TESTS === 'true'

  if (cleanup) {
    console.log('Cleaning up test data...')
    await cleanupTestData()
    console.log('✅ Test data cleaned up')
  } else {
    console.log('ℹ️  Skipping cleanup (set CLEANUP_AFTER_TESTS=true to enable)')
  }

  console.log('✅ Global teardown complete!')
}

async function cleanupTestData() {
  const API_URL = process.env.API_URL || 'http://localhost:3001/api'

  try {
    // Login as admin to get cleanup permissions (Better Auth uses /auth/sign-in/email)
    const loginResponse = await fetch(`${API_URL}/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({
        email: 'e2e-admin@test.crackhouse.local',
        password: 'Admin123!',
      }),
    })

    if (!loginResponse.ok) {
      console.log('⚠️  Could not login as admin for cleanup')
      return
    }

    const { token } = await loginResponse.json()
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }

    // Delete test users (except admin)
    const usersResponse = await fetch(`${API_URL}/users`, { headers })
    if (usersResponse.ok) {
      const { data } = await usersResponse.json()

      for (const user of data) {
        if (user.email?.includes('test.crackhouse.local') && user.role !== 'admin') {
          await fetch(`${API_URL}/users/${user.id}`, {
            method: 'DELETE',
            headers,
          }).catch(() => {})
        }
      }
    }

    // Delete test jobs
    const jobsResponse = await fetch(`${API_URL}/jobs`, { headers })
    if (jobsResponse.ok) {
      const { data } = await jobsResponse.json()

      for (const job of data) {
        if (job.name?.startsWith('E2E') || job.name?.startsWith('Test')) {
          await fetch(`${API_URL}/jobs/${job.id}`, {
            method: 'DELETE',
            headers,
          }).catch(() => {})
        }
      }
    }

    // Delete test captures
    const capturesResponse = await fetch(`${API_URL}/captures`, { headers })
    if (capturesResponse.ok) {
      const { data } = await capturesResponse.json()

      for (const capture of data) {
        if (capture.filename?.startsWith('e2e-')) {
          await fetch(`${API_URL}/captures/${capture.id}`, {
            method: 'DELETE',
            headers,
          }).catch(() => {})
        }
      }
    }

    // Delete test dictionaries
    const dictsResponse = await fetch(`${API_URL}/dictionaries`, { headers })
    if (dictsResponse.ok) {
      const { data } = await dictsResponse.json()

      for (const dict of data) {
        if (dict.name?.startsWith('E2E') || dict.name?.startsWith('Test')) {
          await fetch(`${API_URL}/dictionaries/${dict.id}`, {
            method: 'DELETE',
            headers,
          }).catch(() => {})
        }
      }
    }

    // Delete test networks
    const networksResponse = await fetch(`${API_URL}/networks`, { headers })
    if (networksResponse.ok) {
      const { data } = await networksResponse.json()

      for (const network of data) {
        if (network.ssid?.startsWith('E2E') || network.ssid?.startsWith('Test')) {
          await fetch(`${API_URL}/networks/${network.id}`, {
            method: 'DELETE',
            headers,
          }).catch(() => {})
        }
      }
    }
  } catch (error) {
    console.log('⚠️  Cleanup error:', error)
  }
}

export default globalTeardown
