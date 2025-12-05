'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

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

export default function NotificationsAdminPage() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'notification-settings'],
    queryFn: () => fetch(`/api/admin/notifications/settings?adminAddress=${address}`).then(r => r.json()),
    enabled: !!address,
  });
  
  const updateSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      fetch('/api/admin/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value, adminAddress: address }),
      }).then(r => r.json()),
    onSuccess: () => 
      queryClient.invalidateQueries({ queryKey: ['admin', 'notification-settings'] }),
  });
  
  if (isLoading) {
    return <p className="text-[var(--color-secondary)]">Loading settings...</p>;
  }
  
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-yellow-900/20 border border-yellow-500/30 p-4">
        <p className="text-sm text-yellow-400">
          <strong>Note:</strong> Disabling a notification type will prevent it from 
          being sent to all users, regardless of their personal preferences.
        </p>
      </div>
      
      {NOTIFICATION_SECTIONS.map((section) => (
        <div key={section.title} className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
          <h3 className="font-semibold text-[var(--color-text)]">{section.title}</h3>
          <p className="text-sm text-[var(--color-secondary)] mb-4">{section.description}</p>
          
          <div className="space-y-3">
            {section.settings.map((setting) => (
              <div key={setting.key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text)]">{setting.label}</span>
                <Toggle
                  checked={settings?.[setting.key as keyof NotificationSettings] ?? true}
                  onChange={(checked) => 
                    updateSetting.mutate({ key: setting.key, value: checked })
                  }
                  disabled={updateSetting.isPending}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

