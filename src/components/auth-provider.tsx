'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import type { AuthUser } from '@/lib/auth';

// Feature flag to disable authentication for testing
// Note: This is server-side only. Client-side will check via API
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperUser: boolean;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAuthDisabled, setIsAuthDisabled] = useState(false);

  const refreshUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createMockSuperUser = async () => {
    // In auth-disabled mode, create a mock superuser for UI components
    const mockUser: AuthUser = {
      id: 'mock-superuser-id',
      email: 'superuser@autopwn.local',
      name: 'superuser',
      username: 'superuser',
      role: 'superuser',
      isActive: true,
      isEmailVerified: true,
      requirePasswordChange: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setUser(mockUser);
    setIsLoading(false);
  };

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      if (response.ok) {
        const data = await response.json();
        setIsAuthDisabled(data.disabled);

        if (data.disabled) {
          // Auth disabled - create mock superuser
          createMockSuperUser();
          return;
        }
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
    }

    // If auth is not disabled or API check failed, use normal flow
    if (session?.user) {
      refreshUser();
    } else {
      setUser(null);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const isAuthenticated = !!user;
  const isSuperUser = user?.role === 'superuser';
  const isAdmin = user?.role === 'admin' || user?.role === 'superuser';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isLoading || isPending,
        isAuthenticated,
        isSuperUser,
        isAdmin,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
