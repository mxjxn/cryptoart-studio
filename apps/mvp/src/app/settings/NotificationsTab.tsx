'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface NotificationSettings {
  newBidOnYourAuction: boolean;
  auctionEnding24h: boolean;
  auctionEnding1h: boolean;
  offerReceived: boolean;
  outbid: boolean;
  auctionWon: boolean;
  purchaseConfirmation: boolean;
  offerAccepted: boolean;
  offerRejected: boolean;
}

interface GlobalNotificationSettings {
  newBidOnYourAuction: boolean;
  auctionEnding24h: boolean;
  auctionEnding1h: boolean;
  offerReceived: boolean;
  outbid: boolean;
  auctionWon: boolean;
  purchaseConfirmation: boolean;
  offerAccepted: boolean;
  offerRejected: boolean;
}

const NOTIFICATION_SECTIONS = [
  {
    title: 'Your Listings',
    description: 'Notifications for sellers about their auctions',
    settings: [
      { key: 'newBidOnYourAuction', label: 'New bid received' },
      { key: 'auctionEnding24h', label: '24 hours left' },
      { key: 'auctionEnding1h', label: '1 hour left' },
      { key: 'offerReceived', label: 'Offer received' },
    ],
  },
  {
    title: 'Your Bids',
    description: 'Notifications for bidders',
    settings: [
      { key: 'outbid', label: "You've been outbid" },
      { key: 'auctionWon', label: 'Auction won' },
    ],
  },
  {
    title: 'Purchases',
    description: 'Notifications for buyers',
    settings: [
      { key: 'purchaseConfirmation', label: 'Purchase confirmation' },
    ],
  },
  {
    title: 'Offers',
    description: 'Notifications for offer activity',
    settings: [
      { key: 'offerAccepted', label: 'Offer accepted' },
      { key: 'offerRejected', label: 'Offer rejected' },
    ],
  },
];

function Toggle({ 
  checked, 
  onChange, 
  disabled 
}: { 
  checked: boolean; 
  onChange: (checked: boolean) => void; 
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center transition-colors ${
        checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform bg-[var(--color-background)] transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

interface NotificationsTabProps {
  userAddress: string;
}

export default function NotificationsTab({ userAddress }: NotificationsTabProps) {
  const queryClient = useQueryClient();
  
  // Fetch user preferences
  const { data: userPrefs, isLoading: loadingUser } = useQuery({
    queryKey: ['user', 'notification-preferences', userAddress],
    queryFn: async () => {
      const response = await fetch(`/api/user/notification-preferences?userAddress=${encodeURIComponent(userAddress)}`);
      if (!response.ok) throw new Error('Failed to fetch preferences');
      return response.json() as Promise<NotificationSettings>;
    },
    enabled: !!userAddress,
  });
  
  // Fetch global settings to know what's available
  const { data: globalSettings, isLoading: loadingGlobal } = useQuery({
    queryKey: ['global', 'notification-settings'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/global-settings');
      if (!response.ok) {
        // Return defaults if fetch fails
        return {
          newBidOnYourAuction: true,
          auctionEnding24h: true,
          auctionEnding1h: true,
          offerReceived: true,
          outbid: true,
          auctionWon: true,
          purchaseConfirmation: true,
          offerAccepted: true,
          offerRejected: true,
        } as GlobalNotificationSettings;
      }
      return response.json() as Promise<GlobalNotificationSettings>;
    },
  });
  
  const updatePreference = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const response = await fetch('/api/user/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userAddress,
          [key]: value 
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update preference');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'notification-preferences', userAddress] });
    },
  });
  
  if (loadingUser || loadingGlobal) {
    return <p className="text-[var(--color-secondary)]">Loading preferences...</p>;
  }
  
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-blue-900/20 border border-blue-500/30 p-4">
        <p className="text-sm text-blue-400">
          <strong>Note:</strong> You can customize which notifications you receive. 
          If a notification type is disabled by admin, you won't be able to enable it.
        </p>
      </div>
      
      {NOTIFICATION_SECTIONS.map((section) => (
        <div key={section.title} className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
          <h3 className="font-semibold text-[var(--color-text)]">{section.title}</h3>
          <p className="text-sm text-[var(--color-secondary)] mb-4">{section.description}</p>
          
          <div className="space-y-3">
            {section.settings.map((setting) => {
              const isGloballyDisabled = !globalSettings?.[setting.key as keyof GlobalNotificationSettings];
              const userValue = userPrefs?.[setting.key as keyof NotificationSettings] ?? true;
              
              return (
                <div key={setting.key} className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className={`text-sm ${isGloballyDisabled ? 'text-[#666666]' : 'text-[var(--color-text)]'}`}>
                      {setting.label}
                    </span>
                    {isGloballyDisabled && (
                      <p className="text-xs text-[#666666] mt-1">
                        Disabled by admin
                      </p>
                    )}
                  </div>
                  <Toggle
                    checked={userValue}
                    onChange={(checked) => 
                      updatePreference.mutate({ key: setting.key, value: checked })
                    }
                    disabled={isGloballyDisabled || updatePreference.isPending}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

