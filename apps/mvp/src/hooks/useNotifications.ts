import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import type { NotificationData, NotificationPreferencesData } from '@cryptoart/db';

interface UseNotificationsResult {
  notifications: NotificationData[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  preferences: NotificationPreferencesData | null;
  updatePreferences: (updates: Partial<NotificationPreferencesData>) => Promise<void>;
}

export function useNotifications(options?: {
  limit?: number;
  unreadOnly?: boolean;
}): UseNotificationsResult {
  const { address } = useAccount();
  const { context } = useMiniApp();
  
  // Get verified address from Farcaster if available
  const userAddress = address || 
    (context?.user as any)?.verified_addresses?.primary?.eth_address ||
    (context?.user as any)?.custody_address ||
    ((context?.user as any)?.verifications?.[0] as string);
  
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferencesData | null>(null);
  
  const fetchNotifications = useCallback(async () => {
    if (!userAddress) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const params = new URLSearchParams({
        userAddress,
        limit: String(options?.limit || 50),
        ...(options?.unreadOnly && { unreadOnly: 'true' }),
      });
      
      const response = await fetch(`/api/notifications?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userAddress, options?.limit, options?.unreadOnly]);
  
  const fetchUnreadCount = useCallback(async () => {
    if (!userAddress) return;
    
    try {
      const response = await fetch(`/api/notifications/unread-count?userAddress=${userAddress}`);
      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }
      
      const data = await response.json();
      setUnreadCount(data.count || 0);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [userAddress]);
  
  const fetchPreferences = useCallback(async () => {
    if (!userAddress) return;
    
    try {
      const response = await fetch(`/api/notifications/preferences?userAddress=${userAddress}`);
      if (!response.ok) {
        throw new Error('Failed to fetch preferences');
      }
      
      const data = await response.json();
      setPreferences(data.preferences);
    } catch (err) {
      console.error('Error fetching preferences:', err);
    }
  }, [userAddress]);
  
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    fetchPreferences();
  }, [fetchNotifications, fetchUnreadCount, fetchPreferences]);
  
  const markAsRead = useCallback(async (id: number) => {
    if (!userAddress) return;
    
    try {
      const response = await fetch(`/api/notifications/${id}/read?userAddress=${userAddress}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true, readAt: new Date() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, [userAddress]);
  
  const markAllAsRead = useCallback(async () => {
    if (!userAddress) return;
    
    try {
      // Mark all as read by updating each notification
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(unreadNotifications.map(n => markAsRead(n.id)));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }, [userAddress, notifications, markAsRead]);
  
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferencesData>) => {
    if (!userAddress) return;
    
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          ...updates,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }
      
      const data = await response.json();
      setPreferences(data.preferences);
    } catch (err) {
      console.error('Error updating preferences:', err);
    }
  }, [userAddress]);
  
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchNotifications(),
      fetchUnreadCount(),
    ]);
  }, [fetchNotifications, fetchUnreadCount]);
  
  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    preferences,
    updatePreferences,
  };
}

