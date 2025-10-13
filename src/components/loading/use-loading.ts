'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseLoadingOptions {
  minLoadingTime?: number; // Minimum time to show loading state (ms)
  maxLoadingTime?: number; // Maximum time before timeout (ms)
  timeoutMessage?: string;
}

interface LoadingState {
  isLoading: boolean;
  message?: string;
  error?: string;
  isTimeout: boolean;
}

export function useLoading(options: UseLoadingOptions = {}) {
  const {
    minLoadingTime = 500,
    maxLoadingTime = 30000,
    timeoutMessage = 'Request is taking longer than expected. Please try again.'
  } = options;

  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    isTimeout: false
  });

  const loadingStartTimeRef = useRef<number | undefined>(undefined);
  const minLoadingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const maxLoadingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const clearTimeouts = useCallback(() => {
    if (minLoadingTimeoutRef.current) {
      clearTimeout(minLoadingTimeoutRef.current);
      minLoadingTimeoutRef.current = undefined;
    }
    if (maxLoadingTimeoutRef.current) {
      clearTimeout(maxLoadingTimeoutRef.current);
      maxLoadingTimeoutRef.current = undefined;
    }
  }, []);

  const startLoading = useCallback((message?: string) => {
    // Clear any existing timeouts
    clearTimeouts();

    // Set loading state
    loadingStartTimeRef.current = Date.now();
    setState({
      isLoading: true,
      message,
      error: undefined,
      isTimeout: false
    });

    // Set minimum loading time timeout
    minLoadingTimeoutRef.current = setTimeout(() => {
      // This timeout ensures the loading state is shown for at least minLoadingTime
    }, minLoadingTime);

    // Set maximum loading time timeout
    if (maxLoadingTime > 0) {
      maxLoadingTimeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          error: timeoutMessage,
          isTimeout: true
        }));
      }, maxLoadingTime);
    }
  }, [clearTimeouts, minLoadingTime, maxLoadingTime, timeoutMessage]);

  const stopLoading = useCallback((error?: string) => {
    const loadingDuration = loadingStartTimeRef.current
      ? Date.now() - loadingStartTimeRef.current
      : 0;

    // If loading hasn't been shown for the minimum time, wait
    if (loadingDuration < minLoadingTime && minLoadingTimeoutRef.current) {
      setTimeout(() => {
        clearTimeouts();
        setState({
          isLoading: false,
          message: undefined,
          error,
          isTimeout: false
        });
      }, minLoadingTime - loadingDuration);
    } else {
      clearTimeouts();
      setState({
        isLoading: false,
        message: undefined,
        error,
        isTimeout: false
      });
    }
  }, [clearTimeouts, minLoadingTime]);

  // Clear timeouts on unmount
  useEffect(() => {
    return clearTimeouts;
  }, [clearTimeouts]);

  return {
    isLoading: state.isLoading,
    loadingMessage: state.message,
    loadingError: state.error,
    isTimeout: state.isTimeout,
    startLoading,
    stopLoading,
    setLoadingMessage: (message: string) => {
      setState(prev => ({ ...prev, message }));
    }
  };
}

// Hook for managing multiple loading states
export function useMultiLoading() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [loadingMessages, setLoadingMessages] = useState<Record<string, string>>({});

  const setLoading = useCallback((key: string, isLoading: boolean, message?: string) => {
    setLoadingStates(prev => ({ ...prev, [key]: isLoading }));
    if (message) {
      setLoadingMessages(prev => ({ ...prev, [key]: message }));
    } else {
      setLoadingMessages(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [key]: _removedKey, ...rest } = prev;
        return rest;
      });
    }
  }, []);

  const isLoading = Object.values(loadingStates).some(Boolean);
  const loadingMessage = isLoading
    ? Object.values(loadingMessages).find(msg => msg)
    : undefined;

  return {
    isLoading,
    loadingMessage,
    loadingStates,
    setLoading,
    clearLoading: useCallback(() => {
      setLoadingStates({});
      setLoadingMessages({});
    }, [])
  };
}