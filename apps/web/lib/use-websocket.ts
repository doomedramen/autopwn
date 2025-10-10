import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './auth-context';
import { getWsUrl } from './runtime-config';

interface WebSocketMessage {
  type: string;
  data: any;
}

interface WebSocketHookReturn {
  isConnected: boolean;
  error: string | null;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  lastMessage: WebSocketMessage | null;
}

export function useWebSocket(): WebSocketHookReturn {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    if (!user || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = await getWsUrl();

      console.log('Connecting to WebSocket:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);

        // Subscribe to general channels
        const channels = ['jobs', 'stats', 'results'];
        subscriptionsRef.current = new Set(channels);

        // Send subscription message
        wsRef.current?.send(JSON.stringify({
          type: 'subscribe',
          data: { channels }
        }));

        // Setup ping interval
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message);

          switch (message.type) {
            case 'connection':
              console.log('Connection message:', message.data);
              break;
            case 'pong':
              // Ping received, connection is alive
              break;
            case 'authenticated':
              console.log('WebSocket authenticated:', message.data);
              break;
            case 'subscribed':
              console.log('Subscribed to channels:', message.data.channels);
              break;
            case 'job_update':
            case 'result_update':
            case 'stats_update':
              setLastMessage(message);
              break;
            case 'error':
              console.error('WebSocket error:', message.data);
              setError(message.data.message);
              break;
            default:
              console.log('Unknown WebSocket message type:', message.type);
              setLastMessage(message);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setError(null);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect after 5 seconds
        if (event.code !== 1000) { // Not a normal closure
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            connect();
          }, 5000);
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setError('Failed to create WebSocket connection');
    }
  }, [user]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setIsConnected(false);
    setError(null);
  }, []);

  const subscribe = useCallback((channel: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return;
    }

    if (!subscriptionsRef.current.has(channel)) {
      subscriptionsRef.current.add(channel);

      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        data: { channels: [channel] }
      }));
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    if (subscriptionsRef.current.has(channel)) {
      subscriptionsRef.current.delete(channel);

      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        data: { channels: [channel] }
      }));
    }
  }, []);

  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    error,
    subscribe,
    unsubscribe,
    lastMessage,
  };
}

// Specific hooks for different message types
export function useJobUpdates() {
  const { lastMessage, ...wsHook } = useWebSocket();
  const [jobUpdate, setJobUpdate] = useState<any>(null);

  useEffect(() => {
    if (lastMessage?.type === 'job_update') {
      setJobUpdate(lastMessage.data);
    }
  }, [lastMessage]);

  return { jobUpdate, ...wsHook };
}

export function useResultUpdates() {
  const { lastMessage, ...wsHook } = useWebSocket();
  const [resultUpdate, setResultUpdate] = useState<any>(null);

  useEffect(() => {
    if (lastMessage?.type === 'result_update') {
      setResultUpdate(lastMessage.data);
    }
  }, [lastMessage]);

  return { resultUpdate, ...wsHook };
}

export function useStatsUpdates() {
  const { lastMessage, ...wsHook } = useWebSocket();
  const [statsUpdate, setStatsUpdate] = useState<any>(null);

  useEffect(() => {
    if (lastMessage?.type === 'stats_update') {
      setStatsUpdate(lastMessage.data);
    }
  }, [lastMessage]);

  return { statsUpdate, ...wsHook };
}