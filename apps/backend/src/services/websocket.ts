import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  subscriptions: Set<string>;
}

interface WebSocketMessage {
  type: string;
  data: any;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientConnection> = new Map();
  private userSockets: Map<string, Set<WebSocket>> = new Map();

  constructor() {
    this.setupMessageHandler();
  }

  initialize(server: any) {
    this.wss = new WebSocketServer({
      server,
      verifyClient: async (info: { req: IncomingMessage; origin?: string; secure: boolean }, done: (res: boolean, code?: number, message?: string) => void) => {
        try {
          // For now, we'll accept all connections and authenticate on message
          // In a production environment, you might want to validate tokens here
          done(true);
        } catch (error) {
          done(false, 401, 'Unauthorized');
        }
      }
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      console.log('WebSocket connection established');

      // Add connection without authentication initially
      this.clients.set(ws, {
        ws,
        userId: '', // Will be set after authentication
        subscriptions: new Set()
      });

      ws.on('message', (data: Buffer) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnection(ws);
      });

      // Send welcome message
      this.sendToClient(ws, {
        type: 'connection',
        data: { message: 'Connected to AutoPWN WebSocket service' }
      });
    });

    console.log('WebSocket server initialized');
  }

  private async handleMessage(ws: WebSocket, data: Buffer) {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      const client = this.clients.get(ws);

      if (!client) return;

      switch (message.type) {
        case 'auth':
          await this.handleAuthentication(ws, message.data);
          break;
        case 'subscribe':
          this.handleSubscription(ws, message.data);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(ws, message.data);
          break;
        case 'ping':
          this.sendToClient(ws, { type: 'pong', data: { timestamp: Date.now() } });
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendToClient(ws, {
        type: 'error',
        data: { message: 'Invalid message format' }
      });
    }
  }

  private async handleAuthentication(ws: WebSocket, data: { token?: string }) {
    try {
      const client = this.clients.get(ws);
      if (!client) return;

      // For simplicity, we'll use session-based auth
      // In production, you might want to verify JWT tokens here
      if (data.token) {
        // Verify token and get user ID
        // This is a simplified version - you'd want proper token verification
        const userId = await this.getUserIdFromToken(data.token);

        if (userId) {
          client.userId = userId;

          // Add to user sockets mapping
          if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
          }
          this.userSockets.get(userId)!.add(ws);

          this.sendToClient(ws, {
            type: 'authenticated',
            data: { userId, message: 'Authentication successful' }
          });

          console.log(`Client authenticated for user ${userId}`);
        } else {
          this.sendToClient(ws, {
            type: 'auth_error',
            data: { message: 'Invalid token' }
          });
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      this.sendToClient(ws, {
        type: 'auth_error',
        data: { message: 'Authentication failed' }
      });
    }
  }

  private async getUserIdFromToken(token: string): Promise<string | null> {
    // This is a placeholder implementation
    // In a real application, you'd verify the JWT token and extract the user ID
    try {
      // For now, we'll just return a mock user ID
      // In production, you'd decode the JWT and validate it
      return 'test-user-1'; // Mock user ID
    } catch (error) {
      return null;
    }
  }

  private handleSubscription(ws: WebSocket, data: { channels: string[] }) {
    const client = this.clients.get(ws);
    if (!client || !client.userId) {
      this.sendToClient(ws, {
        type: 'subscription_error',
        data: { message: 'Must be authenticated to subscribe' }
      });
      return;
    }

    data.channels.forEach(channel => {
      // Validate channel format and user access
      if (this.validateSubscription(client.userId, channel)) {
        client.subscriptions.add(channel);
      }
    });

    this.sendToClient(ws, {
      type: 'subscribed',
      data: { channels: Array.from(client.subscriptions) }
    });
  }

  private handleUnsubscription(ws: WebSocket, data: { channels: string[] }) {
    const client = this.clients.get(ws);
    if (!client) return;

    data.channels.forEach(channel => {
      client.subscriptions.delete(channel);
    });

    this.sendToClient(ws, {
      type: 'unsubscribed',
      data: { channels: Array.from(client.subscriptions) }
    });
  }

  private validateSubscription(userId: string, channel: string): boolean {
    // Allow users to subscribe to their own job updates
    if (channel.startsWith('job:')) {
      const jobId = parseInt(channel.split(':')[1]);
      return !isNaN(jobId);
    }

    // Allow general updates for authenticated users
    if (channel === 'jobs' || channel === 'stats' || channel === 'results') {
      return true;
    }

    return false;
  }

  private handleDisconnection(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (client) {
      // Remove from user sockets mapping
      if (client.userId && this.userSockets.has(client.userId)) {
        this.userSockets.get(client.userId)!.delete(ws);
        if (this.userSockets.get(client.userId)!.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }

      this.clients.delete(ws);
      console.log(`Client disconnected (user: ${client.userId})`);
    }
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Public methods for broadcasting updates
  broadcastJobUpdate(jobId: number, data: any) {
    const message: WebSocketMessage = {
      type: 'job_update',
      data: { jobId, ...data }
    };

    this.clients.forEach((client) => {
      if (client.userId &&
          (client.subscriptions.has('jobs') ||
           client.subscriptions.has(`job:${jobId}`))) {
        this.sendToClient(client.ws, message);
      }
    });
  }

  broadcastStatsUpdate(data: any) {
    const message: WebSocketMessage = {
      type: 'stats_update',
      data
    };

    this.clients.forEach((client) => {
      if (client.userId && client.subscriptions.has('stats')) {
        this.sendToClient(client.ws, message);
      }
    });
  }

  broadcastResultUpdate(data: any) {
    const message: WebSocketMessage = {
      type: 'result_update',
      data
    };

    this.clients.forEach((client) => {
      if (client.userId && client.subscriptions.has('results')) {
        this.sendToClient(client.ws, message);
      }
    });
  }

  broadcastToUser(userId: string, message: WebSocketMessage) {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.forEach(ws => {
        this.sendToClient(ws, message);
      });
    }
  }

  // Setup periodic pings to keep connections alive
  private setupMessageHandler() {
    setInterval(() => {
      this.clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          this.sendToClient(client.ws, {
            type: 'ping',
            data: { timestamp: Date.now() }
          });
        }
      });
    }, 30000); // Ping every 30 seconds
  }

  getStats() {
    return {
      totalConnections: this.clients.size,
      authenticatedConnections: Array.from(this.clients.values()).filter(c => c.userId).length,
      userConnections: this.userSockets.size
    };
  }
}

export const webSocketService = new WebSocketService();