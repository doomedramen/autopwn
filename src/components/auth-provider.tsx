'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import type { AuthUser } from '@/lib/auth';

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

  const refreshUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Normal auth flow - always use authentication
    if (session?.user) {
      refreshUser();
    } else {
      setUser(null);
      setIsLoading(false);
    }
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
