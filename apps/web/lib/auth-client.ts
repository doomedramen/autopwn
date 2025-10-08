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

// Use the correct host for Docker tests
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Handle IPv6 addresses by converting them to IPv4 localhost for now
    if (hostname === '[::1]' || hostname === '::1' || hostname === 'localhost') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
};

const API_BASE_URL = getApiBaseUrl();

// Simple auth client that works with our backend
export const authClient = {
  async signIn(data: { email: string; password: string }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
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
      const response = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
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
      await fetch(`${API_BASE_URL}/api/auth/sign-out`, {
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
      console.log('Fetching session from:', `${API_BASE_URL}/api/auth/get-session`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
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