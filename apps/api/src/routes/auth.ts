import { Hono } from 'hono'
import { authClient } from '@/lib/auth'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { User } from '@/db/schema'

const auth = new Hono()

// Sign up endpoint
auth.post('/sign-up', zValidator('json', z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
})), async (c) => {
  const { email, password, name } = c.req.valid('json')

  try {
    const user = await authClient.signUp.email({
      email,
      password,
      name,
    })

    return c.json({
      success: true,
      user,
    })
  } catch (error) {
    console.error('Sign up error:', error)
    return c.json({
      success: false,
      error: 'Failed to create account',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 400)
  }
})

// Sign in endpoint
auth.post('/sign-in', zValidator('json', z.object({
  email: z.string().email(),
  password: z.string(),
})), async (c) => {
  const { email, password } = c.req.valid('json')

  try {
    const session = await authClient.signIn.email({
      email,
      password,
    })

    return c.json({
      success: true,
      session,
    })
  } catch (error) {
    console.error('Sign in error:', error)
    return c.json({
      success: false,
      error: 'Invalid credentials',
      message: error instanceof Error ? error.message : 'Invalid email or password',
    }, 401)
  }
})

// Sign out endpoint
auth.post('/sign-out', async (c) => {
  try {
    await authClient.signOut({
      // Session token will be read from cookies automatically
    })

    return c.json({
      success: true,
      message: 'Signed out successfully',
    })
  } catch (error) {
    console.error('Sign out error:', error)
    return c.json({
      success: false,
      error: 'Failed to sign out',
    }, 500)
  }
})

// Get current user session
auth.get('/session', async (c) => {
  try {
    const session = await authClient.getSession({
      headers: c.req.raw(),
    })

    return c.json({
      success: true,
      session,
    })
  } catch (error) {
    console.error('Session error:', error)
    return c.json({
      success: false,
      session: null,
    })
  }
})

// Update user profile
auth.put('/profile', zValidator('json', z.object({
  name: z.string().optional(),
  image: z.string().url().optional(),
})), async (c) => {
  const { name, image } = c.req.valid('json')

  try {
    const user = await authClient.updateUser({
      data: { name, image },
      headers: c.req.raw(),
    })

    return c.json({
      success: true,
      user,
    })
  } catch (error) {
    console.error('Profile update error:', error)
    return c.json({
      success: false,
      error: 'Failed to update profile',
    }, 400)
  }
})

// Change password
auth.put('/password', zValidator('json', z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
  confirmPassword: z.string(),
})), async (c) => {
  const { currentPassword, newPassword, confirmPassword } = c.req.valid('json')

  if (newPassword !== confirmPassword) {
    return c.json({
      success: false,
      error: 'Passwords do not match',
    }, 400)
  }

  try {
    await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
      headers: c.req.raw(),
    })

    return c.json({
      success: true,
      message: 'Password changed successfully',
    })
  } catch (error) {
    console.error('Password change error:', error)
    return c.json({
      success: false,
      error: 'Failed to change password',
      message: error instanceof Error ? error.message : 'Current password is incorrect',
    }, 400)
  }
})

// Forgot password
auth.post('/forgot-password', zValidator('json', z.object({
  email: z.string().email(),
})), async (c) => {
  const { email } = c.req.valid('json')

  try {
    await authClient.forgetPassword({
      email,
      redirectTo: `${env.FRONTEND_URL}/auth/reset-password`,
    })

    return c.json({
      success: true,
      message: 'Password reset link sent to your email',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return c.json({
      success: false,
      error: 'Failed to send reset email',
    }, 400)
  }
})

// Reset password
auth.post('/reset-password', zValidator('json', z.object({
  token: z.string(),
  newPassword: z.string().min(8),
  confirmPassword: z.string(),
})), async (c) => {
  const { token, newPassword, confirmPassword } = c.req.valid('json')

  if (newPassword !== confirmPassword) {
    return c.json({
      success: false,
      error: 'Passwords do not match',
    }, 400)
  }

  try {
    await authClient.resetPassword({
      newPassword,
      token,
    })

    return c.json({
      success: true,
      message: 'Password reset successfully',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return c.json({
      success: false,
      error: 'Failed to reset password',
      message: error instanceof Error ? error.message : 'Invalid or expired token',
    }, 400)
  }
})

// Email verification
auth.post('/verify-email', zValidator('json', z.object({
  token: z.string(),
})), async (c) => {
  const { token } = c.req.valid('json')

  try {
    await authClient.verifyEmail({
      token,
    })

    return c.json({
      success: true,
      message: 'Email verified successfully',
    })
  } catch (error) {
    console.error('Email verification error:', error)
    return c.json({
      success: false,
      error: 'Failed to verify email',
      message: error instanceof Error ? error.message : 'Invalid or expired token',
    }, 400)
  }
})

// Send email verification
auth.post('/send-verification-email', zValidator('json', z.object({
  email: z.string().email(),
})), async (c) => {
  const { email } = c.req.valid('json')

  try {
    await authClient.sendVerificationEmail({
      email,
      redirectTo: `${env.FRONTEND_URL}/auth/verify-email`,
    })

    return c.json({
      success: true,
      message: 'Verification email sent',
    })
  } catch (error) {
    console.error('Send verification email error:', error)
    return c.json({
      success: false,
      error: 'Failed to send verification email',
    }, 400)
  }
})

export { auth as authRoutes }