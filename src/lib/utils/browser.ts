'use client';

/**
 * Client-side utilities that work with Next.js App Router
 * These functions should only be used in client components
 */

/**
 * Safe window access with fallback
 */
export function getWindow(): Window | null {
  if (typeof window !== 'undefined') {
    return window;
  }
  return null;
}

/**
 * Safe localStorage access
 */
export function getLocalStorage(): Storage | null {
  if (typeof window !== 'undefined') {
    return window.localStorage;
  }
  return null;
}

/**
 * Safe sessionStorage access
 */
export function getSessionStorage(): Storage | null {
  if (typeof window !== 'undefined') {
    return window.sessionStorage;
  }
  return null;
}

/**
 * Client-side redirect using Next.js router
 * Use this instead of window.location.href
 * Note: This should be called from within React components
 */
export function clientRedirect(
  router: { replace: (url: string) => void },
  url: string
): void {
  if (typeof window !== 'undefined') {
    router.replace(url);
  }
}

/**
 * Check if we're in a browser environment
 */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Safe crypto access with polyfill fallback
 */
export function getCrypto(): Crypto | null {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  return null;
}

/**
 * Generate UUID with fallback for environments without crypto.randomUUID
 */
export function generateUUID(): string {
  const crypto = getCrypto();
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
