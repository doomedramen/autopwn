// Test-only app for integration tests
// Provides Hono app instance with all routes but without starting servers/workers
// Fixes infrastructure blocker for integration tests

import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { environmentAwareCORS, publicApiCORS } from "../middleware/cors";
import { securityMiddleware } from "../middleware/security";
import {
  dbSecurityMiddleware,
  parameterValidationMiddleware,
} from "../middleware/db-security";
import { fileSecurityMiddleware } from "../middleware/fileSecurity";
import { errorHandler } from "../lib/error-handler";

// Import routes
import { authRoutes } from "../routes/auth";
import { usersRoutes } from "../routes/users";
import { jobManagementRoutes } from "../routes/jobs";
import { jobUpdateRoutes } from "../routes/jobs-update";
import { networksRoutes } from "../routes/networks";
import { dictionariesRoutes } from "../routes/dictionaries";
import { resultsRoutes } from "../routes/results";
import { queueRoutes } from "../routes/queue-management";
import { capturesRoutes } from "../routes/captures";
import { uploadRoutes } from "../routes/upload";
import { configRoutes } from "../routes/config";
import { auditRoutes } from "../routes/audit";
import { healthRoutes } from "../routes/health";
import { securityRoutes } from "../routes/security-monitoring";
import { virusScannerRoutes } from "../routes/virus-scanner";
import { websocketRoutes } from "../routes/websocket";
import { storageRoutes } from "../routes/storage";
import emailRoutes from "../routes/email";

import { auth } from "../lib/auth";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", environmentAwareCORS());

// Auth session handling (simplified for tests)
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    c.set("userId", null);
  } else {
    c.set("user", session.user);
    c.set("session", session.session);
    c.set("userId", session.user.id);
  }

  await next();
});

// Security middleware (exclude auth routes)
app.use("*", (c, next) => {
  if (c.req.path.startsWith("/api/auth")) {
    return next();
  }
  return dbSecurityMiddleware()(c, next);
});
app.use("*", (c, next) => {
  if (c.req.path.startsWith("/api/auth")) {
    return next();
  }
  return parameterValidationMiddleware()(c, next);
});
app.use("*", (c, next) => {
  if (c.req.path.startsWith("/api/auth")) {
    return next();
  }
  return securityMiddleware(c, next);
});

// API routes
app.route("/api/auth", authRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/jobs", jobManagementRoutes);
app.route("/api/jobs/update", jobUpdateRoutes);
app.route("/api/networks", networksRoutes);
app.route("/api/dictionaries", dictionariesRoutes);
app.route("/api/results", resultsRoutes);
app.route("/api/queue", queueRoutes);
app.route("/api/upload", uploadRoutes);
app.route("/api/captures", capturesRoutes);
app.route("/api/config", configRoutes);
app.route("/api/audit", auditRoutes);
app.route("/api/health", healthRoutes);
app.route("/api/storage", storageRoutes);
app.route("/api/websocket", websocketRoutes);
app.route("/security", securityRoutes);
app.route("/virus-scanner", virusScannerRoutes);
app.route("/api/email", emailRoutes);

// Health check
app.get("/health", publicApiCORS(), (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "autopwn-api",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// Error handling
app.use("*", errorHandler);

export { app };
