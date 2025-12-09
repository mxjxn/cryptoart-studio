'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { TransitionLink } from '~/components/TransitionLink';
import { HomepageLayoutManager } from '../HomepageLayoutManager';

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
  
  // Fetch all published galleries
  const { data: galleriesData, isLoading: loadingGalleries } = useQuery({
    queryKey: ['admin', 'curation', 'all'],
    queryFn: async () => {
      // Fetch galleries from all users (admin can see all)
      const response = await fetch(`/api/curation?userAddress=${address}&publishedOnly=false`);
      if (!response.ok) return { galleries: [] };
      return response.json();
    },
    enabled: !!address,
  });

  const allGalleries = galleriesData?.galleries || [];

  const isLoading = loadingFeatured || loadingSettings;

  // Create featured section from gallery mutation
  const createSectionFromGallery = useMutation({
    mutationFn: async ({ galleryId, title, description }: { galleryId: string; title: string; description?: string }) => {
      // First get the gallery with its listings
      const galleryResponse = await fetch(`/api/curation/${galleryId}?userAddress=${address}`);
      if (!galleryResponse.ok) throw new Error('Failed to fetch gallery');
      const { gallery } = await galleryResponse.json();

      // Create a featured section
      const sectionResponse = await fetch('/api/admin/featured-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'custom',
          title: title || gallery.title,
          description: description || gallery.description || `Curated gallery: ${gallery.title}`,
          displayOrder: 0,
          isActive: true,
          adminAddress: address,
        }),
      });
      if (!sectionResponse.ok) throw new Error('Failed to create section');
      const { section } = await sectionResponse.json();

      // Add all listings from gallery to the section
      if (gallery.listings && gallery.listings.length > 0) {
        // Add each listing individually
        for (let i = 0; i < gallery.listings.length; i++) {
          const listing = gallery.listings[i];
          await fetch(`/api/admin/featured-sections/${section.id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemType: 'listing',
              itemId: listing.listingId,
              displayOrder: i,
              adminAddress: address,
            }),
          });
        }
      }

      return { section, gallery };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'featured-sections'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'curation', 'all'] });
    },
  });
  
  return (
    <div className="space-y-6 max-w-4xl">
      <HomepageLayoutManager />

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

      {/* Featured Galleries Section */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Featured Galleries</h2>
            <p className="text-sm text-[var(--color-secondary)] mt-1">
              Create featured sections from your curated galleries
            </p>
          </div>
          <TransitionLink
            href="/curate"
            className="px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-background)] font-medium hover:opacity-90 transition-opacity"
          >
            Manage Galleries →
          </TransitionLink>
        </div>

        {loadingGalleries ? (
          <p className="text-[var(--color-secondary)]">Loading galleries...</p>
        ) : allGalleries.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--color-secondary)] mb-4">No galleries yet</p>
            <TransitionLink
              href="/curate"
              className="px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-background)] font-medium hover:opacity-90 transition-opacity inline-block"
            >
              Create Your First Gallery
            </TransitionLink>
          </div>
        ) : (
          <div className="space-y-3">
            {allGalleries.map((gallery: any) => (
              <div
                key={gallery.id}
                className="flex items-center justify-between p-3 bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-medium text-[var(--color-text)]">{gallery.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      gallery.isPublished
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {gallery.isPublished ? 'Published' : 'Draft'}
                    </span>
                    <span className="text-xs text-[var(--color-secondary)]">
                      {gallery.itemCount || 0} {gallery.itemCount === 1 ? 'listing' : 'listings'}
                    </span>
                  </div>
                  {gallery.description && (
                    <p className="text-sm text-[var(--color-secondary)] line-clamp-1">{gallery.description}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <TransitionLink
                    href={`/curate/${gallery.id}`}
                    className="px-3 py-1.5 text-xs border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
                  >
                    Edit
                  </TransitionLink>
                  <button
                    onClick={() => {
                      if (confirm(`Create a featured section from "${gallery.title}"?`)) {
                        createSectionFromGallery.mutate({
                          galleryId: gallery.id,
                          title: gallery.title,
                          description: gallery.description || undefined,
                        });
                      }
                    }}
                    disabled={createSectionFromGallery.isPending || !gallery.isPublished || (gallery.itemCount || 0) === 0}
                    className="px-3 py-1.5 text-xs bg-[var(--color-primary)] text-[var(--color-background)] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createSectionFromGallery.isPending ? 'Creating...' : 'Feature on Homepage'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-[var(--color-tertiary)] mt-4">
          Click "Feature on Homepage" to create a featured section from a gallery. The section will appear on the homepage with all listings from that gallery.
        </p>
      </div>
    </div>
  );
}

