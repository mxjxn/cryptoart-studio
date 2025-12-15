'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import { useAuthMode } from '~/hooks/useAuthMode';
import NotificationsTab from './NotificationsTab';

type TabType = 'notifications';

export default function SettingsClient() {
  const { address, isConnected } = useAccount();
  const { context } = useMiniApp();
  const { isMiniApp } = useAuthMode();
  const [activeTab, setActiveTab] = useState<TabType>('notifications');
  
  // Get user address from either wallet or Farcaster mini-app
  const farcasterMiniAppAddress = context?.user
    ? (context.user as any).verified_addresses?.primary?.eth_address ||
      (context.user as any).custody_address ||
      ((context.user as any).verifications?.[0] as string)
    : null;
  
  const userAddress = address || farcasterMiniAppAddress;
  const isAuthenticated = isMiniApp ? !!context?.user : isConnected;
  
  if (!isAuthenticated || !userAddress) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-[#cccccc]">Please connect your wallet or sign in with Farcaster to view settings.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <h1 className="text-3xl font-light mb-8">Settings</h1>
        
        {/* Tab Navigation */}
        <div className="border-b border-[#333333] mb-6">
          <nav className="flex gap-6">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`pb-4 px-1 border-b-2 transition-colors ${
                activeTab === 'notifications'
                  ? 'border-white text-white'
                  : 'border-transparent text-[#999999] hover:text-white'
              }`}
            >
              Notifications
            </button>
          </nav>
        </div>
        
        {/* Tab Content */}
        <div>
          {activeTab === 'notifications' && (
            <NotificationsTab userAddress={userAddress} />
          )}
        </div>
      </div>
    </div>
  );
}







