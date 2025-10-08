"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authClient, AuthUser, AuthSession } from './auth-client';

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    console.log('Refreshing session...');
    try {
      const result = await authClient.getSession();
      console.log('Session result:', result);
      if (result.data) {
        setUser(result.data.user);
        setSession(result.data);
        console.log('User set:', result.data.user);
      } else {
        setUser(null);
        setSession(null);
        console.log('No session, user set to null');
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      setUser(null);
      setSession(null);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const result = await authClient.signIn({ email, password });
    if (result.error) {
      return { error: result.error };
    }
    await refreshSession();
    return {};
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const result = await authClient.signUp({ email, password, name });
    if (result.error) {
      return { error: result.error };
    }
    await refreshSession();
    return {};
  };

  const signOut = async () => {
    await authClient.signOut();
    setUser(null);
    setSession(null);
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}