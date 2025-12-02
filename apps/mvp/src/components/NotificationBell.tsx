'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '~/hooks/useNotifications';
import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';

export function NotificationBell() {
  const { address } = useAccount();
  const { context } = useMiniApp();
  const { unreadCount } = useNotifications({ unreadOnly: true });
  
  // Only show if user is connected
  const userAddress = address || 
    (context?.user as any)?.verified_addresses?.primary?.eth_address ||
    (context?.user as any)?.custody_address;
  
  if (!userAddress) {
    return null;
  }
  
  return (
    <Link 
      href="/notifications" 
      className="relative inline-flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 transition-colors"
      aria-label="Notifications"
    >
      <Bell className="w-5 h-5 text-gray-700" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

