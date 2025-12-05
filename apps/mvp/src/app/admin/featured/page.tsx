'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

export default function FeaturedListingsPage() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const [newListingId, setNewListingId] = useState('');
  
  // Fetch current featured listings
  const { data: featured, isLoading: loadingFeatured } = useQuery({
    queryKey: ['admin', 'featured'],
    queryFn: () => fetch(`/api/admin/featured?adminAddress=${address}`).then(r => r.json()),
    enabled: !!address,
  });
  
  // Fetch featured settings
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['admin', 'featured-settings'],
    queryFn: () => fetch(`/api/admin/featured/settings?adminAddress=${address}`).then(r => r.json()),
    enabled: !!address,
  });
  
  // Add listing mutation
  const addListing = useMutation({
    mutationFn: (listingId: string) =>
      fetch('/api/admin/featured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, adminAddress: address }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'featured'] });
      setNewListingId('');
    },
  });
  
  // Remove listing mutation
  const removeListing = useMutation({
    mutationFn: (listingId: string) =>
      fetch(`/api/admin/featured/${listingId}?adminAddress=${address}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'featured'] }),
  });
  
  // Toggle auto mode mutation
  const toggleAutoMode = useMutation({
    mutationFn: (autoMode: boolean) =>
      fetch('/api/admin/featured/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoMode, adminAddress: address }),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'featured-settings'] }),
  });
  
  const isLoading = loadingFeatured || loadingSettings;
  
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Featured Settings */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
        <h2 className="text-lg font-semibold mb-4 text-[var(--color-text)]">Featured Settings</h2>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-[var(--color-text)]">Auto Mode</p>
            <p className="text-sm text-[var(--color-secondary)]">
              Automatically feature 5 random active listings every 24 hours
            </p>
          </div>
          <button
            onClick={() => toggleAutoMode.mutate(!settings?.autoMode)}
            disabled={isLoading || toggleAutoMode.isPending}
            className={`relative inline-flex h-6 w-11 items-center transition-colors ${
              settings?.autoMode ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
            } ${(isLoading || toggleAutoMode.isPending) ? 'opacity-50' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform bg-[var(--color-background)] transition-transform ${
                settings?.autoMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
      
      {/* Manual Featured Listings (only show when auto mode is off) */}
      {!settings?.autoMode && (
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
          <h2 className="text-lg font-semibold mb-4 text-[var(--color-text)]">Manual Featured Listings</h2>
          
          {/* Add listing input */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (newListingId.trim()) {
                addListing.mutate(newListingId.trim());
              }
            }}
            className="flex gap-2 mb-4"
          >
            <input
              type="text"
              placeholder="Listing ID"
              value={newListingId}
              onChange={(e) => setNewListingId(e.target.value)}
              className="flex-1 px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)] placeholder:text-[var(--color-secondary)]"
            />
            <button
              type="submit"
              disabled={!newListingId.trim() || addListing.isPending}
              className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-background)] font-medium disabled:opacity-50"
            >
              Add
            </button>
          </form>
          
          {/* Current featured list */}
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-[var(--color-secondary)]">Loading...</p>
            ) : featured?.listings?.length === 0 ? (
              <p className="text-[var(--color-secondary)]">No featured listings</p>
            ) : (
              featured?.listings?.map((listing: { listingId: string; displayOrder: number }) => (
                <div 
                  key={listing.listingId}
                  className="flex items-center justify-between p-3 bg-[var(--color-background)] border border-[var(--color-border)]"
                >
                  <div>
                    <p className="font-mono text-sm text-[var(--color-text)]">{listing.listingId}</p>
                    <p className="text-xs text-[var(--color-secondary)]">Order: {listing.displayOrder}</p>
                  </div>
                  <button
                    onClick={() => removeListing.mutate(listing.listingId)}
                    disabled={removeListing.isPending}
                    className="text-sm text-[var(--color-error)] hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
          
          <p className="text-xs text-[var(--color-tertiary)] mt-4">
            First item appears leftmost in carousel.
          </p>
        </div>
      )}
    </div>
  );
}

