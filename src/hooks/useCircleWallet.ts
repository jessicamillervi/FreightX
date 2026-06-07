'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  type CircleWalletSession, 
  registerCircleWallet, 
  loginCircleWallet, 
  getSavedSession, 
  clearSavedSession 
} from '@/lib/circle-wallet';

export function useCircleWallet() {
  const [circleSession, setCircleSession] = useState<CircleWalletSession | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    const saved = getSavedSession();
    if (saved) {
      setCircleSession(saved);
    }
  }, []);

  const register = useCallback(async (username: string) => {
    setLoading(true);
    setError(null);
    try {
      const session = await registerCircleWallet(username);
      setCircleSession(session);
      return session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await loginCircleWallet();
      setCircleSession(session);
      return session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSavedSession();
    setCircleSession(null);
    setError(null);
  }, []);

  return {
    circleSession,
    setCircleSession,
    loading,
    error,
    register,
    login,
    logout
  };
}
