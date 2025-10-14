'use client';

import { useState, useEffect, useCallback } from 'react';

interface CrackedPassword {
  id: string;
  jobId: string;
  networkId: string;
  hash: string;
  plainPassword: string;
  crackedAt: string;
  job: {
    id: string;
    name: string;
    createdAt: string;
    completedAt: string | null;
  };
}

interface UseNetworkPasswordsResult {
  passwords: CrackedPassword[];
  isLoading: boolean;
  error: string | null;
  fetchPasswords: () => Promise<void>;
}

export function useNetworkPasswords(
  networkId?: string
): UseNetworkPasswordsResult {
  const [passwords, setPasswords] = useState<CrackedPassword[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPasswords = useCallback(async () => {
    if (!networkId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/networks/${networkId}/passwords`);

      if (!response.ok) {
        throw new Error(`Failed to fetch passwords: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        setPasswords(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch passwords');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching network passwords:', err);
    } finally {
      setIsLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    if (networkId) {
      fetchPasswords();
    }
  }, [networkId, fetchPasswords]);

  return {
    passwords,
    isLoading,
    error,
    fetchPasswords,
  };
}
