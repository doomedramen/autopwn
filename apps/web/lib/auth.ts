import { createAuthClient } from 'better-auth/react'

// Create Better Auth client
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
})

// Authentication functions
export const auth = {
  // Sign in with email and password
  signIn: async (email: string, password: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/sign-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Sign in failed')
      }

      return data
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  },

  // Sign up with email and password
  signUp: async (email: string, password: string, name?: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/sign-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Sign up failed')
      }

      return data
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    }
  },

  // Sign out
  signOut: async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/sign-out`, {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Sign out failed')
      }

      return data
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  },

  // Get current user session
  getSession: async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/me`, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get session')
      }

      return data
    } catch (error) {
      console.error('Get session error:', error)
      throw error
    }
  },

  // Get user profile
  getProfile: async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/me`, {
        method: 'GET',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get profile')
      }

      return data
    } catch (error) {
      console.error('Get profile error:', error)
      throw error
    }
  },

  // Update user profile
  updateProfile: async (data: { name?: string; email?: string }) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update profile')
      }

      return result
    } catch (error) {
      console.error('Update profile error:', error)
      throw error
    }
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password')
      }

      return data
    } catch (error) {
      console.error('Change password error:', error)
      throw error
    }
  },
}

export default auth