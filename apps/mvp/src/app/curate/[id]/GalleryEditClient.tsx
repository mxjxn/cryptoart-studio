"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "~/hooks/useIsAdmin";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { AuctionCard } from "~/components/AuctionCard";
import { useUsername } from "~/hooks/useUsername";
import { getGalleryUrl } from "~/lib/gallery-url";
import type { EnrichedAuctionData } from "~/lib/types";
import { APP_URL } from "~/lib/constants";

const gradients = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
];

interface GalleryEditClientProps {
  galleryId: string;
}

interface GalleryData {
  gallery: {
    id: string;
    curatorAddress: string;
    title: string;
    description?: string | null;
    slug?: string | null;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    listings: Array<EnrichedAuctionData & { displayOrder: number; notes?: string | null; addedAt: Date }>;
    itemCount: number;
  };
}

export default function GalleryEditClient({ galleryId }: GalleryEditClientProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  const [searchResults, setSearchResults] = useState<EnrichedAuctionData[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch gallery data
  const { data, isLoading, error } = useQuery({
    queryKey: ["curation", galleryId, address],
    queryFn: async () => {
      if (!address) throw new Error("Not connected");
      const response = await fetch(`/api/curation/${galleryId}?userAddress=${address}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error("Gallery not found");
        if (response.status === 403) throw new Error("Unauthorized");
        throw new Error("Failed to fetch gallery");
      }
      return response.json() as Promise<GalleryData>;
    },
    enabled: !!address && isConnected,
  });

  // Initialize form from fetched data
  useEffect(() => {
    if (data?.gallery) {
      setTitle(data.gallery.title);
      setDescription(data.gallery.description || "");
      setIsPublished(data.gallery.isPublished);
    }
  }, [data]);

  // Update gallery mutation
  const updateGallery = useMutation({
    mutationFn: async (updates: { title?: string; description?: string; isPublished?: boolean }) => {
      const response = await fetch(`/api/curation/${galleryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          ...updates,
        }),
      });
      if (!response.ok) throw new Error("Failed to update gallery");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["curation", galleryId, address] });
      queryClient.invalidateQueries({ queryKey: ["curation", address] });
    },
  });

  // Delete gallery mutation
  const deleteGallery = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/curation/${galleryId}?userAddress=${address}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete gallery");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["curation", address] });
      router.push("/curate");
    },
  });

  // Remove listing mutation
  const removeListing = useMutation({
    mutationFn: async (listingId: string) => {
      const response = await fetch(`/api/curation/${galleryId}/items?userAddress=${address}&listingId=${listingId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to remove listing");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["curation", galleryId, address] });
    },
  });

  // Add listings mutation
  const addListings = useMutation({
    mutationFn: async (listingIds: string[]) => {
      const response = await fetch(`/api/curation/${galleryId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          listingIds,
        }),
      });
      if (!response.ok) throw new Error("Failed to add listings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["curation", galleryId, address] });
      setIsAddModalOpen(false);
      setSelectedListings(new Set());
      setSearchQuery("");
      setSearchResults([]);
    },
  });

  // Search listings
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Try to fetch by listing ID first
      if (/^\d+$/.test(searchQuery.trim())) {
        const listing = await fetch(`/api/auctions/${searchQuery.trim()}`).then((r) => r.json());
        if (listing.success && listing.auction) {
          setSearchResults([listing.auction]);
          setIsSearching(false);
          return;
        }
      }

      // Otherwise search browse listings
      const response = await fetch(
        `/api/listings/browse?first=20&skip=0&orderBy=createdAt&orderDirection=desc&enrich=true`
      );
      const data = await response.json();
      const allListings = data.listings || [];

      // Filter by search query (title, artist, listing ID)
      const query = searchQuery.toLowerCase();
      const filtered = allListings.filter((listing: EnrichedAuctionData) => {
        const titleMatch = listing.title?.toLowerCase().includes(query);
        const artistMatch = listing.artist?.toLowerCase().includes(query);
        const idMatch = listing.listingId === query;
        return titleMatch || artistMatch || idMatch;
      });

      setSearchResults(filtered.slice(0, 20));
    } catch (error) {
      console.error("Error searching listings:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-save on blur
  const handleTitleBlur = () => {
    if (data?.gallery && title !== data.gallery.title) {
      updateGallery.mutate({ title });
    }
  };

  const handleDescriptionBlur = () => {
    if (data?.gallery && description !== (data.gallery.description || "")) {
      updateGallery.mutate({ description });
    }
  };

  const handlePublishToggle = () => {
    const newPublished = !isPublished;
    setIsPublished(newPublished);
    updateGallery.mutate({ isPublished: newPublished });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this gallery? This action cannot be undone.")) {
      deleteGallery.mutate();
    }
  };

  const { username } = useUsername(data?.gallery?.curatorAddress);
  const galleryUrl = data?.gallery && username && data.gallery.isPublished
    ? `${APP_URL}${getGalleryUrl(data.gallery, username)}`
    : null;

  // Redirect non-admins
  useEffect(() => {
    if (!isAdminLoading && !isAdmin) {
      router.replace("/");
    }
  }, [isAdmin, isAdminLoading, router]);

  if (isAdminLoading) {
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <ProfileDropdown />
        </header>
        <div className="px-5 py-12 text-center">
          <p className="text-[#cccccc]">Unauthorized</p>
        </div>
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <ProfileDropdown />
        </header>
        <div className="px-5 py-12 text-center">
          <p className="text-[#cccccc]">Please connect your wallet</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <ProfileDropdown />
        </header>
        <div className="px-5 py-12 text-center">
          <p className="text-[#cccccc]">Loading gallery...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <ProfileDropdown />
        </header>
        <div className="px-5 py-12 text-center">
          <p className="text-red-400 mb-2">Error loading gallery</p>
          <p className="text-[#999999] text-sm mb-4">{error instanceof Error ? error.message : "Unknown error"}</p>
          <TransitionLink href="/curate" className="text-white hover:underline">
            ← Back to My Galleries
          </TransitionLink>
        </div>
      </div>
    );
  }

  const gallery = data.gallery;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
        <Logo />
        <ProfileDropdown />
      </header>

      <div className="px-5 py-8">
        <div className="mb-6">
          <TransitionLink href="/curate" className="text-sm text-[#999999] hover:text-white transition-colors mb-4 inline-block">
            ← Back to My Galleries
          </TransitionLink>
        </div>

        {/* Gallery Header */}
        <div className="mb-8">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="text-3xl font-light bg-transparent border-none outline-none w-full mb-2 focus:bg-[#1a1a1a] focus:px-2 focus:py-1 focus:rounded"
            placeholder="Gallery Title"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            className="text-sm text-[#cccccc] bg-transparent border-none outline-none w-full resize-none focus:bg-[#1a1a1a] focus:px-2 focus:py-1 focus:rounded"
            placeholder="Add a description..."
            rows={2}
          />

          {/* Publish Toggle and Actions */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={handlePublishToggle}
                  className="w-4 h-4"
                />
                <span className="text-sm">Published</span>
              </label>
              {galleryUrl && (
                <div className="text-xs text-[#666666]">
                  URL: <span className="text-[#999999] font-mono">{galleryUrl}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {galleryUrl && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(galleryUrl);
                    alert("URL copied to clipboard!");
                  }}
                  className="px-4 py-2 text-sm bg-[#1a1a1a] border border-[#333333] hover:border-[#666666] transition-colors"
                >
                  Copy URL
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleteGallery.isPending}
                className="px-4 py-2 text-sm bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {deleteGallery.isPending ? "Deleting..." : "Delete Gallery"}
              </button>
            </div>
          </div>
        </div>

        {/* Listings Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-light">
              Listings ({gallery.listings.length})
            </h2>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 text-sm bg-white text-black font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
            >
              + Add Listings
            </button>
          </div>

          {gallery.listings.length === 0 ? (
            <div className="text-center py-12 border border-[#333333] rounded-lg">
              <p className="text-[#999999] mb-4">No listings in this gallery yet</p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-6 py-2.5 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
              >
                Add Your First Listing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {gallery.listings.map((listing, index) => (
                <div key={listing.listingId} className="relative group">
                  <AuctionCard
                    auction={listing}
                    gradient={gradients[index % gradients.length]}
                    index={index}
                  />
                  <button
                    onClick={() => {
                      if (confirm("Remove this listing from the gallery?")) {
                        removeListing.mutate(listing.listingId);
                      }
                    }}
                    className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={removeListing.isPending}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Listings Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="bg-black border border-[#333333] rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">Add Listings</h2>

            {/* Search Bar */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="Search by title, artist, or listing ID..."
                className="flex-1 px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded focus:outline-none focus:border-white"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-6 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-[#999999] mb-2">
                  Select listings to add ({selectedListings.size} selected)
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.map((listing) => {
                    const isSelected = selectedListings.has(listing.listingId);
                    const alreadyInGallery = gallery.listings.some((l) => l.listingId === listing.listingId);
                    return (
                      <div
                        key={listing.listingId}
                        className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors ${
                          isSelected
                            ? "border-white bg-[#1a1a1a]"
                            : "border-[#333333] hover:border-[#666666]"
                        } ${alreadyInGallery ? "opacity-50" : ""}`}
                        onClick={() => {
                          if (alreadyInGallery) return;
                          const newSelected = new Set(selectedListings);
                          if (isSelected) {
                            newSelected.delete(listing.listingId);
                          } else {
                            newSelected.add(listing.listingId);
                          }
                          setSelectedListings(newSelected);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          disabled={alreadyInGallery}
                          className="w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-normal truncate">
                            {listing.title || `Listing #${listing.listingId}`}
                          </p>
                          <p className="text-xs text-[#999999] truncate">
                            {listing.artist || listing.seller?.slice(0, 6) + "..."}
                          </p>
                        </div>
                        {alreadyInGallery && (
                          <span className="text-xs text-[#666666]">Already in gallery</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-sm text-[#999999] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedListings.size > 0) {
                    addListings.mutate(Array.from(selectedListings));
                  }
                }}
                disabled={selectedListings.size === 0 || addListings.isPending}
                className="px-6 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addListings.isPending
                  ? "Adding..."
                  : `Add ${selectedListings.size} ${selectedListings.size === 1 ? "Listing" : "Listings"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

