import type { FastifyRequest, FastifyReply } from 'fastify';
import { auth, type User } from '../lib/auth';
import type { UserRole } from '@autopwn/shared';

/**
 * Authentication Middleware
 *
 * Protects routes and enforces role-based access control (RBAC)
 */

/**
 * Extend Fastify request with user property
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

/**
 * Require authentication middleware
 * Adds user to request if authenticated
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
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

  try {
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

    // Check if user is active
    if (!session.user.isActive) {
      return reply.code(403).send({
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Account has been disabled',
        },
      });
    }

    // Attach user to request
    request.user = session.user;
  } catch (error) {
    request.log.error(error, 'Auth middleware error');
    return reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication error',
      },
    });
  }
}

/**
 * Require specific role(s) middleware factory
 * Must be used after requireAuth
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
        },
      });
    }

    const userRole = request.user.role as UserRole;

    if (!allowedRoles.includes(userRole)) {
      return reply.code(403).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to access this resource',
          details: {
            required: allowedRoles,
            current: userRole,
          },
        },
      });
    }
  };
}

/**
 * Require admin or superuser role
 */
export const requireAdmin = requireRole('admin', 'superuser');

/**
 * Require superuser role only
 */
export const requireSuperuser = requireRole('superuser');

/**
 * Optional authentication middleware
 * Adds user to request if authenticated, but doesn't require it
 */
export async function optionalAuth(request: FastifyRequest, reply: FastifyReply) {
  const sessionToken = request.cookies.session;

  if (!sessionToken) {
    return;
  }

  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: `session=${sessionToken}`,
      },
    });

    if (session && session.user.isActive) {
      request.user = session.user;
    }
  } catch (error) {
    // Silently fail for optional auth
    request.log.debug(error, 'Optional auth failed');
  }
}
