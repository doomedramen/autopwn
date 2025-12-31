// Load environment variables based on NODE_ENV
import "dotenv-flow/config";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { cors } from "hono/cors";
import { environmentAwareCORS, publicApiCORS } from "./middleware/cors";

// Import routes
import { authRoutes } from "./routes/auth";
import { usersRoutes } from "./routes/users";
import { jobsRoutes } from "./routes/jobs";
import { networksRoutes } from "./routes/networks";
import { dictionariesRoutes } from "./routes/dictionaries";
import { resultsRoutes } from "./routes/results";
import { queueRoutes } from "./routes/queue-management";
import { capturesRoutes } from "./routes/captures";
import { uploadRoutes } from "./routes/upload";
import { configRoutes } from "./routes/config";
import { securityRoutes } from "./routes/security-monitoring";
import { virusScannerRoutes } from "./routes/virus-scanner";
import { websocketRoutes } from "./routes/websocket";
import { storageRoutes } from "./routes/storage";

// Import middleware
import { securityMiddleware } from "./middleware/security";
// import { rateLimit, strictRateLimit, uploadRateLimit } from './middleware/rateLimit' // Temporarily disabled for testing
import { fileSecurityMiddleware } from "./middleware/fileSecurity";
import {
  dbSecurityMiddleware,
  parameterValidationMiddleware,
} from "./middleware/db-security";
// import { securityHeaderValidator } from './middleware/security-header-validator' // Temporarily disabled for testing
import { errorHandler } from "./lib/error-handler";

import { auth } from "./lib/auth";
import { getWebSocketServer } from "./lib/websocket";
import type { HonoAuthContext } from "./types/auth";
import { configService } from "./services/config.service";

const app = new Hono<HonoAuthContext>();

// Security and utility middleware (applied globally)
app.use("*", logger());
// Don't use prettyJSON globally as it can consume request body before Better Auth
// app.use('*', prettyJSON())

// Environment-aware CORS configuration
app.use("*", environmentAwareCORS());

// Add middleware to save session and user in context as per documentation
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    c.set("userId", null);
    await next();
    return;
  }

  c.set("user", session.user);
  c.set("session", session.session);
  c.set("userId", session.user.id);
  await next();
});

// Database security and parameter validation (exclude auth routes)
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

// Security header validation (exclude auth routes)
// app.use('*', (c, next) => {
//   if (c.req.path.startsWith('/api/auth')) {
//     return next()
//   }
//   return securityHeaderValidator()(c, next)
// }) // Temporarily disabled for testing

// Security middleware (exclude auth routes - Better Auth handles its own security)
app.use("*", (c, next) => {
  if (c.req.path.startsWith("/api/auth")) {
    return next();
  }
  return securityMiddleware(c, next);
});

// API routes
app.route("/api/auth", authRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/jobs", jobsRoutes);
app.route("/api/networks", networksRoutes);
app.route("/api/dictionaries", dictionariesRoutes);
app.route("/api/results", resultsRoutes);
app.route("/api/queue", queueRoutes);
app.route("/api/upload", uploadRoutes);
app.route("/api/captures", capturesRoutes);
app.route("/api/config", configRoutes);
app.route("/api/storage", storageRoutes);
app.route("/api/websocket", websocketRoutes);
app.route("/security", securityRoutes);
app.route("/virus-scanner", virusScannerRoutes);

// Health check (no auth required) - Public CORS
app.get("/health", publicApiCORS(), (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "autopwn-api",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// Basic API info route - Public CORS
app.get("/api/info", publicApiCORS(), (c) => {
  return c.json({
    message: "AutoPWN API is working",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    endpoints: [
      "/api/auth/*",
      "/api/jobs/*",
      "/api/networks/*",
      "/api/dictionaries/*",
      "/api/results/*",
      "/api/queue/*",
      "/api/upload/*",
      "/api/captures/*",
      "/api/config/*",
      "/security/*",
      "/virus-scanner/*",
      "/health",
    ],
  });
});

// Debug session route - Public CORS for testing
app.get("/api/debug/session", publicApiCORS(), async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const user = c.get("user");
  const userRecord = session?.user || user;

  return c.json({
    session: session
      ? {
          session: !!session.session,
          user: session.user
            ? {
                id: session.user.id,
                email: session.user.email,
                role: session.user.role,
                name: session.user.name,
              }
            : null,
        }
      : null,
    context: {
      user: userRecord
        ? {
            id: userRecord.id,
            email: userRecord.email,
            role: userRecord.role,
            name: userRecord.name,
          }
        : null,
    },
  });
});

// Error handling
app.use("*", errorHandler);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: "The requested resource was not found",
      path: c.req.path,
      available_endpoints: [
        "/api/auth/*",
        "/api/jobs/*",
        "/api/networks/*",
        "/api/dictionaries/*",
        "/api/results/*",
        "/api/queue/*",
        "/api/upload/*",
        "/security/*",
        "/virus-scanner/*",
        "/health",
        "/api/info",
      ],
    },
    404,
  );
});

const port = parseInt(process.env.PORT || "3001");

async function startServer() {
  try {
    // Initialize config service
    await configService.loadConfig();
    console.log("✅ Config service initialized");

    // Start WebSocket server first
    const wsServer = getWebSocketServer();
    await wsServer.start();
    console.log(
      `🔌 WebSocket server started on port ${process.env.WS_PORT || 3002}`,
    );

    // Start HTTP server
    console.log(`🚀 AutoPWN API Server starting on port ${port}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
    console.log(
      `🔗 WebSocket info: http://localhost:${port}/api/websocket/info`,
    );

    serve({
      fetch: app.fetch,
      port,
    }).on("error", (error) => {
      console.error("❌ Server encountered an error", error);
      process.exit(1);
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down servers...");
      await wsServer.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\n🛑 Shutting down servers...");
      await wsServer.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start servers", error);
    process.exit(1);
  }
}

startServer();
