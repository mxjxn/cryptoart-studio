"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "~/hooks/useIsAdmin";
import { useHasNFTAccess } from "~/hooks/useHasNFTAccess";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { useUsername } from "~/hooks/useUsername";
import { getGalleryUrl } from "~/lib/gallery-url";
import type { CurationData } from "@cryptoart/db";
import { MAX_GALLERIES_PER_USER, STP_V2_CONTRACT_ADDRESS } from "~/lib/constants";

type FilterTab = "all" | "published" | "drafts";

interface GalleryWithCount extends CurationData {
  itemCount: number;
}

export default function CurateClient() {
  const { address, isConnected } = useAccount();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { hasAccess: hasNFTAccess, loading: isNFTLoading } = useHasNFTAccess(STP_V2_CONTRACT_ADDRESS);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGalleryTitle, setNewGalleryTitle] = useState("");
  const [newGalleryDescription, setNewGalleryDescription] = useState("");
  const hasRedirectedRef = useRef(false);

  // User has gallery access if they're admin OR have NFT access (members)
  const hasGalleryAccess = isAdmin || hasNFTAccess;
  const isLoadingAccess = isAdminLoading || isNFTLoading;

  // Redirect users without gallery access (only once)
  useEffect(() => {
    if (!isLoadingAccess && !hasGalleryAccess && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGalleryAccess, isLoadingAccess]); // router.replace is stable, don't include router in deps

  if (isLoadingAccess) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <ProfileDropdown />
        </header>
        <div className="px-5 py-12 text-center">
          <p className="text-[#cccccc]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasGalleryAccess) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <ProfileDropdown />
        </header>
        <div className="px-5 py-12 text-center">
          <p className="text-[#cccccc]">Gallery features are available to members only.</p>
        </div>
      </div>
    );
  }

  // Fetch user's galleries
  const { data, isLoading, error } = useQuery({
    queryKey: ["curation", address],
    queryFn: async () => {
      if (!address) return { galleries: [] };
      const response = await fetch(`/api/curation?userAddress=${address}`);
      if (!response.ok) throw new Error("Failed to fetch galleries");
      return response.json();
    },
    enabled: !!address && isConnected,
  });

  const galleries: GalleryWithCount[] = data?.galleries || [];

  // Filter galleries
  const filteredGalleries =
    filterTab === "published"
      ? galleries.filter((g) => g.isPublished)
      : filterTab === "drafts"
        ? galleries.filter((g) => !g.isPublished)
        : galleries;

  // Create gallery mutation
  const createGallery = useMutation({
    mutationFn: async (data: { title: string; description?: string }) => {
      const response = await fetch("/api/curation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          title: data.title,
          description: data.description,
        }),
      });
      if (!response.ok) throw new Error("Failed to create gallery");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["curation", address] });
      setIsCreateModalOpen(false);
      setNewGalleryTitle("");
      setNewGalleryDescription("");
      // Navigate to the new gallery
      window.location.href = `/curate/${data.gallery.id}`;
    },
  });

  const handleCreateGallery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGalleryTitle.trim()) return;
    createGallery.mutate({
      title: newGalleryTitle,
      description: newGalleryDescription || undefined,
    });
  };

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <ProfileDropdown />
        </header>
        <div className="px-5 py-12 text-center">
          <p className="text-[#cccccc] mb-4">Please connect your wallet to create galleries</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
        <Logo />
        <ProfileDropdown />
      </header>

      <div className="px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-light">My Galleries</h1>
            <p className="text-sm text-[#999999] mt-1">
              {galleries.length} of {MAX_GALLERIES_PER_USER} galleries created
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            disabled={galleries.length >= MAX_GALLERIES_PER_USER}
            className="px-6 py-2.5 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            title={galleries.length >= MAX_GALLERIES_PER_USER ? `You can only create up to ${MAX_GALLERIES_PER_USER} galleries` : ''}
          >
            + Create Gallery
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-6 mb-8 border-b border-[#333333]">
          <button
            onClick={() => setFilterTab("all")}
            className={`pb-3 text-sm font-mek-mono tracking-[0.5px] transition-colors ${
              filterTab === "all"
                ? "text-white border-b-2 border-white"
                : "text-[#999999] hover:text-white"
            }`}
          >
            All ({galleries.length})
          </button>
          <button
            onClick={() => setFilterTab("published")}
            className={`pb-3 text-sm font-mek-mono tracking-[0.5px] transition-colors ${
              filterTab === "published"
                ? "text-white border-b-2 border-white"
                : "text-[#999999] hover:text-white"
            }`}
          >
            Published ({galleries.filter((g) => g.isPublished).length})
          </button>
          <button
            onClick={() => setFilterTab("drafts")}
            className={`pb-3 text-sm font-mek-mono tracking-[0.5px] transition-colors ${
              filterTab === "drafts"
                ? "text-white border-b-2 border-white"
                : "text-[#999999] hover:text-white"
            }`}
          >
            Drafts ({galleries.filter((g) => !g.isPublished).length})
          </button>
        </div>

        {/* Galleries Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-[#cccccc]">Loading galleries...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-2">Error loading galleries</p>
            <p className="text-[#999999] text-sm">{error instanceof Error ? error.message : "Unknown error"}</p>
          </div>
        ) : filteredGalleries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#cccccc] mb-4">
              {filterTab === "all"
                ? "You haven't created any galleries yet"
                : filterTab === "published"
                  ? "No published galleries"
                  : "No draft galleries"}
            </p>
            {filterTab === "all" && galleries.length < MAX_GALLERIES_PER_USER && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-2.5 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
              >
                Create Your First Gallery
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGalleries.map((gallery, index) => {
              // Find index in published galleries only (for published galleries)
              // Galleries are ordered by createdAt desc, so newest is index 0, which maps to gallery index 1
              const publishedGalleries = galleries.filter((g) => g.isPublished);
              const galleryIndex = gallery.isPublished 
                ? publishedGalleries.findIndex((g) => g.id === gallery.id) + 1
                : undefined;
              return (
                <GalleryCard 
                  key={gallery.id} 
                  gallery={gallery} 
                  galleryIndex={galleryIndex}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Create Gallery Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="bg-black border border-[#333333] rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">Create New Gallery</h2>
            <form onSubmit={handleCreateGallery} className="space-y-4">
              <div>
                <label className="block text-sm text-[#999999] mb-2">Title *</label>
                <input
                  type="text"
                  value={newGalleryTitle}
                  onChange={(e) => setNewGalleryTitle(e.target.value)}
                  placeholder="My Curated Collection"
                  className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded focus:outline-none focus:border-white"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-[#999999] mb-2">Description (Optional)</label>
                <textarea
                  value={newGalleryDescription}
                  onChange={(e) => setNewGalleryDescription(e.target.value)}
                  placeholder="Describe your gallery..."
                  rows={3}
                  className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded focus:outline-none focus:border-white resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm text-[#999999] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newGalleryTitle.trim() || createGallery.isPending}
                  className="px-6 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createGallery.isPending ? "Creating..." : "Create Gallery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface GalleryCardProps {
  gallery: GalleryWithCount;
  galleryIndex?: number;
}

function GalleryCard({ gallery, galleryIndex }: GalleryCardProps) {
  const { username } = useUsername(gallery.curatorAddress);
  const createdDate = new Date(gallery.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Use new URL structure for published galleries (with or without slug), edit URL for drafts
  const galleryUrl = gallery.isPublished
    ? getGalleryUrl(gallery, username, galleryIndex)
    : `/curate/${gallery.id}`;

  return (
    <TransitionLink
      href={galleryUrl}
      className="block bg-[#1a1a1a] border border-[#333333] rounded-lg overflow-hidden hover:border-[#666666] transition-colors"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-base font-normal line-clamp-2 flex-1">{gallery.title}</h3>
          <span
            className={`ml-2 px-2 py-0.5 text-xs rounded ${
              gallery.isPublished
                ? "bg-green-500/20 text-green-400"
                : "bg-gray-500/20 text-gray-400"
            }`}
          >
            {gallery.isPublished ? "Published" : "Draft"}
          </span>
        </div>
        {gallery.description && (
          <p className="text-sm text-[#999999] line-clamp-2 mb-3">{gallery.description}</p>
        )}
        <div className="flex items-center justify-between text-xs text-[#666666]">
          <span>{gallery.itemCount} {gallery.itemCount === 1 ? "listing" : "listings"}</span>
          <span>Created {createdDate}</span>
        </div>
      </div>
    </TransitionLink>
  );
}

