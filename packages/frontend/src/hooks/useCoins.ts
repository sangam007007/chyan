import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';

export interface UseCoinsResult {
  balance: number | null;
  isLoading: boolean;
  error: boolean;
  refetch: () => void;
}

export function useCoins(): UseCoinsResult {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(false);

    try {
      const response = await api.get('/api/coins/balance', {
        signal: controller.signal,
        timeout: 15_000,
      });
      if (!controller.signal.aborted) {
        setBalance(response.data.data.balance);
      }
    } catch {
      if (!controller.signal.aborted) {
        setError(true);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetch();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetch]);

  return { balance, isLoading, error, refetch: fetch };
}
