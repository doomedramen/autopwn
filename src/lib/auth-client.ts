import { createAuthClient } from 'better-auth/react';

// Modern Next.js 15+ approach: Use relative URLs
// This automatically works with any domain/hostname in production
export const authClient = createAuthClient({
  baseURL: '', // Empty string makes it use relative URLs (modern approach)
});

export const { signIn, signUp, signOut, getSession, useSession } = authClient;
