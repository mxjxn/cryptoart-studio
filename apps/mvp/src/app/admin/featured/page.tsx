'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { TransitionLink } from '~/components/TransitionLink';
import { HomepageLayoutManager } from '../HomepageLayoutManager';

export default function FeaturedListingsPage() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  
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

