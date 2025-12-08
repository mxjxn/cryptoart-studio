'use client';

import { useNotifications } from '~/hooks/useNotifications';
import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import { Check, CheckCheck, Settings, Send, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { NotificationType } from '@cryptoart/db';
// Simple date formatting function (can be replaced with date-fns if needed)
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const NOTIFICATION_TYPES: NotificationType[] = [
  'LISTING_CREATED',
  'NEW_BID',
  'AUCTION_WON',
  'AUCTION_ENDED_NO_BIDS',
  'BUY_NOW_SALE',
  'NEW_OFFER',
  'BID_PLACED',
  'OUTBID',
  'ERC1155_PURCHASE',
  'ERC721_PURCHASE',
  'OFFER_ACCEPTED',
  'OFFER_RESCINDED',
  'LISTING_CANCELLED',
  'LISTING_MODIFIED',
  'FOLLOWED_USER_NEW_LISTING',
  'FAVORITE_LOW_STOCK',
  'FAVORITE_NEW_BID',
  'FAVORITE_ENDING_SOON',
];

export default function NotificationsClient() {
  const { address } = useAccount();
  const { context } = useMiniApp();
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead,
    preferences,
    updatePreferences,
    refresh,
  } = useNotifications();
  
  const userAddress = address || 
    (context?.user as any)?.verified_addresses?.primary?.eth_address ||
    (context?.user as any)?.custody_address;
  
  // Manual notification sending state
  const [showTestTool, setShowTestTool] = useState(false);
  const [testNotification, setTestNotification] = useState({
    type: 'LISTING_CREATED' as NotificationType,
    title: 'Test Notification',
    message: 'This is a test notification to verify the notification system is working.',
    listingId: '',
    sendPush: true,
  });
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  
  if (!userAddress) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Notifications</h1>
          <p className="text-gray-600">Please connect your wallet to view notifications</p>
        </div>
      </div>
    );
  }
  
  const handleSendTestNotification = async () => {
    if (!userAddress) return;
    
    setSending(true);
    setSendResult(null);
    
    try {
      const response = await fetch('/api/notifications/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          type: testNotification.type,
          title: testNotification.title,
          message: testNotification.message,
          listingId: testNotification.listingId || undefined,
          sendPush: testNotification.sendPush,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to send notification');
      }
      
      setSendResult({ success: true, message: 'Notification sent successfully!' });
      
      // Refresh notifications list
      await refresh();
      
      // Clear form after a short delay
      setTimeout(() => {
        setTestNotification({
          type: 'LISTING_CREATED',
          title: 'Test Notification',
          message: 'This is a test notification to verify the notification system is working.',
          listingId: '',
          sendPush: true,
        });
        setSendResult(null);
      }, 3000);
    } catch (error) {
      setSendResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send notification',
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Notifications</h1>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
          )}
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Manual Notification Testing Tool */}
      <div className="mb-6 border rounded-lg bg-gray-50">
        <button
          onClick={() => setShowTestTool(!showTestTool)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            <span className="font-semibold">Test Notification Tool</span>
            <span className="text-sm text-gray-500">(Send a test notification to yourself)</span>
          </div>
          {showTestTool ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
        
        {showTestTool && (
          <div className="p-4 border-t space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Notification Type</label>
              <select
                value={testNotification.type}
                onChange={(e) => setTestNotification({ ...testNotification, type: e.target.value as NotificationType })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {NOTIFICATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={testNotification.title}
                onChange={(e) => setTestNotification({ ...testNotification, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Notification title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea
                value={testNotification.message}
                onChange={(e) => setTestNotification({ ...testNotification, message: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Notification message"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Listing ID (optional)</label>
              <input
                type="text"
                value={testNotification.listingId}
                onChange={(e) => setTestNotification({ ...testNotification, listingId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 0x1234..."
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sendPush"
                checked={testNotification.sendPush}
                onChange={(e) => setTestNotification({ ...testNotification, sendPush: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="sendPush" className="text-sm font-medium">
                Send push notification (if enabled)
              </label>
            </div>
            
            {sendResult && (
              <div
                className={`p-3 rounded-lg ${
                  sendResult.success
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {sendResult.message}
              </div>
            )}
            
            <button
              onClick={handleSendTestNotification}
              disabled={sending || !testNotification.title || !testNotification.message}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Test Notification
                </>
              )}
            </button>
          </div>
        )}
      </div>
      
      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`
                p-4 rounded-lg border transition-colors cursor-pointer
                ${notification.read 
                  ? 'bg-white border-gray-200' 
                  : 'bg-blue-50 border-blue-200'
                }
              `}
              onClick={() => !notification.read && markAsRead(notification.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{notification.title}</h3>
                    {!notification.read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </div>
                  <p className="text-gray-700 mb-2">{notification.message}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>
                      {formatTimeAgo(new Date(notification.createdAt))}
                    </span>
                    {notification.listingId && (
                      <>
                        {notification.type === 'OUTBID' ? (
                          <Link
                            href={`/share/outbid/${notification.listingId}/view${notification.metadata?.newBidAmount ? `?currentBid=${notification.metadata.newBidAmount}` : ''}`}
                            className="text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View moment
                          </Link>
                        ) : null}
                        <Link
                          href={`/listing/${notification.listingId}`}
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View listing
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                {!notification.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                    className="p-2 hover:bg-gray-200 rounded transition-colors"
                    aria-label="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

