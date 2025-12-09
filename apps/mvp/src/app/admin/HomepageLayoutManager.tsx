'use client';

import { useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAccount } from 'wagmi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type SectionType =
  | 'upcoming_auctions'
  | 'recently_concluded'
  | 'live_bids'
  | 'artist'
  | 'gallery'
  | 'collector'
  | 'listing'
  | 'featured_carousel'
  | 'custom_section';

type SectionConfig = Record<string, any> | null;

interface LayoutSection {
  id: string;
  sectionType: SectionType;
  title?: string | null;
  description?: string | null;
  config?: SectionConfig;
  displayOrder: number;
  isActive: boolean;
}

const SECTION_LABELS: Record<SectionType, string> = {
  upcoming_auctions: 'Upcoming Auctions',
  recently_concluded: 'Recently Concluded',
  live_bids: 'Live Bids',
  artist: 'Artist',
  gallery: 'Gallery',
  collector: 'Collector',
  listing: 'Single Listing',
  featured_carousel: 'Featured Carousel',
  custom_section: 'Custom Section',
};

function SortableRow({
  section,
  onEdit,
  onDelete,
  onToggle,
}: {
  section: LayoutSection;
  onEdit: (section: LayoutSection) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, value: boolean) => void;
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
      className="flex items-start justify-between gap-3 p-3 bg-[var(--color-background)] border border-[var(--color-border)]"
    >
      <div className="flex items-start gap-3">
        <button
          className="cursor-move px-2 py-1 text-xs bg-[var(--color-border)] text-[var(--color-text)]"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
        >
          ⇅
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">{section.title || SECTION_LABELS[section.sectionType]}</span>
            <span className="text-xs text-[var(--color-secondary)] bg-[var(--color-border)] px-2 py-0.5 rounded">
              {SECTION_LABELS[section.sectionType]}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                section.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {section.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {section.description && <p className="text-xs text-[var(--color-secondary)] mt-1 line-clamp-2">{section.description}</p>}
          {section.config && (
            <p className="text-[10px] text-[var(--color-tertiary)] mt-1">
              Config: {JSON.stringify(section.config)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle(section.id, !section.isActive)}
          className="px-3 py-1 text-xs bg-[var(--color-border)] text-[var(--color-text)]"
        >
          {section.isActive ? 'Disable' : 'Enable'}
        </button>
        <button
          onClick={() => onEdit(section)}
          className="px-3 py-1 text-xs bg-[var(--color-primary)] text-[var(--color-background)]"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(section.id)}
          className="px-3 py-1 text-xs bg-red-500 text-white"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function HomepageLayoutManager() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const sensors = useSensors(useSensor(PointerSensor));

  const [form, setForm] = useState<{
    id?: string;
    sectionType: SectionType;
    title: string;
    description: string;
    config: SectionConfig;
    isActive: boolean;
  }>({
    sectionType: 'upcoming_auctions',
    title: '',
    description: '',
    config: {},
    isActive: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'homepage-layout'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/homepage-layout?adminAddress=${address}`);
      if (!res.ok) throw new Error('Failed to load homepage layout');
      return res.json() as Promise<{ sections: LayoutSection[] }>;
    },
    enabled: !!address,
  });

  const sections = useMemo(() => data?.sections || [], [data]);

  const createSection = useMutation({
    mutationFn: async (payload: Omit<LayoutSection, 'id' | 'displayOrder'> & { displayOrder?: number }) => {
      const res = await fetch('/api/admin/homepage-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, adminAddress: address }),
      });
      if (!res.ok) throw new Error('Failed to create section');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-layout'] }),
  });

  const updateSection = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/admin/homepage-layout/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, adminAddress: address }),
      });
      if (!res.ok) throw new Error('Failed to update section');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-layout'] }),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/homepage-layout/${id}?adminAddress=${address}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete section');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-layout'] }),
  });

  const reorderSections = useMutation({
    mutationFn: async (items: LayoutSection[]) => {
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-layout'] }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = {
      sectionType: form.sectionType,
      title: form.title || undefined,
      description: form.description || undefined,
      config: form.config,
      isActive: form.isActive,
    };

    if (form.id) {
      updateSection.mutate({ id: form.id, ...payload });
    } else {
      createSection.mutate(payload as any);
    }

    setForm({
      sectionType: 'upcoming_auctions',
      title: '',
      description: '',
      config: {},
      isActive: true,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !sections) return;
    const oldIndex = sections.findIndex((s: LayoutSection) => s.id === active.id);
    const newIndex = sections.findIndex((s: LayoutSection) => s.id === over.id);
    const newOrder = arrayMove(sections, oldIndex, newIndex);
    reorderSections.mutate(newOrder);
  };

  const renderConfigFields = () => {
    switch (form.sectionType) {
      case 'artist':
      case 'collector':
        return (
          <input
            type="text"
            value={form.config?.name || ''}
            onChange={(e) => setForm((f) => ({ ...f, config: { ...f.config, name: e.target.value } }))}
            className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
            placeholder="Address or name"
          />
        );
      case 'gallery':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="text"
              value={form.config?.curatorAddress || ''}
              onChange={(e) => setForm((f) => ({ ...f, config: { ...f.config, curatorAddress: e.target.value } }))}
              className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
              placeholder="Curator address"
            />
            <input
              type="text"
              value={form.config?.stubname || form.config?.slug || ''}
              onChange={(e) => setForm((f) => ({ ...f, config: { ...f.config, stubname: e.target.value, slug: e.target.value } }))}
              className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
              placeholder="Gallery slug"
            />
          </div>
        );
      case 'listing':
        return (
          <input
            type="text"
            value={form.config?.listingId || ''}
            onChange={(e) => setForm((f) => ({ ...f, config: { ...f.config, listingId: e.target.value } }))}
            className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
            placeholder="Listing ID"
          />
        );
      case 'custom_section':
        return (
          <input
            type="text"
            value={form.config?.sectionId || ''}
            onChange={(e) => setForm((f) => ({ ...f, config: { ...f.config, sectionId: e.target.value } }))}
            className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
            placeholder="Featured section ID"
          />
        );
      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="number"
              value={form.config?.limit ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, config: { ...f.config, limit: Number(e.target.value) || undefined } }))}
              className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
              placeholder="Limit (optional)"
            />
            <select
              value={form.config?.displayFormat || 'carousel'}
              onChange={(e) => setForm((f) => ({ ...f, config: { ...f.config, displayFormat: e.target.value } }))}
              className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
            >
              <option value="carousel">Carousel</option>
              <option value="grid">Grid</option>
            </select>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Homepage Layout</h2>
          <p className="text-sm text-[var(--color-secondary)]">Drag and drop to arrange homepage sections.</p>
        </div>
      </div>

      {/* Add / Edit form */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4 space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">{form.id ? 'Edit Section' : 'Add Section'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[var(--color-secondary)] mb-1">Type</label>
              <select
                value={form.sectionType}
                onChange={(e) => setForm((f) => ({ ...f, sectionType: e.target.value as SectionType, config: {} }))}
                className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
              >
                {Object.entries(SECTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--color-secondary)] mb-1">Title (optional)</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
                placeholder="Override title"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[var(--color-secondary)] mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)]"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-secondary)] mb-1">Config</label>
            {renderConfigFields()}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Active
            </label>
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-background)] text-sm font-medium"
              disabled={createSection.isPending || updateSection.isPending}
            >
              {form.id ? 'Update Section' : 'Add Section'}
            </button>
            {form.id && (
              <button
                type="button"
                className="px-3 py-2 text-sm text-[var(--color-secondary)]"
                onClick={() =>
                  setForm({
                    sectionType: 'upcoming_auctions',
                    title: '',
                    description: '',
                    config: {},
                    isActive: true,
                  })
                }
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-[var(--color-secondary)]">Loading layout...</p>
        ) : sections.length === 0 ? (
          <p className="text-[var(--color-secondary)]">No sections yet. Add one above.</p>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map((s: LayoutSection) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {sections.map((section: LayoutSection) => (
                  <SortableRow
                    key={section.id}
                    section={section}
                    onDelete={(id) => deleteSection.mutate(id)}
                    onEdit={(s) =>
                      setForm({
                        id: s.id,
                        sectionType: s.sectionType,
                        title: s.title || '',
                        description: s.description || '',
                        config: s.config || {},
                        isActive: s.isActive,
                      })
                    }
                    onToggle={(id, value) => updateSection.mutate({ id, isActive: value })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

