/**
 * Authentication setup for E2E tests
 * This file creates authenticated browser state files for faster tests
 * Run with: pnpm test:e2e:setup
 */

import { chromium, type FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const testUsers = {
  admin: {
    email: 'e2e-admin@test.crackhouse.local',
    password: 'Admin123!',
    name: 'E2E Admin User',
  },
  user: {
    email: 'e2e-user@test.crackhouse.local',
    password: 'User123!',
    name: 'E2E Test User',
  },
  superuser: {
    email: 'e2e-super@test.crackhouse.local',
    password: 'Super123!',
    name: 'E2E Super User',
  },
}

async function globalSetup(config: FullConfig) {
  console.log('🔐 Setting up authenticated browser states...')

  const baseURL = process.env.BASE_URL || 'http://localhost:3000'
  const authDir = path.join(process.cwd(), 'playwright', '.auth')

  // Ensure auth directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  // Create authenticated state for each user type
  for (const [userType, user] of Object.entries(testUsers)) {
    try {
      console.log(`Creating auth state for ${userType}...`)

      const browser = await chromium.launch()
      const context = await browser.newContext({
        baseURL,
      })
      const page = await context.newPage()

      // Navigate to sign in
      await page.goto('/sign-in')

      // Fill and submit login form
      await page.fill('input[name="email"]', user.email)
      await page.fill('input[name="password"]', user.password)
      await page.click('button[type="submit"]')

      // Wait for successful login
      await page.waitForURL('/', { timeout: 30000 })
      // Don't use networkidle - WebSocket/polling keeps it busy

      // Save the authenticated state
      await context.storageState({ path: `${authDir}/${userType}.json` })

      await browser.close()
      console.log(`✅ Created auth state for ${userType}`)
    } catch (error) {
      console.log(`❌ Failed to create auth state for ${userType}:`, error)
    }
  }

  console.log('✅ Auth setup complete!')
}

export default globalSetup
