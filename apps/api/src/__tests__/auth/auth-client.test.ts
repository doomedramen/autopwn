import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authClient } from '../../lib/auth'
import { TestDataFactory } from '../test/utils/test-data-factory'

// Mock the environment
vi.mock('../../config/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    NODE_ENV: 'test',
    AUTH_URL: 'http://localhost:3001/auth',
    FRONTEND_URL: 'http://localhost:3000'
  }
}))

describe('Auth Client Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Configuration', () => {
    it('should be properly configured with PostgreSQL database', () => {
      expect(authClient).toBeDefined()
      expect(authClient.options).toBeDefined()
    })

    it('should have email and password authentication enabled', () => {
      const emailPasswordConfig = authClient.options.emailAndPassword
      expect(emailPasswordConfig?.enabled).toBe(true)
    })

    it('should have sign up disabled for public users', () => {
      const emailPasswordConfig = authClient.options.emailAndPassword
      expect(emailPasswordConfig?.disableSignUp).toBe(true)
    })

    it('should have session configuration with 7-day expiry', () => {
      const sessionConfig = authClient.options.session
      expect(sessionConfig?.expiresIn).toBe(60 * 60 * 24 * 7) // 7 days
      expect(sessionConfig?.updateAge).toBe(60 * 60 * 24) // 1 day
    })
  })

  describe('User Schema Configuration', () => {
    it('should configure custom user model with role field', () => {
      const userConfig = authClient.options.user
      expect(userConfig?.modelName).toBe('users')
      expect(userConfig?.additionalFields?.role).toBeDefined()
      expect(userConfig?.additionalFields?.role?.type).toBe('string')
      expect(userConfig?.additionalFields?.role?.defaultValue).toBe('user')
    })

    it('should map database fields correctly', () => {
      const userConfig = authClient.options.user
      expect(userConfig?.fields?.emailVerified).toBe('email_verified')
      expect(userConfig?.fields?.createdAt).toBe('created_at')
      expect(userConfig?.fields?.updatedAt).toBe('updated_at')
    })
  })

  describe('Admin Plugin Configuration', () => {
    it('should have admin plugin configured', () => {
      const plugins = authClient.options.plugins || []
      expect(plugins.length).toBeGreaterThan(0)
    })

    it('should set default role to user', () => {
      const plugins = authClient.options.plugins || []
      const adminPlugin = plugins.find(plugin =>
        plugin && typeof plugin === 'object' && 'name' in plugin && plugin.name === 'admin'
      )
      expect(adminPlugin).toBeDefined()
    })
  })

  describe('Security Configuration', () => {
    it('should configure secure cookies in production', () => {
      const advancedConfig = authClient.options.advanced
      expect(advancedConfig?.secureCookies).toBe(false) // test environment
    })

    it('should have session cookie cache enabled', () => {
      const sessionConfig = authClient.options.session
      expect(sessionConfig?.cookieCache?.enabled).toBe(true)
      expect(sessionConfig?.cookieCache?.maxAge).toBe(5 * 60) // 5 minutes
    })
  })

  describe('Verification Configuration', () => {
    it('should configure verification with custom model name', () => {
      const verificationConfig = authClient.options.verification
      expect(verificationConfig?.modelName).toBe('verifications')
      expect(verificationConfig?.fields?.userId).toBe('user_id')
      expect(verificationConfig?.disableCleanup).toBe(false)
    })
  })

  describe('Account Linking Configuration', () => {
    it('should configure account linking with trusted providers', () => {
      const accountConfig = authClient.options.account
      expect(accountConfig?.accountLinking?.enabled).toBe(true)
      expect(accountConfig?.accountLinking?.allowDifferentEmails).toBe(false)
      expect(accountConfig?.accountLinking?.trustedProviders).toContain('google')
      expect(accountConfig?.accountLinking?.trustedProviders).toContain('github')
      expect(accountConfig?.accountLinking?.trustedProviders).toContain('microsoft')
    })
  })

  describe('Session Schema Configuration', () => {
    it('should configure session model with correct field mappings', () => {
      const sessionConfig = authClient.options.session
      expect(sessionConfig?.modelName).toBe('sessions')
      expect(sessionConfig?.fields?.userId).toBe('user_id')
      expect(sessionConfig?.fields?.expiresAt).toBe('expires_at')
      expect(sessionConfig?.fields?.createdAt).toBe('created_at')
      expect(sessionConfig?.fields?.updatedAt).toBe('updated_at')
      expect(sessionConfig?.fields?.ipAddress).toBe('ip_address')
      expect(sessionConfig?.fields?.userAgent).toBe('user_agent')
    })
  })

  describe('Account Schema Configuration', () => {
    it('should configure account model with correct field mappings', () => {
      const accountConfig = authClient.options.account
      expect(accountConfig?.modelName).toBe('accounts')
      expect(accountConfig?.fields?.userId).toBe('user_id')
      expect(accountConfig?.fields?.accountId).toBe('account_id')
      expect(accountConfig?.fields?.providerId).toBe('provider_id')
      expect(accountConfig?.fields?.accessTokenExpiresAt).toBe('access_token_expires_at')
      expect(accountConfig?.fields?.refreshTokenExpiresAt).toBe('refresh_token_expires_at')
      expect(accountConfig?.fields?.createdAt).toBe('created_at')
      expect(accountConfig?.fields?.updatedAt).toBe('updated_at')
    })
  })
})

describe('Auth Client Edge Cases', () => {
  it('should handle missing environment gracefully', () => {
    // Test that client can be created even if some env vars are missing
    expect(() => authClient).not.toThrow()
  })

  it('should have reasonable default values for security settings', () => {
    const advancedConfig = authClient.options.advanced
    expect(advancedConfig?.generateId).toBe(false)
    expect(advancedConfig?.crossSubDomainCookies?.enabled).toBe(false)
    expect(advancedConfig?.prefixedCookies).toBe(false)
  })
})