'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { TransitionLink } from '~/components/TransitionLink';
import { HomepageLayoutManager } from '../HomepageLayoutManager';
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableSectionRow({
  section,
  sectionLabels,
}: {
  section: any;
  sectionLabels: Record<string, string>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 bg-[var(--color-background)] border border-[var(--color-border)] cursor-move"
    >
      <div className="flex items-center gap-3">
        <div className="cursor-move px-2 py-1 text-xs bg-[var(--color-border)] text-[var(--color-text)]" {...attributes} {...listeners}>
          ⇅
        </div>
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {section.title || sectionLabels[section.sectionType] || section.sectionType}
        </span>
        <span className="text-xs text-[var(--color-secondary)] bg-[var(--color-border)] px-2 py-0.5 rounded">
          {sectionLabels[section.sectionType] || section.sectionType}
        </span>
        {section.description && (
          <span className="text-xs text-[var(--color-secondary)] line-clamp-1">
            {section.description}
          </span>
        )}
      </div>
      <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
        Active
      </span>
    </div>
  );
}

export default function FeaturedListingsPage() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
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

  // Fetch current homepage layout sections
  const { data: layoutData } = useQuery({
    queryKey: ['admin', 'homepage-layout'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/homepage-layout?adminAddress=${address}`);
      if (!res.ok) return { sections: [] };
      return res.json() as Promise<{ sections: any[] }>;
    },
    enabled: !!address,
  });

  const allSections = layoutData?.sections || [];
  const activeSections = allSections.filter((s: any) => s.isActive);
  
  // Local state for reordering (not saved until Save is clicked)
  const [localSections, setLocalSections] = useState<any[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Initialize local sections when data loads
  useEffect(() => {
    if (allSections.length > 0) {
      if (localSections.length === 0 || JSON.stringify(localSections.map(s => s.id)) !== JSON.stringify(allSections.map(s => s.id))) {
        setLocalSections([...allSections]);
        setHasUnsavedChanges(false);
      }
    }
  }, [allSections]);
  
  const sensors = useSensors(useSensor(PointerSensor));
  
  const reorderSections = useMutation({
    mutationFn: async (items: any[]) => {
      const res = await fetch('/api/admin/homepage-layout/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress: address,
          sections: items.map((s, index) => ({ id: s.id, displayOrder: index })),
        }),
      });
      if (!res.ok) throw new Error('Failed to reorder sections');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-layout'] });
      setHasUnsavedChanges(false);
      setSuccessMessage('Homepage layout saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || localSections.length === 0) return;
    
    const oldIndex = localSections.findIndex((s: any) => s.id === active.id);
    const newIndex = localSections.findIndex((s: any) => s.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(localSections, oldIndex, newIndex);
      setLocalSections(newOrder);
      setHasUnsavedChanges(true);
    }
  };
  
  const handleSave = () => {
    reorderSections.mutate(localSections);
  };
  
  const handleRevert = () => {
    setLocalSections([...allSections]);
    setHasUnsavedChanges(false);
  };
  
  // Use local sections for display if we have unsaved changes, otherwise use server data
  const displaySections = hasUnsavedChanges ? localSections : allSections;
  const displayActiveSections = displaySections.filter((s: any) => s.isActive);
  
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

      // Create a corresponding homepage layout section so it appears in the sortable list
      const layoutResponse = await fetch('/api/admin/homepage-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'custom_section',
          title: title || gallery.title,
          description: description || gallery.description || undefined,
          config: { sectionId: section.id },
          isActive: true,
          adminAddress: address,
        }),
      });
      if (!layoutResponse.ok) throw new Error('Failed to create homepage layout section');

      return { section, gallery, title: title || gallery.title };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'featured-sections'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'curation', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-layout'] });
      setSuccessMessage(`"${data.title}" has been added to the homepage!`);
      setTimeout(() => setSuccessMessage(null), 5000);
    },
  });
  
  const SECTION_LABELS: Record<string, string> = {
    upcoming_auctions: 'Upcoming Auctions',
    recently_concluded: 'Recently Concluded',
    live_bids: 'Live Bids',
    artist: 'Artist',
    gallery: 'Gallery',
    collector: 'Collector',
    listing: 'Single Listing',
    custom_section: 'Custom Section',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-500/20 border border-green-500/50 text-green-400 px-4 py-3 rounded">
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {/* Current Homepage Sections */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Current Homepage Sections</h2>
            <p className="text-sm text-[var(--color-secondary)] mt-1">
              Drag to reorder sections. Click Save to apply changes or Revert to undo.
            </p>
          </div>
          {hasUnsavedChanges && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRevert}
                className="px-4 py-2 text-sm border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
              >
                Revert
              </button>
              <button
                onClick={handleSave}
                disabled={reorderSections.isPending}
                className="px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-background)] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {reorderSections.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={displaySections.map((s: any) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {/* Recent Listings - Always present */}
              <div className="flex items-center justify-between p-3 bg-[var(--color-background)] border border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[var(--color-text)]">Recent Listings</span>
                  <span className="text-xs text-[var(--color-secondary)] bg-[var(--color-border)] px-2 py-0.5 rounded">
                    Always Active
                  </span>
                  <span className="text-xs text-[var(--color-secondary)]">
                    Shows all recent listings with infinite scroll
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                  Active
                </span>
              </div>

              {/* Active sections from layout manager - now draggable */}
              {displayActiveSections.length > 0 ? (
                displayActiveSections.map((section: any) => (
                  <SortableSectionRow
                    key={section.id}
                    section={section}
                    sectionLabels={SECTION_LABELS}
                  />
                ))
              ) : (
                <div className="text-center py-4 text-[var(--color-secondary)] text-sm">
                  No additional sections configured. Use the Homepage Layout Manager below to add sections.
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

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
                      createSectionFromGallery.mutate({
                        galleryId: gallery.id,
                        title: gallery.title,
                        description: gallery.description || undefined,
                      });
                    }}
                    disabled={createSectionFromGallery.isPending || !gallery.isPublished || (gallery.itemCount || 0) === 0}
                    className="px-3 py-1.5 text-xs bg-[var(--color-primary)] text-[var(--color-background)] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createSectionFromGallery.isPending ? 'Adding...' : 'Feature on Homepage'}
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
