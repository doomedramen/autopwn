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

async function startServer() {
  // Run database migrations before starting the server
  try {
    await runMigrations();
  } catch (error) {
    console.error('Failed to run migrations, continuing anyway...');
  }

  const app = createHono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://[::1]:3000', 'http://127.0.0.1:3000'],
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