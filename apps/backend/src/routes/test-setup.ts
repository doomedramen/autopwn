import { Hono } from 'hono';
import { z } from 'zod';
import { db, users, accounts } from '../db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const testSetupSchema = z.object({
  email: z.string().email().optional().default('test@example.com'),
  password: z.string().min(6).optional().default('testpassword123'),
  name: z.string().optional().default('Test User'),
});

export const testSetupRouter = new Hono()
  .post('/setup-test-user', async (c) => {
    // Only allow in development or test environments
    if (process.env.NODE_ENV === 'production') {
      return c.json({ error: 'Test user setup not available in production' }, 403);
    }

    try {
      const { email, password, name } = testSetupSchema.parse(await c.req.json());
      const passwordHash = await bcrypt.hash(password, 10);

      // Check if user already exists
      const existingUser = await db.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        // Update existing user's password in accounts table
        await db.update(accounts)
          .set({
            password: passwordHash,
            updatedAt: new Date()
          })
          .where(eq(accounts.userId, existingUser[0].id));

        return c.json({
          message: 'Test user updated successfully',
          user: {
            email,
            name,
            password // Only return password in test mode
          }
        });
      } else {
        // Create new user
        const newUser = await db.insert(users)
          .values({
            id: crypto.randomUUID(),
            email,
            name,
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        // Create account for the user with password
        await db.insert(accounts)
          .values({
            id: crypto.randomUUID(),
            accountId: newUser[0].id,
            providerId: 'credential',
            userId: newUser[0].id,
            password: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date()
          });

        return c.json({
          message: 'Test user created successfully',
          user: {
            id: newUser[0].id,
            email,
            name,
            password // Only return password in test mode
          }
        });
      }
    } catch (error) {
      console.error('Test user setup error:', error);
      return c.json({
        error: 'Failed to setup test user',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  })
  .get('/test-user-info', async (c) => {
    // Only allow in development or test environments
    if (process.env.NODE_ENV === 'production') {
      return c.json({ error: 'Test user info not available in production' }, 403);
    }

    const defaultEmail = 'test@example.com';

    try {
      const user = await db.select()
        .from(users)
        .where(eq(users.email, defaultEmail))
        .limit(1);

      if (user.length > 0) {
        return c.json({
          exists: true,
          user: {
            id: user[0].id,
            email: user[0].email,
            name: user[0].name,
            emailVerified: user[0].emailVerified,
            createdAt: user[0].createdAt
          }
        });
      } else {
        return c.json({
          exists: false,
          message: 'Test user not found. Use POST /api/test/setup-test-user to create one.'
        });
      }
    } catch (error) {
      console.error('Test user info error:', error);
      return c.json({
        error: 'Failed to get test user info',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });