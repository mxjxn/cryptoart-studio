'use client';

import { useState, useEffect, useCallback } from 'react';
import { useIsAdmin } from './useIsAdmin';

const ADMIN_MODE_STORAGE_KEY = 'cryptoart-admin-mode';

/**
 * Hook to manage admin mode state.
 * Admin mode enables inline moderation features throughout the app.
 * 
 * State is persisted to localStorage to survive page refreshes.
 * Only admins can enable admin mode - non-admins always get isAdminModeEnabled: false.
 */
export function useAdminMode() {
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const [isAdminModeEnabled, setIsAdminModeEnabled] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ADMIN_MODE_STORAGE_KEY);
      if (stored === 'true') {
        setIsAdminModeEnabled(true);
      }
      setIsHydrated(true);
    }
  }, []);

  // Persist to localStorage when state changes
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      localStorage.setItem(ADMIN_MODE_STORAGE_KEY, String(isAdminModeEnabled));
    }
  }, [isAdminModeEnabled, isHydrated]);

  const toggleAdminMode = useCallback(() => {
    setIsAdminModeEnabled(prev => !prev);
  }, []);

  const setAdminMode = useCallback((enabled: boolean) => {
    setIsAdminModeEnabled(enabled);
  }, []);

  return {
    isAdmin,
    isAdminLoading,
    // Only return enabled if user is actually admin and hydrated
    isAdminModeEnabled: isAdmin && isHydrated && isAdminModeEnabled,
    toggleAdminMode,
    setAdminMode,
    isHydrated,
  };
}

