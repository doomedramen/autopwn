import { createHono } from './lib/hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { authRouter } from './routes/auth';
import { jobsRouter } from './routes/jobs';
import { uploadsRouter } from './routes/uploads';
import { dictionariesRouter } from './routes/dictionaries';
import { resultsRouter } from './routes/results';
import { capturesRouter } from './routes/captures';
import { statsRouter } from './routes/stats';
import { analyticsRouter } from './routes/analytics';
import { testSetupRouter } from './routes/test-setup';
import { workerService } from './services/worker';
import { webSocketService } from './services/websocket';
import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { validateRequiredTools } from './utils/validate-tools';

async function startServer() {
  console.log('🚀 Starting AutoPWN Backend...\n');

  // Validate required tools (hashcat, hcxpcapngtool)
  try {
    await validateRequiredTools();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Tool validation failed');
    console.error('\n⚠️  Cannot start server without required tools.');
    process.exit(1);
  }

  // Run database migrations before starting the server
  try {
    console.log('🗄️  Running database migrations...');
    await runMigrations();
    console.log('✅ Database migrations complete\n');
  } catch (error) {
    console.error('❌ Failed to run migrations:', error);
    console.error('Continuing anyway, but database may not be up to date...\n');
  }

  const app = createHono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    // Allow localhost and local network IPs
    const allowedPatterns = [
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      /^http:\/\/\[::1\](:\d+)?$/,
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,  // Local network
      /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,    // Local network
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+(:\d+)?$/,  // Local network
    ];
    const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
    return isAllowed ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'autopwn-backend', timestamp: new Date().toISOString() });
});

// Routes
app.route('/api/auth', authRouter);
app.route('/api/jobs', jobsRouter);
app.route('/api/upload', uploadsRouter);
app.route('/api/dictionaries', dictionariesRouter);
app.route('/api/results', resultsRouter);
app.route('/api/captures', capturesRouter);
app.route('/api/stats', statsRouter);
app.route('/api/analytics', analyticsRouter);
app.route('/api/test', testSetupRouter);

  // Start worker service
  workerService.start();

  const port = env.PORT || 3001;
  console.log(`🚀 AutoPWN Backend server starting on port ${port}`);

  const server = serve({
    fetch: app.fetch,
    port,
  });

  // Initialize WebSocket service
  webSocketService.initialize(server);

  console.log(`🔌 WebSocket service initialized on port ${port}`);
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});