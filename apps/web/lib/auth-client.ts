import { getApiUrl } from './runtime-config';

// Auth interface matching better-auth response structure
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: AuthUser;
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
    ipAddress: string;
    userAgent: string;
  };
}

// Simple auth client that works with our backend
export const authClient = {
  async signIn(data: { email: string; password: string }) {
    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Login failed' }));
        return { data: null, error: error.error || 'Login failed' };
      }

      const result = await response.json();
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Login failed' };
    }
  },

  async signUp(data: { email: string; password: string; name?: string }) {
    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Signup failed' }));
        return { data: null, error: error.error || 'Signup failed' };
      }

      const result = await response.json();
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Signup failed' };
    }
  },

  async signOut() {
    try {
      const apiUrl = await getApiUrl();
      await fetch(`${apiUrl}/api/auth/sign-out`, {
        method: 'POST',
        credentials: 'include',
      });
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Logout failed' };
    }
  },

  async getSession() {
    try {
      const apiUrl = await getApiUrl();
      console.log('Fetching session from:', `${apiUrl}/api/auth/get-session`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${apiUrl}/api/auth/get-session`, {
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('Session response status:', response.status);

      if (!response.ok) {
        console.log('Session response not ok');
        return { data: null, error: null };
      }

      const result = await response.json();
      console.log('Session response data:', result);
      return { data: result, error: null };
    } catch (error) {
      console.error('Session fetch error:', error);
      return { data: null, error: null };
    }
  },
};

export const {
  signIn,
  signUp,
  signOut,
  getSession,
} = authClient;