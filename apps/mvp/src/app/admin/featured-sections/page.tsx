'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

interface FeaturedSection {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  config?: Record<string, any> | null;
  displayOrder: number;
  isActive: boolean;
  items?: Array<{
    id: string;
    itemType: string;
    itemId: string;
    displayOrder: number;
  }>;
}

export default function FeaturedSectionsPage() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const [newSection, setNewSection] = useState({
    type: 'custom',
    title: '',
    description: '',
    displayOrder: 0,
  });
  const [editingSection, setEditingSection] = useState<FeaturedSection | null>(null);
  const [newItem, setNewItem] = useState<{ sectionId: string; itemType: string; itemId: string } | null>(null);

  // Fetch all featured sections
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'featured-sections'],
    queryFn: () => fetch(`/api/admin/featured-sections?adminAddress=${address}`).then(r => r.json()),
    enabled: !!address,
  });

  const sections: FeaturedSection[] = data?.sections || [];

  // Create section mutation
  const createSection = useMutation({
    mutationFn: (section: any) =>
      fetch('/api/admin/featured-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...section, adminAddress: address }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'featured-sections'] });
      setNewSection({ type: 'custom', title: '', description: '', displayOrder: 0 });
    },
  });

  // Update section mutation
  const updateSection = useMutation({
    mutationFn: ({ id, ...updates }: any) =>
      fetch(`/api/admin/featured-sections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, adminAddress: address }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'featured-sections'] });
      setEditingSection(null);
    },
  });

  // Delete section mutation
  const deleteSection = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/featured-sections/${id}?adminAddress=${address}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'featured-sections'] }),
  });

  // Toggle active mutation
  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/admin/featured-sections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive, adminAddress: address }),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'featured-sections'] }),
  });

  // Reorder sections mutation
  const reorderSections = useMutation({
    mutationFn: (sectionOrders: Array<{ id: string; displayOrder: number }>) =>
      fetch('/api/admin/featured-sections/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionOrders, adminAddress: address }),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'featured-sections'] }),
  });

  // Invalidate cache mutation
  const invalidateCache = useMutation({
    mutationFn: (sectionId: string) =>
      fetch(`/api/admin/featured-sections/${sectionId}/invalidate?adminAddress=${address}`, {
        method: 'POST',
      }).then(r => r.json()),
  });

  // Add item mutation
  const addItem = useMutation({
    mutationFn: ({ sectionId, itemType, itemId }: { sectionId: string; itemType: string; itemId: string }) =>
      fetch(`/api/admin/featured-sections/${sectionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType, itemId, adminAddress: address }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'featured-sections'] });
      setNewItem(null);
    },
  });

  // Delete item mutation
  const deleteItem = useMutation({
    mutationFn: ({ sectionId, itemId }: { sectionId: string; itemId: string }) =>
      fetch(`/api/admin/featured-sections/${sectionId}/items?adminAddress=${address}&itemId=${itemId}`, {
        method: 'DELETE',
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'featured-sections'] }),
  });

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrders = sections.map((s, i) => ({
      id: s.id,
      displayOrder: i === index ? sections[index - 1].displayOrder : i === index - 1 ? sections[index].displayOrder : s.displayOrder,
    }));
    reorderSections.mutate(newOrders);
  };

  const handleMoveDown = (index: number) => {
    if (index === sections.length - 1) return;
    const newOrders = sections.map((s, i) => ({
      id: s.id,
      displayOrder: i === index ? sections[index + 1].displayOrder : i === index + 1 ? sections[index].displayOrder : s.displayOrder,
    }));
    reorderSections.mutate(newOrders);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Featured Sections</h1>

      {/* Create New Section */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
        <h2 className="text-lg font-semibold mb-4 text-[var(--color-text)]">Create New Section</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newSection.title.trim()) {
              createSection.mutate(newSection);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Type</label>
            <select
              value={newSection.type}
              onChange={(e) => setNewSection({ ...newSection, type: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
            >
              <option value="custom">Custom (Manual Selection)</option>
              <option value="featured_artists">Featured Artists</option>
              <option value="recently_sold">Recently Sold</option>
              <option value="upcoming">Upcoming</option>
              <option value="collection">Collection</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Title</label>
            <input
              type="text"
              value={newSection.title}
              onChange={(e) => setNewSection({ ...newSection, title: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
              placeholder="Section Title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Description (Optional)</label>
            <textarea
              value={newSection.description}
              onChange={(e) => setNewSection({ ...newSection, description: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
              placeholder="Section Description"
              rows={2}
            />
          </div>
          <button
            type="submit"
            disabled={!newSection.title.trim() || createSection.isPending}
            className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-background)] font-medium disabled:opacity-50"
          >
            {createSection.isPending ? 'Creating...' : 'Create Section'}
          </button>
        </form>
      </div>

      {/* Existing Sections */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Existing Sections</h2>
        {isLoading ? (
          <p className="text-[var(--color-secondary)]">Loading...</p>
        ) : sections.length === 0 ? (
          <p className="text-[var(--color-secondary)]">No featured sections</p>
        ) : (
          sections.map((section, index) => (
            <div
              key={section.id}
              className="bg-[var(--color-background)] border border-[var(--color-border)] p-4"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-base font-semibold text-[var(--color-text)]">{section.title}</h3>
                    <span className="text-xs text-[var(--color-secondary)] bg-[var(--color-border)] px-2 py-1 rounded">
                      {section.type}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      section.isActive
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {section.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {section.description && (
                    <p className="text-sm text-[var(--color-secondary)] mb-2">{section.description}</p>
                  )}
                  <p className="text-xs text-[var(--color-tertiary)]">
                    Order: {section.displayOrder} | Items: {section.items?.length || 0}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="px-2 py-1 text-xs bg-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === sections.length - 1}
                    className="px-2 py-1 text-xs bg-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => toggleActive.mutate({ id: section.id, isActive: !section.isActive })}
                    className="px-3 py-1 text-xs bg-[var(--color-border)] text-[var(--color-text)]"
                  >
                    {section.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => setEditingSection(section)}
                    className="px-3 py-1 text-xs bg-[var(--color-primary)] text-[var(--color-background)]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this section?')) {
                        deleteSection.mutate(section.id);
                      }
                    }}
                    className="px-3 py-1 text-xs bg-red-500 text-white"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => invalidateCache.mutate(section.id)}
                    className="px-3 py-1 text-xs bg-yellow-500 text-black"
                    title="Invalidate cache for this section"
                  >
                    🔄
                  </button>
                </div>
              </div>

              {/* Edit Form */}
              {editingSection?.id === section.id && (
                <div className="mt-4 p-4 bg-[var(--color-border)]/20 rounded">
                  <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">Edit Section</h4>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      updateSection.mutate({
                        id: section.id,
                        title: editingSection.title,
                        description: editingSection.description,
                      });
                    }}
                    className="space-y-3"
                  >
                    <input
                      type="text"
                      value={editingSection.title}
                      onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
                    />
                    <textarea
                      value={editingSection.description || ''}
                      onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-background)] text-sm"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSection(null)}
                        className="px-4 py-2 bg-[var(--color-border)] text-[var(--color-text)] text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Items List */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">Items</h4>
                  <button
                    onClick={() => setNewItem({ sectionId: section.id, itemType: 'listing', itemId: '' })}
                    className="text-xs text-[var(--color-primary)] hover:underline"
                  >
                    + Add Item
                  </button>
                </div>
                {newItem?.sectionId === section.id && (
                  <div className="mb-3 p-3 bg-[var(--color-border)]/20 rounded">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (newItem.itemId.trim()) {
                          addItem.mutate(newItem);
                        }
                      }}
                      className="flex gap-2"
                    >
                      <select
                        value={newItem.itemType}
                        onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value })}
                        className="px-2 py-1 border border-[var(--color-border)] bg-transparent text-[var(--color-text)] text-xs"
                      >
                        <option value="listing">Listing ID</option>
                        <option value="artist">Artist Address</option>
                        <option value="collection">Collection Address</option>
                      </select>
                      <input
                        type="text"
                        value={newItem.itemId}
                        onChange={(e) => setNewItem({ ...newItem, itemId: e.target.value })}
                        placeholder={newItem.itemType === 'listing' ? 'Listing ID' : 'Address'}
                        className="flex-1 px-2 py-1 border border-[var(--color-border)] bg-transparent text-[var(--color-text)] text-xs"
                      />
                      <button
                        type="submit"
                        disabled={!newItem.itemId.trim() || addItem.isPending}
                        className="px-3 py-1 bg-[var(--color-primary)] text-[var(--color-background)] text-xs disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewItem(null)}
                        className="px-3 py-1 bg-[var(--color-border)] text-[var(--color-text)] text-xs"
                      >
                        Cancel
                      </button>
                    </form>
                  </div>
                )}
                {section.items && section.items.length > 0 ? (
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 bg-[var(--color-border)]/10 rounded text-xs"
                      >
                        <span className="text-[var(--color-text)]">
                          {item.itemType}: {item.itemId}
                        </span>
                        <button
                          onClick={() => {
                            if (confirm('Remove this item?')) {
                              deleteItem.mutate({ sectionId: section.id, itemId: item.id });
                            }
                          }}
                          className="text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-secondary)]">No items</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Global Cache Invalidation */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
        <h2 className="text-lg font-semibold mb-2 text-[var(--color-text)]">Cache Management</h2>
        <button
          onClick={() => {
            sections.forEach((section) => invalidateCache.mutate(section.id));
          }}
          className="px-4 py-2 bg-yellow-500 text-black font-medium"
        >
          Invalidate All Caches
        </button>
        {invalidateCache.isSuccess && (
          <p className="mt-2 text-sm text-green-400">
            Cache invalidated! Please hard refresh (Cmd+Shift+R or Ctrl+Shift+R) to see changes.
          </p>
        )}
      </div>
    </div>
  );
}

