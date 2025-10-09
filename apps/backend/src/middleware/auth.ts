import { Context, Next } from 'hono';
import { auth } from '../config/auth';
import type { User } from '../db';
import { AppContext } from '../lib/hono';

export async function requireAuth(c: Context<AppContext>, next: Next) {
  try {
    const session = await auth.api.getSession({
      headers: c.req.header(),
    });

    if (!session || !session.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Convert better-auth user to our User type (passwordHash not exposed in session)
    const user: User = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      emailVerified: session.user.emailVerified,
      image: session.user.image || null,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    };

    // Add user to context
    c.set('user', user);
    c.set('session', session);

    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}