import type { FastifyInstance } from 'fastify';
import { auth } from '../lib/auth';
import { db } from '../db';
import { user } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Authentication Routes
 *
 * Handles login, logout, session management
 * Uses Better Auth for authentication logic
 */

export async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /auth/login
   * Login with email and password
   */
  fastify.post('/auth/login', async (request, reply) => {
    try {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      // Use Better Auth to sign in
      const result = await auth.api.signInEmail({
        body: { email, password },
      });

      if (!result) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        });
      }

      // Update last login timestamp
      await db
        .update(user)
        .set({ lastLoginAt: new Date() })
        .where(eq(user.id, result.user.id));

      // Set session cookie
      reply.setCookie('session', result.session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: result.session.expiresAt.getTime() - Date.now(),
        path: '/',
      });

      return {
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
          },
        },
      };
    } catch (error) {
      fastify.log.error(error, 'Login error');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during login',
        },
      });
    }
  });

  /**
   * POST /auth/logout
   * Logout current user
   */
  fastify.post('/auth/logout', async (request, reply) => {
    try {
      const sessionToken = request.cookies.session;

      if (sessionToken) {
        // Invalidate session via Better Auth
        await auth.api.signOut({
          headers: {
            cookie: `session=${sessionToken}`,
          },
        });
      }

      // Clear session cookie
      reply.clearCookie('session', { path: '/' });

      return {
        success: true,
        data: { message: 'Logged out successfully' },
      };
    } catch (error) {
      fastify.log.error(error, 'Logout error');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during logout',
        },
      });
    }
  });

  /**
   * GET /auth/session
   * Get current session information
   */
  fastify.get('/auth/session', async (request, reply) => {
    try {
      const sessionToken = request.cookies.session;

      if (!sessionToken) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'NO_SESSION',
            message: 'No active session',
          },
        });
      }

      // Get session via Better Auth
      const session = await auth.api.getSession({
        headers: {
          cookie: `session=${sessionToken}`,
        },
      });

      if (!session) {
        reply.clearCookie('session', { path: '/' });
        return reply.code(401).send({
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: 'Session is invalid or expired',
          },
        });
      }

      return {
        success: true,
        data: {
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            role: session.user.role,
            isActive: session.user.isActive,
          },
          session: {
            expiresAt: session.session.expiresAt,
          },
        },
      };
    } catch (error) {
      fastify.log.error(error, 'Session check error');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred checking session',
        },
      });
    }
  });

  /**
   * POST /auth/change-password
   * Change password for authenticated user
   */
  fastify.post('/auth/change-password', async (request, reply) => {
    try {
      const sessionToken = request.cookies.session;

      if (!sessionToken) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        });
      }

      const session = await auth.api.getSession({
        headers: {
          cookie: `session=${sessionToken}`,
        },
      });

      if (!session) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: 'Session is invalid or expired',
          },
        });
      }

      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };

      // Validate new password length
      if (newPassword.length < 8) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'Password must be at least 8 characters',
          },
        });
      }

      // Use Better Auth to change password
      await auth.api.changePassword({
        body: {
          currentPassword,
          newPassword,
        },
        headers: {
          cookie: `session=${sessionToken}`,
        },
      });

      return {
        success: true,
        data: { message: 'Password changed successfully' },
      };
    } catch (error) {
      fastify.log.error(error, 'Password change error');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred changing password',
        },
      });
    }
  });
}
