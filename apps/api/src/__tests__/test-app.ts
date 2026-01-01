// Test-only app for integration tests
// This provides a minimal Hono app instance without starting servers/workers
// Fixes the infrastructure blocker for integration tests

import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth";
import { getUser } from "@/lib/auth";

const app = new Hono();

// Apply only auth middleware (no servers, queues, etc)
app.use("*", authMiddleware);

// Expose a helper to get authenticated user for tests
export async function getTestUser(email: string, password: string) {
  // Find user by email in test database
  const user = await getUser(app, email, password);

  if (!user) {
    throw new Error(`Test user not found: ${email}`);
  }

  return user;
}

export { app };
