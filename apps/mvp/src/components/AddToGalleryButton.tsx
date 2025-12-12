"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useHasNFTAccess } from "~/hooks/useHasNFTAccess";
import { useIsAdmin } from "~/hooks/useIsAdmin";
import { GALLERY_ACCESS_NFT_CONTRACT_ADDRESS, MAX_GALLERIES_PER_USER } from "~/lib/constants";
import type { CurationData } from "@cryptoart/db";

interface AddToGalleryButtonProps {
  listingId: string;
}

interface GalleryWithCount extends CurationData {
  itemCount: number;
}

export function AddToGalleryButton({ listingId }: AddToGalleryButtonProps) {
  const { address, isConnected } = useAccount();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { hasAccess: hasNFTAccess, loading: isNFTLoading, addressesWithNFT } = useHasNFTAccess(GALLERY_ACCESS_NFT_CONTRACT_ADDRESS);
  const queryClient = useQueryClient();
  
  // User has access if they're admin OR have NFT access
  const hasGalleryAccess = isAdmin || hasNFTAccess;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newGalleryTitle, setNewGalleryTitle] = useState("");
  const [newGalleryDescription, setNewGalleryDescription] = useState("");

  // Fetch user's galleries (hooks must be called unconditionally)
  const { data: galleriesData } = useQuery({
    queryKey: ["curation", address],
    queryFn: async () => {
      if (!address) return { galleries: [] };
      const response = await fetch(`/api/curation?userAddress=${address}`);
      if (!response.ok) return { galleries: [] };
      return response.json();
    },
    enabled: !!address && isConnected && hasGalleryAccess && !isNFTLoading && !isAdminLoading,
  });

  const galleries: GalleryWithCount[] = galleriesData?.galleries || [];

  // Add listing to gallery mutation
  const addToListing = useMutation({
    mutationFn: async (galleryId: string) => {
      const response = await fetch(`/api/curation/${galleryId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          listingIds: [listingId],
          verifiedAddresses: addressesWithNFT, // Send verified addresses that have NFT for server-side validation
        }),
      });
      if (!response.ok) throw new Error("Failed to add listing");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["curation", address] });
      setIsModalOpen(false);
      alert("Listing added to gallery!");
    },
  });

  // Create gallery and add listing mutation
  const createAndAdd = useMutation({
    mutationFn: async (data: { title: string; description?: string }) => {
      // Create gallery
      const createResponse = await fetch("/api/curation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          title: data.title,
          description: data.description,
          verifiedAddresses: addressesWithNFT, // Send verified addresses that have NFT for server-side validation
        }),
      });
      if (!createResponse.ok) throw new Error("Failed to create gallery");
      const { gallery } = await createResponse.json();

      // Add listing
      const addResponse = await fetch(`/api/curation/${gallery.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          listingIds: [listingId],
          verifiedAddresses: addressesWithNFT, // Send verified addresses that have NFT for server-side validation
        }),
      });
      if (!addResponse.ok) throw new Error("Failed to add listing");
      return { gallery };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["curation", address] });
      setIsModalOpen(false);
      setIsCreating(false);
      setNewGalleryTitle("");
      setNewGalleryDescription("");
      alert("Gallery created and listing added!");
    },
  });

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGalleryTitle.trim()) return;
    createAndAdd.mutate({
      title: newGalleryTitle,
      description: newGalleryDescription || undefined,
    });
  };

  // Only show for users with gallery access (admin OR NFT balance > 0 in any associated wallet)
  // Hide while loading or if not connected/has access
  // This check must come AFTER all hooks are called
  // Only render if ALL conditions are explicitly true
  // Be extra defensive - treat undefined/null as false
  const shouldShow = Boolean(
    isConnected === true && 
    address && 
    address !== null && 
    address !== undefined && 
    isNFTLoading === false && 
    isAdminLoading === false && 
    hasGalleryAccess === true
  );
  
  // Early return - don't render anything if user doesn't have gallery access
  if (!shouldShow) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-4 py-2 text-sm bg-[#1a1a1a] border border-[#333333] hover:border-[#666666] transition-colors"
        title="Add to Gallery"
      >
        + Gallery
      </button>

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setIsModalOpen(false);
            setIsCreating(false);
            setNewGalleryTitle("");
            setNewGalleryDescription("");
          }}
        >
          <div
            className="bg-black border border-[#333333] rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {!isCreating ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Add to Gallery</h2>
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {galleries.length === 0 ? (
                    <p className="text-sm text-[#999999]">No galleries yet. Create one to get started!</p>
                  ) : (
                    galleries.map((gallery) => (
                      <button
                        key={gallery.id}
                        onClick={() => addToListing.mutate(gallery.id)}
                        disabled={addToListing.isPending}
                        className="w-full text-left px-4 py-3 bg-[#1a1a1a] border border-[#333333] rounded hover:border-[#666666] transition-colors disabled:opacity-50"
                      >
                        <div className="font-medium">Add to {gallery.title}</div>
                        <div className="text-xs text-[#999999]">
                          {gallery.itemCount} {gallery.itemCount === 1 ? "listing" : "listings"}
                          {!gallery.isPublished && " • Draft"}
                        </div>
                      </button>
                    ))
                  )}
                </div>
                {galleries.length < MAX_GALLERIES_PER_USER ? (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="w-full px-4 py-2 text-sm bg-white text-black font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
                  >
                    + Create New Gallery
                  </button>
                ) : (
                  <p className="text-xs text-[#999999] text-center py-2">
                    Maximum of {MAX_GALLERIES_PER_USER} galleries reached
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-4">Create New Gallery</h2>
                <form onSubmit={handleCreateAndAdd} className="space-y-4">
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
                      onClick={() => {
                        setIsCreating(false);
                        setNewGalleryTitle("");
                        setNewGalleryDescription("");
                      }}
                      className="px-4 py-2 text-sm text-[#999999] hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newGalleryTitle.trim() || createAndAdd.isPending}
                      className="px-6 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createAndAdd.isPending ? "Creating..." : "Create & Add"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

