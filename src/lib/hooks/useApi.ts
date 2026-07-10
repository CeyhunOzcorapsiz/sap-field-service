'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => Promise<void>;
  setData: (data: T | null) => void;
}

export function useApi<T>(
  url: string | null,
  options?: RequestInit,
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Bir hata oluştu' }));
        throw new Error(err.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!controller.signal.aborted) {
        setState({ data, loading: false, error: null });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Bilinmeyen hata',
        });
      }
    }
  }, [url]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  const setData = useCallback((data: T | null) => {
    setState((prev) => ({ ...prev, data }));
  }, []);

  return { ...state, refetch: fetchData, setData };
}

// Mutation hook for POST/PATCH/DELETE
interface UseMutationReturn<TInput, TOutput> {
  mutate: (data: TInput) => Promise<TOutput>;
  loading: boolean;
  error: string | null;
}

export function useMutation<TInput, TOutput>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
): UseMutationReturn<TInput, TOutput> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (data: TInput): Promise<TOutput> => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: method !== 'DELETE' ? JSON.stringify(data) : undefined,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'İşlem başarısız' }));
          throw new Error(err.message || `HTTP ${res.status}`);
        }

        const result = res.status === 204 ? ({} as TOutput) : await res.json();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [url, method],
  );

  return { mutate, loading, error };
}
