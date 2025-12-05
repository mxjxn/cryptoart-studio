# Cryptoart.social Admin System Implementation Plan

## Overview

This document provides a comprehensive implementation plan for adding an admin system to cryptoart.social. The system includes a dedicated admin dashboard, an "admin mode" toggle for inline moderation, and various management features for auctions, users, notifications, and analytics.

**Admin Identity (Hardcoded):**
- Farcaster username: `@mxjxn`
- Wallet address: `0x6da0...` (full address to be hardcoded in constants)

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Admin Dashboard (`/admin`)](#3-admin-dashboard-admin)
4. [Admin Mode (Inline Moderation)](#4-admin-mode-inline-moderation)
5. [Featured Listings System](#5-featured-listings-system)
6. [User Hiding System](#6-user-hiding-system)
7. [Membership Revocation](#7-membership-revocation)
8. [Analytics & Stats](#8-analytics--stats)
9. [Error Logging System](#9-error-logging-system)
10. [Global Notification Controls](#10-global-notification-controls)
11. [User Notification Preferences](#11-user-notification-preferences)
12. [API Routes](#12-api-routes)
13. [Component Structure](#13-component-structure)
14. [Implementation Order](#14-implementation-order)

---

## 1. Database Schema

### New Tables

Add these tables to the `@cryptoart/db` package schema:

```typescript
// packages/db/src/schema.ts

import { pgTable, text, timestamp, boolean, integer, bigint, jsonb, uuid, pgEnum } from 'drizzle-orm/pg-core';

// ============================================
// ADMIN: Featured Listings
// ============================================

export const featuredListings = pgTable('featured_listings', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: text('listing_id').notNull().unique(), // On-chain listing ID
  displayOrder: integer('display_order').notNull().default(0), // For manual ordering
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const featuredSettings = pgTable('featured_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  autoMode: boolean('auto_mode').notNull().default(false),
  autoCount: integer('auto_count').notNull().default(5), // Number of random listings in auto mode
  lastAutoRefresh: timestamp('last_auto_refresh'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// ADMIN: Hidden Users
// ============================================

export const hiddenUsers = pgTable('hidden_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  userAddress: text('user_address').notNull().unique(), // Wallet address (lowercase)
  hiddenAt: timestamp('hidden_at').defaultNow().notNull(),
  hiddenBy: text('hidden_by').notNull(), // Admin address who hid them
});

// ============================================
// ADMIN: Analytics Snapshots
// ============================================

export const analyticsSnapshots = pgTable('analytics_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  snapshotDate: timestamp('snapshot_date').notNull(),
  periodType: text('period_type').notNull(), // 'daily', 'weekly', 'monthly', 'yearly'
  
  // Volume metrics (in wei, stored as string for precision)
  totalVolumeWei: text('total_volume_wei').notNull().default('0'),
  auctionVolumeWei: text('auction_volume_wei').notNull().default('0'),
  fixedPriceVolumeWei: text('fixed_price_volume_wei').notNull().default('0'),
  offerVolumeWei: text('offer_volume_wei').notNull().default('0'),
  
  // Fee metrics (in wei)
  platformFeesWei: text('platform_fees_wei').notNull().default('0'),
  referralFeesWei: text('referral_fees_wei').notNull().default('0'),
  
  // Count metrics
  totalSales: integer('total_sales').notNull().default(0),
  auctionSales: integer('auction_sales').notNull().default(0),
  fixedPriceSales: integer('fixed_price_sales').notNull().default(0),
  offerSales: integer('offer_sales').notNull().default(0),
  activeAuctions: integer('active_auctions').notNull().default(0),
  uniqueBidders: integer('unique_bidders').notNull().default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// ADMIN: Error Logging
// ============================================

export const errorLogTypeEnum = pgEnum('error_log_type', [
  'transaction_failed',
  'api_error',
  'subgraph_error',
  'contract_error',
  'webhook_error',
  'unknown'
]);

export const errorLogs = pgTable('error_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: errorLogTypeEnum('type').notNull(),
  message: text('message').notNull(),
  stack: text('stack'),
  
  // Context
  userAddress: text('user_address'), // If associated with a user
  listingId: text('listing_id'), // If associated with a listing
  transactionHash: text('transaction_hash'), // If associated with a tx
  endpoint: text('endpoint'), // API endpoint or function name
  
  // Additional data
  metadata: jsonb('metadata'), // Any additional context as JSON
  
  // Status
  resolved: boolean('resolved').notNull().default(false),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// ADMIN: Global Notification Settings
// ============================================

export const globalNotificationSettings = pgTable('global_notification_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Your Listings section
  newBidOnYourAuction: boolean('new_bid_on_your_auction').notNull().default(true),
  auctionEnding24h: boolean('auction_ending_24h').notNull().default(true),
  auctionEnding1h: boolean('auction_ending_1h').notNull().default(true),
  offerReceived: boolean('offer_received').notNull().default(true),
  
  // Your Bids section
  outbid: boolean('outbid').notNull().default(true),
  auctionWon: boolean('auction_won').notNull().default(true),
  
  // Purchases section
  purchaseConfirmation: boolean('purchase_confirmation').notNull().default(true),
  
  // Offers section
  offerAccepted: boolean('offer_accepted').notNull().default(true),
  offerRejected: boolean('offer_rejected').notNull().default(true),
  
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// USER: Notification Preferences
// ============================================

export const userNotificationPreferences = pgTable('user_notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userAddress: text('user_address').notNull().unique(),
  
  // Your Listings section
  newBidOnYourAuction: boolean('new_bid_on_your_auction').notNull().default(true),
  auctionEnding24h: boolean('auction_ending_24h').notNull().default(true),
  auctionEnding1h: boolean('auction_ending_1h').notNull().default(true),
  offerReceived: boolean('offer_received').notNull().default(true),
  
  // Your Bids section
  outbid: boolean('outbid').notNull().default(true),
  auctionWon: boolean('auction_won').notNull().default(true),
  
  // Purchases section
  purchaseConfirmation: boolean('purchase_confirmation').notNull().default(true),
  
  // Offers section
  offerAccepted: boolean('offer_accepted').notNull().default(true),
  offerRejected: boolean('offer_rejected').notNull().default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Migration Notes

1. Run database migrations after adding schema
2. Seed `featuredSettings` with a single row (singleton pattern)
3. Seed `globalNotificationSettings` with a single row (all defaults true)

---

## 2. Authentication & Authorization

### Constants

```typescript
// src/lib/constants.ts

// Admin configuration (hardcoded)
export const ADMIN_CONFIG = {
  // Primary admin wallet address (lowercase)
  walletAddress: '0x6da0...'.toLowerCase(), // TODO: Add full address
  
  // Primary admin Farcaster username
  farcasterUsername: 'mxjxn',
  
  // Primary admin FID (lookup and hardcode)
  fid: 0, // TODO: Add actual FID
} as const;
```

### Admin Check Hook

```typescript
// src/hooks/useIsAdmin.ts

import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import { ADMIN_CONFIG } from '~/lib/constants';

export function useIsAdmin(): boolean {
  const { address } = useAccount();
  const { user } = useMiniApp();
  
  if (!address) return false;
  
  // Check wallet address match
  const isAdminWallet = address.toLowerCase() === ADMIN_CONFIG.walletAddress;
  
  // Optionally also verify Farcaster identity
  const isAdminFarcaster = user?.username === ADMIN_CONFIG.farcasterUsername;
  
  // Require both for maximum security
  return isAdminWallet && isAdminFarcaster;
}
```

### Admin Mode State

```typescript
// src/hooks/useAdminMode.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useIsAdmin } from './useIsAdmin';

interface AdminModeState {
  isAdminModeEnabled: boolean;
  toggleAdminMode: () => void;
  setAdminMode: (enabled: boolean) => void;
}

const useAdminModeStore = create<AdminModeState>()(
  persist(
    (set) => ({
      isAdminModeEnabled: false,
      toggleAdminMode: () => set((state) => ({ isAdminModeEnabled: !state.isAdminModeEnabled })),
      setAdminMode: (enabled) => set({ isAdminModeEnabled: enabled }),
    }),
    {
      name: 'admin-mode-storage',
    }
  )
);

export function useAdminMode() {
  const isAdmin = useIsAdmin();
  const { isAdminModeEnabled, toggleAdminMode, setAdminMode } = useAdminModeStore();
  
  // Only return enabled if user is actually admin
  return {
    isAdmin,
    isAdminModeEnabled: isAdmin && isAdminModeEnabled,
    toggleAdminMode,
    setAdminMode,
  };
}
```

### Server-Side Admin Verification

```typescript
// src/lib/server/admin.ts

import { ADMIN_CONFIG } from '~/lib/constants';

export function isAdminAddress(address: string | undefined | null): boolean {
  if (!address) return false;
  return address.toLowerCase() === ADMIN_CONFIG.walletAddress;
}

// Middleware helper for API routes
export function requireAdmin(address: string | undefined | null): void {
  if (!isAdminAddress(address)) {
    throw new Error('Unauthorized: Admin access required');
  }
}
```

---

## 3. Admin Dashboard (`/admin`)

### Route Structure

```
src/app/admin/
├── page.tsx                    # Main admin dashboard (redirect to first tab)
├── layout.tsx                  # Admin layout with tabs navigation
├── AdminLayoutClient.tsx       # Client component for auth check
├── featured/
│   └── page.tsx                # Featured listings management
├── users/
│   └── page.tsx                # Hidden users management
├── membership/
│   └── page.tsx                # Membership revocation
├── stats/
│   └── page.tsx                # Analytics & statistics
├── errors/
│   └── page.tsx                # Error logs viewer
└── notifications/
    └── page.tsx                # Global notification controls
```

### Admin Layout

```typescript
// src/app/admin/layout.tsx

import { AdminLayoutClient } from './AdminLayoutClient';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
```

```typescript
// src/app/admin/AdminLayoutClient.tsx

'use client';

import { useIsAdmin } from '~/hooks/useIsAdmin';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { TransitionLink } from '~/components/TransitionLink';

const ADMIN_TABS = [
  { name: 'Featured', href: '/admin/featured' },
  { name: 'Users', href: '/admin/users' },
  { name: 'Membership', href: '/admin/membership' },
  { name: 'Stats', href: '/admin/stats' },
  { name: 'Errors', href: '/admin/errors' },
  { name: 'Notifications', href: '/admin/notifications' },
];

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const isAdmin = useIsAdmin();
  const router = useRouter();
  
  useEffect(() => {
    if (!isAdmin) {
      router.replace('/');
    }
  }, [isAdmin, router]);
  
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Unauthorized</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold">Admin Dashboard</h1>
        </div>
        
        {/* Tab Navigation - Horizontal scroll on mobile */}
        <nav className="flex overflow-x-auto px-4 -mb-px">
          {ADMIN_TABS.map((tab) => (
            <TransitionLink
              key={tab.href}
              href={tab.href}
              className="flex-shrink-0 px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:border-gray-300 whitespace-nowrap"
              activeClassName="border-black text-black"
            >
              {tab.name}
            </TransitionLink>
          ))}
        </nav>
      </header>
      
      {/* Content */}
      <main className="p-4">
        {children}
      </main>
    </div>
  );
}
```

---

## 4. Admin Mode (Inline Moderation)

### Profile Dropdown Addition

Add admin mode toggle to `ProfileDropdown.tsx`:

```typescript
// In ProfileDropdown.tsx, add to menu items (only visible to admin):

const { isAdmin, isAdminModeEnabled, toggleAdminMode } = useAdminMode();

// In the dropdown menu, add:
{isAdmin && (
  <>
    <DropdownSeparator />
    <DropdownItem onClick={toggleAdminMode}>
      <div className="flex items-center justify-between w-full">
        <span>Admin Mode</span>
        <Toggle checked={isAdminModeEnabled} />
      </div>
    </DropdownItem>
    <DropdownItem asChild>
      <TransitionLink href="/admin">
        Admin Dashboard
      </TransitionLink>
    </DropdownItem>
  </>
)}
```

### Admin Context Menu Component

```typescript
// src/components/AdminContextMenu.tsx

'use client';

import { useState } from 'react';
import { useAdminMode } from '~/hooks/useAdminMode';
import { MoreVertical } from 'lucide-react';

interface AdminContextMenuProps {
  listingId?: string;
  sellerAddress?: string;
  onHideUser?: (address: string) => void;
}

export function AdminContextMenu({ 
  listingId, 
  sellerAddress,
  onHideUser 
}: AdminContextMenuProps) {
  const { isAdminModeEnabled } = useAdminMode();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState<string | null>(null);
  
  if (!isAdminModeEnabled) return null;
  
  const handleHideUser = async () => {
    if (!sellerAddress) return;
    
    try {
      const response = await fetch('/api/admin/users/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: sellerAddress }),
      });
      
      if (response.ok) {
        onHideUser?.(sellerAddress);
        setShowConfirmation(null);
        setIsOpen(false);
      }
    } catch (error) {
      console.error('[AdminContextMenu] Error hiding user:', error);
    }
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded hover:bg-gray-100"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-[160px]">
          <button
            onClick={() => setShowConfirmation('hideUser')}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600"
          >
            Hide User
          </button>
        </div>
      )}
      
      {/* Confirmation Modal */}
      {showConfirmation === 'hideUser' && (
        <ConfirmationModal
          title="Hide User"
          message={`Are you sure you want to hide all listings from ${sellerAddress}? Their listings will no longer appear in the algorithm.`}
          confirmLabel="Hide User"
          confirmVariant="destructive"
          onConfirm={handleHideUser}
          onCancel={() => setShowConfirmation(null)}
        />
      )}
    </div>
  );
}
```

### Hidden Item Visual Indicator

```typescript
// src/components/HiddenIndicator.tsx

'use client';

import { useAdminMode } from '~/hooks/useAdminMode';

interface HiddenIndicatorProps {
  isHidden: boolean;
  children: React.ReactNode;
}

export function HiddenIndicator({ isHidden, children }: HiddenIndicatorProps) {
  const { isAdminModeEnabled } = useAdminMode();
  
  if (!isAdminModeEnabled || !isHidden) {
    return <>{children}</>;
  }
  
  return (
    <div className="relative">
      <div className="ring-2 ring-red-500 rounded-lg overflow-hidden">
        {children}
      </div>
      <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded font-medium">
        HIDDEN
      </div>
    </div>
  );
}
```

---

## 5. Featured Listings System

### Featured Settings Component

```typescript
// src/app/admin/featured/page.tsx

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function FeaturedListingsPage() {
  const queryClient = useQueryClient();
  
  // Fetch current featured listings
  const { data: featured, isLoading } = useQuery({
    queryKey: ['admin', 'featured'],
    queryFn: () => fetch('/api/admin/featured').then(r => r.json()),
  });
  
  // Fetch featured settings
  const { data: settings } = useQuery({
    queryKey: ['admin', 'featured-settings'],
    queryFn: () => fetch('/api/admin/featured/settings').then(r => r.json()),
  });
  
  // Add listing mutation
  const addListing = useMutation({
    mutationFn: (listingId: string) =>
      fetch('/api/admin/featured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'featured'] }),
  });
  
  // Remove listing mutation
  const removeListing = useMutation({
    mutationFn: (listingId: string) =>
      fetch(`/api/admin/featured/${listingId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'featured'] }),
  });
  
  // Toggle auto mode mutation
  const toggleAutoMode = useMutation({
    mutationFn: (autoMode: boolean) =>
      fetch('/api/admin/featured/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoMode }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'featured-settings'] }),
  });
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-4 border">
        <h2 className="text-lg font-semibold mb-4">Featured Settings</h2>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Auto Mode</p>
            <p className="text-sm text-gray-500">
              Automatically feature 5 random active listings every 24 hours
            </p>
          </div>
          <Toggle
            checked={settings?.autoMode ?? false}
            onChange={(checked) => toggleAutoMode.mutate(checked)}
          />
        </div>
      </div>
      
      {!settings?.autoMode && (
        <div className="bg-white rounded-lg p-4 border">
          <h2 className="text-lg font-semibold mb-4">Manual Featured Listings</h2>
          
          {/* Add listing input */}
          <AddListingForm onAdd={(id) => addListing.mutate(id)} />
          
          {/* Current featured list */}
          <div className="mt-4 space-y-2">
            {featured?.listings?.map((listing: any) => (
              <FeaturedListingItem
                key={listing.listingId}
                listing={listing}
                onRemove={() => removeListing.mutate(listing.listingId)}
              />
            ))}
          </div>
          
          {/* Drag to reorder hint */}
          <p className="text-xs text-gray-400 mt-4">
            Drag items to reorder. First item appears leftmost in carousel.
          </p>
        </div>
      )}
    </div>
  );
}
```

### Homepage Carousel Integration

```typescript
// src/components/FeaturedCarousel.tsx

'use client';

import { useQuery } from '@tanstack/react-query';
import { AuctionCard } from './AuctionCard';

export function FeaturedCarousel() {
  const { data, isLoading } = useQuery({
    queryKey: ['featured-listings'],
    queryFn: () => fetch('/api/featured').then(r => r.json()),
  });
  
  if (isLoading || !data?.listings?.length) return null;
  
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4">Featured</h2>
      <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 snap-x snap-mandatory">
        {data.listings.map((listing: any) => (
          <div 
            key={listing.listingId} 
            className="flex-shrink-0 w-[280px] snap-start"
          >
            <AuctionCard auction={listing} />
          </div>
        ))}
      </div>
    </section>
  );
}
```

### Auto-Refresh Cron Job

```typescript
// src/app/api/cron/featured-refresh/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '~/lib/server/db';
import { featuredListings, featuredSettings } from '@cryptoart/db';
import { eq } from 'drizzle-orm';

// This endpoint should be called by a Vercel cron job every hour
// vercel.json: { "crons": [{ "path": "/api/cron/featured-refresh", "schedule": "0 * * * *" }] }

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const db = getDatabase();
  
  // Get settings
  const [settings] = await db.select().from(featuredSettings).limit(1);
  
  if (!settings?.autoMode) {
    return NextResponse.json({ message: 'Auto mode disabled' });
  }
  
  // Check if 24 hours have passed since last refresh
  const now = new Date();
  const lastRefresh = settings.lastAutoRefresh;
  const hoursSinceRefresh = lastRefresh 
    ? (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60) 
    : 999;
  
  if (hoursSinceRefresh < 24) {
    return NextResponse.json({ message: 'Not yet time to refresh' });
  }
  
  // Fetch random active listings from subgraph
  const activeListings = await fetchActiveListingsFromSubgraph();
  const randomListings = shuffleArray(activeListings).slice(0, settings.autoCount);
  
  // Clear and replace featured listings
  await db.delete(featuredListings);
  
  for (let i = 0; i < randomListings.length; i++) {
    await db.insert(featuredListings).values({
      listingId: randomListings[i].id,
      displayOrder: i,
    });
  }
  
  // Update last refresh time
  await db
    .update(featuredSettings)
    .set({ lastAutoRefresh: now })
    .where(eq(featuredSettings.id, settings.id));
  
  return NextResponse.json({ 
    message: 'Featured listings refreshed',
    count: randomListings.length 
  });
}
```

---

## 6. User Hiding System

### Admin Users Page

```typescript
// src/app/admin/users/page.tsx

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatAddress } from '~/lib/utils';

export default function HiddenUsersPage() {
  const queryClient = useQueryClient();
  const [newAddress, setNewAddress] = useState('');
  
  const { data: hiddenUsers, isLoading } = useQuery({
    queryKey: ['admin', 'hidden-users'],
    queryFn: () => fetch('/api/admin/users/hidden').then(r => r.json()),
  });
  
  const hideUser = useMutation({
    mutationFn: (userAddress: string) =>
      fetch('/api/admin/users/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hidden-users'] });
      setNewAddress('');
    },
  });
  
  const unhideUser = useMutation({
    mutationFn: (userAddress: string) =>
      fetch('/api/admin/users/unhide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hidden-users'] });
    },
  });
  
  return (
    <div className="space-y-6">
      {/* Add user to hide */}
      <div className="bg-white rounded-lg p-4 border">
        <h2 className="text-lg font-semibold mb-4">Hide User</h2>
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (newAddress) hideUser.mutate(newAddress);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Wallet address (0x...)"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-lg"
          />
          <button
            type="submit"
            disabled={!newAddress || hideUser.isPending}
            className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
          >
            Hide
          </button>
        </form>
        <p className="text-sm text-gray-500 mt-2">
          Hidden users' listings won't appear in algorithms or discovery feeds.
        </p>
      </div>
      
      {/* Hidden users list */}
      <div className="bg-white rounded-lg p-4 border">
        <h2 className="text-lg font-semibold mb-4">
          Hidden Users ({hiddenUsers?.users?.length ?? 0})
        </h2>
        
        {isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : hiddenUsers?.users?.length === 0 ? (
          <p className="text-gray-500">No hidden users</p>
        ) : (
          <div className="space-y-2">
            {hiddenUsers?.users?.map((user: any) => (
              <div 
                key={user.userAddress}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-mono text-sm">{formatAddress(user.userAddress)}</p>
                  <p className="text-xs text-gray-500">
                    Hidden {new Date(user.hiddenAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => unhideUser.mutate(user.userAddress)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Unhide
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Filtering Hidden Users in Queries

Modify all subgraph/database queries that return listings to filter out hidden users:

```typescript
// src/lib/server/auction.ts

import { getDatabase } from './db';
import { hiddenUsers } from '@cryptoart/db';

async function getHiddenUserAddresses(): Promise<Set<string>> {
  const db = getDatabase();
  if (!db) return new Set();
  
  const hidden = await db.select({ address: hiddenUsers.userAddress }).from(hiddenUsers);
  return new Set(hidden.map(h => h.address.toLowerCase()));
}

export async function getCachedActiveAuctions(
  first: number,
  skip: number,
  enrich: boolean = false
) {
  const auctions = await fetchActiveAuctionsFromSubgraph(first, skip);
  
  // Filter out hidden users
  const hiddenAddresses = await getHiddenUserAddresses();
  const filteredAuctions = auctions.filter(
    (auction) => !hiddenAddresses.has(auction.seller.toLowerCase())
  );
  
  if (enrich) {
    return enrichAuctions(filteredAuctions);
  }
  
  return filteredAuctions;
}
```

**Important**: Hidden user filtering should be applied to:
- Homepage active auctions
- Recently concluded auctions
- Recent artists list
- Recent bidders list
- Recent collectors list
- Search results
- Any "discover" or algorithmic feeds

**NOT filtered** (per requirements):
- Direct listing page access (`/auction/[listingId]`)
- Seller's own profile view
- Active bids section for users who have bid on hidden listings

---

## 7. Membership Revocation

### Membership Admin Page

```typescript
// src/app/admin/membership/page.tsx

'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STP_V2_ADDRESS, STP_V2_ABI } from '~/lib/contracts/stp-v2';

export default function MembershipPage() {
  const [addressToRevoke, setAddressToRevoke] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  
  const handleRevoke = () => {
    writeContract({
      address: STP_V2_ADDRESS,
      abi: STP_V2_ABI,
      functionName: 'revokeSubscription', // TODO: Confirm actual function name
      args: [addressToRevoke],
    });
    setShowConfirmation(false);
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-4 border">
        <h2 className="text-lg font-semibold mb-4">Revoke Membership</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Wallet Address
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={addressToRevoke}
              onChange={(e) => setAddressToRevoke(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!addressToRevoke || isPending || isConfirming}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
          >
            {isPending || isConfirming ? 'Processing...' : 'Revoke Membership'}
          </button>
          
          {isSuccess && (
            <p className="text-green-600 text-sm">
              Membership successfully revoked!
            </p>
          )}
          
          {error && (
            <p className="text-red-600 text-sm">
              Error: {error.message}
            </p>
          )}
        </div>
        
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Warning:</strong> This is an on-chain action that permanently 
            revokes the user's membership NFT. This cannot be undone.
          </p>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      {showConfirmation && (
        <ConfirmationModal
          title="Confirm Membership Revocation"
          message={`Are you sure you want to revoke membership for ${addressToRevoke}? This is an on-chain action and cannot be undone.`}
          confirmLabel="Yes, Revoke"
          confirmVariant="destructive"
          onConfirm={handleRevoke}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
    </div>
  );
}
```

### STP v2 Contract Integration

```typescript
// src/lib/contracts/stp-v2.ts

export const STP_V2_ADDRESS = '0x...' as const; // TODO: Add actual address

export const STP_V2_ABI = [
  // TODO: Add actual ABI for revokeSubscription function
  // Example:
  {
    name: 'revokeSubscription',
    type: 'function',
    inputs: [{ name: 'subscriber', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;
```

---

## 8. Analytics & Stats

### Stats Dashboard Page

```typescript
// src/app/admin/stats/page.tsx

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatEther } from 'viem';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function StatsPage() {
  const [period, setPeriod] = useState<Period>('daily');
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats', period],
    queryFn: () => fetch(`/api/admin/stats?period=${period}`).then(r => r.json()),
  });
  
  const { data: ethPrice } = useQuery({
    queryKey: ['eth-price'],
    queryFn: () => fetch('/api/eth-price').then(r => r.json()),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const formatUsd = (weiString: string) => {
    if (!ethPrice?.usd) return '—';
    const eth = parseFloat(formatEther(BigInt(weiString)));
    return `$${(eth * ethPrice.usd).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };
  
  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {(['daily', 'weekly', 'monthly', 'yearly'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              period === p 
                ? 'bg-black text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      
      {isLoading ? (
        <p className="text-gray-500">Loading stats...</p>
      ) : (
        <>
          {/* Volume Stats */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              title="Total Volume"
              value={`${formatEther(BigInt(stats?.totalVolumeWei ?? '0'))} ETH`}
              subtitle={formatUsd(stats?.totalVolumeWei ?? '0')}
            />
            <StatCard
              title="Platform Fees"
              value={`${formatEther(BigInt(stats?.platformFeesWei ?? '0'))} ETH`}
              subtitle={formatUsd(stats?.platformFeesWei ?? '0')}
            />
            <StatCard
              title="Referral Fees"
              value={`${formatEther(BigInt(stats?.referralFeesWei ?? '0'))} ETH`}
              subtitle={formatUsd(stats?.referralFeesWei ?? '0')}
            />
          </div>
          
          {/* Sales Breakdown */}
          <div className="bg-white rounded-lg p-4 border">
            <h3 className="text-lg font-semibold mb-4">Sales Breakdown</h3>
            <div className="grid grid-cols-2 gap-4">
              <StatRow label="Total Sales" value={stats?.totalSales ?? 0} />
              <StatRow label="Auction Sales" value={stats?.auctionSales ?? 0} />
              <StatRow label="Fixed Price Sales" value={stats?.fixedPriceSales ?? 0} />
              <StatRow label="Accepted Offers" value={stats?.offerSales ?? 0} />
            </div>
          </div>
          
          {/* Activity Stats */}
          <div className="bg-white rounded-lg p-4 border">
            <h3 className="text-lg font-semibold mb-4">Activity</h3>
            <div className="grid grid-cols-2 gap-4">
              <StatRow label="Active Auctions" value={stats?.activeAuctions ?? 0} />
              <StatRow label="Unique Bidders" value={stats?.uniqueBidders ?? 0} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="bg-white rounded-lg p-4 border">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium">{value.toLocaleString()}</span>
    </div>
  );
}
```

### ETH Price API

```typescript
// src/app/api/eth-price/route.ts

import { NextResponse } from 'next/server';

// Cache ETH price for 5 minutes
let cachedPrice: { usd: number; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000;

export async function GET() {
  const now = Date.now();
  
  if (cachedPrice && now - cachedPrice.timestamp < CACHE_DURATION) {
    return NextResponse.json({ usd: cachedPrice.usd });
  }
  
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );
    const data = await response.json();
    const usd = data.ethereum.usd;
    
    cachedPrice = { usd, timestamp: now };
    
    return NextResponse.json({ usd });
  } catch (error) {
    console.error('[ETH Price] Error fetching:', error);
    return NextResponse.json({ usd: cachedPrice?.usd ?? null });
  }
}
```

### Stats Calculation Cron Job

```typescript
// src/app/api/cron/calculate-stats/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '~/lib/server/db';
import { analyticsSnapshots } from '@cryptoart/db';

// Run daily at midnight UTC
// vercel.json: { "crons": [{ "path": "/api/cron/calculate-stats", "schedule": "0 0 * * *" }] }

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const db = getDatabase();
  const now = new Date();
  
  // Calculate stats from subgraph for each period
  const periods = ['daily', 'weekly', 'monthly', 'yearly'] as const;
  
  for (const period of periods) {
    const startDate = getStartDateForPeriod(period, now);
    const stats = await calculateStatsFromSubgraph(startDate, now);
    
    await db.insert(analyticsSnapshots).values({
      snapshotDate: now,
      periodType: period,
      ...stats,
    });
  }
  
  return NextResponse.json({ message: 'Stats calculated' });
}

function getStartDateForPeriod(period: string, now: Date): Date {
  const start = new Date(now);
  switch (period) {
    case 'daily':
      start.setDate(start.getDate() - 1);
      break;
    case 'weekly':
      start.setDate(start.getDate() - 7);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'yearly':
      start.setFullYear(start.getFullYear() - 1);
      break;
  }
  return start;
}

async function calculateStatsFromSubgraph(startDate: Date, endDate: Date) {
  // TODO: Implement subgraph query to calculate:
  // - Total volume (sum of all sale amounts)
  // - Platform fees (calculated from fee percentage)
  // - Referral fees (from referral data)
  // - Sales counts by type
  // - Active auctions count
  // - Unique bidders count
  
  return {
    totalVolumeWei: '0',
    auctionVolumeWei: '0',
    fixedPriceVolumeWei: '0',
    offerVolumeWei: '0',
    platformFeesWei: '0',
    referralFeesWei: '0',
    totalSales: 0,
    auctionSales: 0,
    fixedPriceSales: 0,
    offerSales: 0,
    activeAuctions: 0,
    uniqueBidders: 0,
  };
}
```

---

## 9. Error Logging System

### Error Logger Utility

```typescript
// src/lib/server/error-logger.ts

import { getDatabase } from './db';
import { errorLogs, errorLogTypeEnum } from '@cryptoart/db';

type ErrorLogType = typeof errorLogTypeEnum.enumValues[number];

interface LogErrorOptions {
  type: ErrorLogType;
  message: string;
  stack?: string;
  userAddress?: string;
  listingId?: string;
  transactionHash?: string;
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

export async function logError(options: LogErrorOptions): Promise<void> {
  try {
    const db = getDatabase();
    if (!db) {
      console.error('[ErrorLogger] No database connection, logging to console:', options);
      return;
    }
    
    await db.insert(errorLogs).values(options);
  } catch (error) {
    // Don't throw from error logger - just log to console
    console.error('[ErrorLogger] Failed to log error:', error, options);
  }
}

// Convenience functions
export const logTransactionError = (message: string, opts?: Partial<LogErrorOptions>) =>
  logError({ type: 'transaction_failed', message, ...opts });

export const logApiError = (message: string, opts?: Partial<LogErrorOptions>) =>
  logError({ type: 'api_error', message, ...opts });

export const logSubgraphError = (message: string, opts?: Partial<LogErrorOptions>) =>
  logError({ type: 'subgraph_error', message, ...opts });

export const logContractError = (message: string, opts?: Partial<LogErrorOptions>) =>
  logError({ type: 'contract_error', message, ...opts });

export const logWebhookError = (message: string, opts?: Partial<LogErrorOptions>) =>
  logError({ type: 'webhook_error', message, ...opts });
```

### Error Dashboard Page

```typescript
// src/app/admin/errors/page.tsx

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type ErrorType = 'all' | 'transaction_failed' | 'api_error' | 'subgraph_error' | 'contract_error' | 'webhook_error';
type StatusFilter = 'all' | 'unresolved' | 'resolved';

export default function ErrorsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<ErrorType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unresolved');
  
  const { data: errors, isLoading } = useQuery({
    queryKey: ['admin', 'errors', typeFilter, statusFilter],
    queryFn: () => 
      fetch(`/api/admin/errors?type=${typeFilter}&status=${statusFilter}`)
        .then(r => r.json()),
  });
  
  const resolveError = useMutation({
    mutationFn: (errorId: string) =>
      fetch(`/api/admin/errors/${errorId}/resolve`, { method: 'POST' }),
    onSuccess: () => 
      queryClient.invalidateQueries({ queryKey: ['admin', 'errors'] }),
  });
  
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ErrorType)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="all">All Types</option>
          <option value="transaction_failed">Transaction Failed</option>
          <option value="api_error">API Error</option>
          <option value="subgraph_error">Subgraph Error</option>
          <option value="contract_error">Contract Error</option>
          <option value="webhook_error">Webhook Error</option>
        </select>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
      </div>
      
      {/* Error Count */}
      <div className="text-sm text-gray-500">
        {errors?.total ?? 0} error{errors?.total !== 1 ? 's' : ''} found
      </div>
      
      {/* Error List */}
      {isLoading ? (
        <p className="text-gray-500">Loading errors...</p>
      ) : errors?.errors?.length === 0 ? (
        <p className="text-gray-500">No errors found</p>
      ) : (
        <div className="space-y-4">
          {errors?.errors?.map((error: any) => (
            <ErrorCard
              key={error.id}
              error={error}
              onResolve={() => resolveError.mutate(error.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorCard({ error, onResolve }: { error: any; onResolve: () => void }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`bg-white rounded-lg border p-4 ${error.resolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded font-medium ${
              error.type === 'transaction_failed' ? 'bg-red-100 text-red-700' :
              error.type === 'api_error' ? 'bg-orange-100 text-orange-700' :
              error.type === 'subgraph_error' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {error.type.replace('_', ' ')}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(error.createdAt).toLocaleString()}
            </span>
          </div>
          
          <p className="mt-2 font-medium">{error.message}</p>
          
          {error.endpoint && (
            <p className="text-sm text-gray-500 mt-1">
              Endpoint: {error.endpoint}
            </p>
          )}
          
          {error.transactionHash && (
            <p className="text-sm text-gray-500 mt-1 font-mono">
              Tx: {error.transactionHash.slice(0, 10)}...
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!error.resolved && (
            <button
              onClick={onResolve}
              className="text-sm text-green-600 hover:underline"
            >
              Resolve
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-gray-500 hover:underline"
          >
            {expanded ? 'Less' : 'More'}
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t">
          {error.stack && (
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
              {error.stack}
            </pre>
          )}
          {error.metadata && (
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto mt-2">
              {JSON.stringify(error.metadata, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 10. Global Notification Controls

### Notification Admin Page

```typescript
// src/app/admin/notifications/page.tsx

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface NotificationSettings {
  // Your Listings
  newBidOnYourAuction: boolean;
  auctionEnding24h: boolean;
  auctionEnding1h: boolean;
  offerReceived: boolean;
  
  // Your Bids
  outbid: boolean;
  auctionWon: boolean;
  
  // Purchases
  purchaseConfirmation: boolean;
  
  // Offers
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
      { key: 'outbid', label: 'You\'ve been outbid' },
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

export default function NotificationsAdminPage() {
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'notification-settings'],
    queryFn: () => fetch('/api/admin/notifications/settings').then(r => r.json()),
  });
  
  const updateSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      fetch('/api/admin/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      }),
    onSuccess: () => 
      queryClient.invalidateQueries({ queryKey: ['admin', 'notification-settings'] }),
  });
  
  if (isLoading) {
    return <p className="text-gray-500">Loading settings...</p>;
  }
  
  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> Disabling a notification type will prevent it from 
          being sent to all users, regardless of their personal preferences.
        </p>
      </div>
      
      {NOTIFICATION_SECTIONS.map((section) => (
        <div key={section.title} className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold">{section.title}</h3>
          <p className="text-sm text-gray-500 mb-4">{section.description}</p>
          
          <div className="space-y-3">
            {section.settings.map((setting) => (
              <div key={setting.key} className="flex items-center justify-between">
                <span className="text-sm">{setting.label}</span>
                <Toggle
                  checked={settings?.[setting.key] ?? true}
                  onChange={(checked) => 
                    updateSetting.mutate({ key: setting.key, value: checked })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 11. User Notification Preferences

### User Preferences Page

Create a new page for users to manage their notification preferences:

```typescript
// src/app/settings/notifications/page.tsx

'use client';

import { useAccount } from 'wagmi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Same NOTIFICATION_SECTIONS structure as admin page
// but filtered by what's globally enabled

export default function UserNotificationPreferencesPage() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  
  // Fetch user's preferences
  const { data: userPrefs, isLoading: loadingUser } = useQuery({
    queryKey: ['user', 'notification-preferences', address],
    queryFn: () => 
      fetch(`/api/user/notification-preferences?address=${address}`).then(r => r.json()),
    enabled: !!address,
  });
  
  // Fetch global settings to know what's available
  const { data: globalSettings, isLoading: loadingGlobal } = useQuery({
    queryKey: ['global', 'notification-settings'],
    queryFn: () => fetch('/api/notifications/global-settings').then(r => r.json()),
  });
  
  const updatePreference = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      fetch('/api/user/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, [key]: value }),
      }),
    onSuccess: () => 
      queryClient.invalidateQueries({ queryKey: ['user', 'notification-preferences'] }),
  });
  
  if (loadingUser || loadingGlobal) {
    return <p className="text-gray-500">Loading preferences...</p>;
  }
  
  return (
    <div className="space-y-6 p-4">
      <h1 className="text-xl font-semibold">Notification Preferences</h1>
      
      {NOTIFICATION_SECTIONS.map((section) => (
        <div key={section.title} className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold">{section.title}</h3>
          
          <div className="space-y-3 mt-4">
            {section.settings.map((setting) => {
              const isGloballyDisabled = !globalSettings?.[setting.key];
              
              return (
                <div key={setting.key} className="flex items-center justify-between">
                  <span className={`text-sm ${isGloballyDisabled ? 'text-gray-400' : ''}`}>
                    {setting.label}
                    {isGloballyDisabled && (
                      <span className="text-xs text-gray-400 ml-2">(disabled by admin)</span>
                    )}
                  </span>
                  <Toggle
                    checked={userPrefs?.[setting.key] ?? true}
                    onChange={(checked) => 
                      updatePreference.mutate({ key: setting.key, value: checked })
                    }
                    disabled={isGloballyDisabled}
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
```

### Notification Service Integration

Modify the notification sending service to check both global and user preferences:

```typescript
// src/lib/server/notifications.ts

import { getDatabase } from './db';
import { globalNotificationSettings, userNotificationPreferences } from '@cryptoart/db';
import { eq } from 'drizzle-orm';

type NotificationType = 
  | 'newBidOnYourAuction'
  | 'auctionEnding24h'
  | 'auctionEnding1h'
  | 'offerReceived'
  | 'outbid'
  | 'auctionWon'
  | 'purchaseConfirmation'
  | 'offerAccepted'
  | 'offerRejected';

export async function shouldSendNotification(
  type: NotificationType,
  userAddress: string
): Promise<boolean> {
  const db = getDatabase();
  if (!db) return true; // Default to sending if no DB
  
  // Check global setting
  const [globalSettings] = await db
    .select()
    .from(globalNotificationSettings)
    .limit(1);
  
  if (globalSettings && !globalSettings[type]) {
    return false; // Globally disabled
  }
  
  // Check user preference
  const [userPrefs] = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userAddress, userAddress.toLowerCase()))
    .limit(1);
  
  if (userPrefs && !userPrefs[type]) {
    return false; // User disabled
  }
  
  return true;
}

export async function sendNotification(
  type: NotificationType,
  userAddress: string,
  data: NotificationData
): Promise<void> {
  const shouldSend = await shouldSendNotification(type, userAddress);
  
  if (!shouldSend) {
    console.log(`[Notifications] Skipping ${type} for ${userAddress} (disabled)`);
    return;
  }
  
  // Proceed with sending notification
  // ... existing notification logic
}
```

---

## 12. API Routes

### Complete API Route List

```
Admin Routes (require admin auth):
├── GET    /api/admin/featured              # Get featured listings
├── POST   /api/admin/featured              # Add featured listing
├── DELETE /api/admin/featured/[id]         # Remove featured listing
├── PATCH  /api/admin/featured/reorder      # Reorder featured listings
├── GET    /api/admin/featured/settings     # Get featured settings
├── PATCH  /api/admin/featured/settings     # Update featured settings

├── GET    /api/admin/users/hidden          # Get hidden users list
├── POST   /api/admin/users/hide            # Hide a user
├── POST   /api/admin/users/unhide          # Unhide a user

├── GET    /api/admin/stats                 # Get analytics stats
├── GET    /api/admin/errors                # Get error logs
├── POST   /api/admin/errors/[id]/resolve   # Mark error as resolved

├── GET    /api/admin/notifications/settings    # Get global notification settings
├── PATCH  /api/admin/notifications/settings    # Update global notification settings

Public Routes:
├── GET    /api/featured                    # Get featured listings (public)
├── GET    /api/eth-price                   # Get current ETH price

User Routes (require auth):
├── GET    /api/user/notification-preferences       # Get user's notification prefs
├── PATCH  /api/user/notification-preferences       # Update user's notification prefs
├── GET    /api/notifications/global-settings       # Get global settings (public read)

Cron Routes (require cron secret):
├── GET    /api/cron/featured-refresh       # Auto-refresh featured listings
├── GET    /api/cron/calculate-stats        # Calculate analytics snapshots
```

### Example Admin API Route

```typescript
// src/app/api/admin/users/hide/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '~/lib/server/db';
import { hiddenUsers } from '@cryptoart/db';
import { requireAdmin } from '~/lib/server/admin';

export async function POST(req: NextRequest) {
  try {
    const { userAddress, adminAddress } = await req.json();
    
    // Verify admin
    requireAdmin(adminAddress);
    
    const db = getDatabase();
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }
    
    await db.insert(hiddenUsers).values({
      userAddress: userAddress.toLowerCase(),
      hiddenBy: adminAddress.toLowerCase(),
    }).onConflictDoNothing();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Error hiding user:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 403 : 500 }
    );
  }
}
```

---

## 13. Component Structure

### New Components to Create

```
src/components/
├── admin/
│   ├── AdminContextMenu.tsx      # Three-dots menu for inline moderation
│   ├── ConfirmationModal.tsx     # Reusable confirmation modal
│   ├── StatCard.tsx              # Stats display card
│   ├── ErrorCard.tsx             # Error log display card
│   ├── FeaturedListingItem.tsx   # Featured listing row item
│   ├── HiddenUserItem.tsx        # Hidden user row item
│   └── Toggle.tsx                # Toggle switch component
├── HiddenIndicator.tsx           # Red border wrapper for hidden items
└── FeaturedCarousel.tsx          # Homepage featured carousel
```

### Shared Component: Toggle

```typescript
// src/components/admin/Toggle.tsx

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
        ${checked ? 'bg-black' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full bg-white transition-transform
          ${checked ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  );
}
```

### Shared Component: Confirmation Modal

```typescript
// src/components/admin/ConfirmationModal.tsx

interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  title,
  message,
  confirmLabel,
  confirmVariant = 'default',
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg text-white ${
              confirmVariant === 'destructive' 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-black hover:bg-gray-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 14. Implementation Order

### Phase 1: Foundation (Week 1)
1. **Database schema** - Add all new tables
2. **Admin auth** - `useIsAdmin` hook, `useAdminMode` hook, constants
3. **Admin layout** - Basic `/admin` route with tab navigation
4. **Error logging** - `logError` utility, error table, basic API

### Phase 2: Core Admin Features (Week 2)
5. **Hidden users system**
   - Database operations
   - API routes (`/api/admin/users/*`)
   - Admin users page
   - Filter integration in existing queries
6. **Admin mode**
   - Profile dropdown toggle
   - `AdminContextMenu` component
   - `HiddenIndicator` component

### Phase 3: Featured System (Week 3)
7. **Featured listings**
   - Database operations
   - API routes (`/api/admin/featured/*`)
   - Admin featured page
   - `FeaturedCarousel` component
   - Homepage integration
8. **Auto-refresh cron job**

### Phase 4: Analytics & Monitoring (Week 4)
9. **Stats system**
   - Stats calculation logic
   - Cron job for snapshots
   - ETH price API
   - Admin stats page
10. **Error dashboard**
    - API routes for errors
    - Admin errors page
    - Integration with error logger

### Phase 5: Notifications (Week 5)
11. **Global notification controls**
    - Database singleton
    - API routes
    - Admin notifications page
12. **User notification preferences**
    - User preferences table
    - API routes
    - User settings page
    - Notification service integration

### Phase 6: Membership & Polish (Week 6)
13. **Membership revocation**
    - STP v2 contract integration
    - Admin membership page
14. **Testing & refinement**
    - Mobile responsiveness
    - Edge cases
    - Performance optimization

---

## Security Considerations

1. **Admin Verification**: Always verify admin status on both client and server
2. **API Protection**: All `/api/admin/*` routes must verify admin address
3. **Cron Protection**: Cron routes must verify `CRON_SECRET`
4. **Input Validation**: Validate all addresses are valid Ethereum addresses
5. **Rate Limiting**: Consider rate limiting admin actions to prevent abuse
6. **Audit Logging**: Log all admin actions for accountability (optional enhancement)

---

## Environment Variables to Add

```bash
# Existing
NEXT_PUBLIC_URL=
NEXT_PUBLIC_MARKETPLACE_ADDRESS=
NEXT_PUBLIC_CHAIN_ID=
NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL=
NEYNAR_API_KEY=
STORAGE_POSTGRES_URL=

# New
CRON_SECRET=                        # Secret for cron job authentication
NEXT_PUBLIC_STP_V2_ADDRESS=         # Hypersub STP v2 contract address
```

---

## Vercel Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/featured-refresh",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/calculate-stats",
      "schedule": "0 0 * * *"
    }
  ]
}
```

---

*This plan should be updated as requirements evolve. Generated: December 2024*
