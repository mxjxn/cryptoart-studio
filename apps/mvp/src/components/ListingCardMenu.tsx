"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useHasNFTAccess } from "~/hooks/useHasNFTAccess";
import { useIsAdmin } from "~/hooks/useIsAdmin";
import { STP_V2_CONTRACT_ADDRESS, MAX_GALLERIES_PER_USER } from "~/lib/constants";
import type { CurationData } from "@cryptoart/db";
import { AdminContextMenu } from "./AdminContextMenu";

interface ListingCardMenuProps {
  listingId: string;
  sellerAddress?: string;
}

interface GalleryWithCount extends CurationData {
  itemCount: number;
}

// UI constants
const DROPDOWN_WIDTH = 200;
const DROPDOWN_PADDING = 8;
const DROPDOWN_MAX_HEIGHT = 192; // max-h-48 (48 * 4px = 192px)

export function ListingCardMenu({ listingId, sellerAddress }: ListingCardMenuProps) {
  const { address, isConnected } = useAccount();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { hasAccess: hasNFTAccess, loading: isNFTLoading, addressesWithNFT } = useHasNFTAccess(STP_V2_CONTRACT_ADDRESS);
  const queryClient = useQueryClient();
  
  // User has gallery access if they're admin OR have NFT access
  const hasGalleryAccess = isAdmin || hasNFTAccess;
  
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newGalleryTitle, setNewGalleryTitle] = useState("");
  const [newGalleryDescription, setNewGalleryDescription] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

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
          verifiedAddresses: addressesWithNFT,
        }),
      });
      if (!response.ok) throw new Error("Failed to add listing");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["curation", address] });
      setIsOpen(false);
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
          verifiedAddresses: addressesWithNFT,
        }),
      });
      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "Failed to create gallery");
      }
      const { gallery } = await createResponse.json();

      // Add listing
      const addResponse = await fetch(`/api/curation/${gallery.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          listingIds: [listingId],
          verifiedAddresses: addressesWithNFT,
        }),
      });
      if (!addResponse.ok) throw new Error("Failed to add listing");
      return { gallery };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["curation", address] });
      setIsOpen(false);
      setIsCreating(false);
      setNewGalleryTitle("");
      setNewGalleryDescription("");
      alert("Gallery created and listing added!");
    },
    onError: (error: Error) => {
      alert(error.message);
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

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      
      // Calculate position: below button, aligned to right edge
      let left = rect.right - DROPDOWN_WIDTH;
      
      // Ensure dropdown doesn't go off-screen to the left
      if (left < DROPDOWN_PADDING) {
        left = DROPDOWN_PADDING;
      }
      
      // Ensure dropdown doesn't go off-screen to the right
      if (rect.right > window.innerWidth - DROPDOWN_PADDING) {
        left = window.innerWidth - DROPDOWN_WIDTH - DROPDOWN_PADDING;
      }
      
      setDropdownPosition({
        top: rect.bottom + 4,
        left: left,
      });
    }
  }, [isOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsCreating(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Determine if menu should be shown
  const isDataReady = !isNFTLoading && !isAdminLoading;
  const isUserConnected = isConnected && address;
  const hasMenuAccess = hasGalleryAccess || isAdmin;
  const shouldShow = isDataReady && isUserConnected && hasMenuAccess;
  
  if (!shouldShow) {
    return null;
  }

  // If only admin, show just the admin menu
  if (isAdmin && !hasGalleryAccess) {
    return <AdminContextMenu listingId={listingId} sellerAddress={sellerAddress} />;
  }

  const dropdownContent = isOpen ? (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-black border border-[#333333] rounded-lg shadow-lg py-1"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        minWidth: `${DROPDOWN_WIDTH}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {!isCreating ? (
        <>
          {galleries.length === 0 ? (
            <div className="px-3 py-2">
              <p className="text-xs text-[#999999] mb-2">No galleries yet</p>
              {galleries.length < MAX_GALLERIES_PER_USER && (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full px-3 py-2 text-xs bg-white text-black rounded hover:bg-[#e0e0e0] transition-colors"
                >
                  + Create Gallery
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-y-auto" style={{ maxHeight: `${DROPDOWN_MAX_HEIGHT}px` }}>
                {galleries.map((gallery) => (
                  <button
                    key={gallery.id}
                    onClick={() => addToListing.mutate(gallery.id)}
                    disabled={addToListing.isPending}
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333333] transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium">Add to {gallery.title}</div>
                    <div className="text-[10px] text-[#999999] mt-0.5">
                      {gallery.itemCount} {gallery.itemCount === 1 ? "listing" : "listings"}
                    </div>
                  </button>
                ))}
              </div>
              {galleries.length < MAX_GALLERIES_PER_USER && (
                <div className="border-t border-[#333333] pt-1 mt-1">
                  <button
                    onClick={() => setIsCreating(true)}
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333333] transition-colors"
                  >
                    + Create New Gallery
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="px-3 py-3">
          <h3 className="text-xs font-semibold mb-2">Create Gallery</h3>
          <form onSubmit={handleCreateAndAdd} className="space-y-2">
            <input
              type="text"
              value={newGalleryTitle}
              onChange={(e) => setNewGalleryTitle(e.target.value)}
              placeholder="Gallery name"
              className="w-full px-2 py-1.5 text-xs bg-[#1a1a1a] border border-[#333333] text-white rounded focus:outline-none focus:border-white"
              autoFocus
              required
            />
            <textarea
              value={newGalleryDescription}
              onChange={(e) => setNewGalleryDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-2 py-1.5 text-xs bg-[#1a1a1a] border border-[#333333] text-white rounded focus:outline-none focus:border-white resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewGalleryTitle("");
                  setNewGalleryDescription("");
                }}
                className="px-3 py-1.5 text-xs text-[#999999] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newGalleryTitle.trim() || createAndAdd.isPending}
                className="px-3 py-1.5 text-xs bg-white text-black rounded hover:bg-[#e0e0e0] transition-colors disabled:opacity-50"
              >
                {createAndAdd.isPending ? "Creating..." : "Create & Add"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Gallery Menu */}
        <div className="relative" ref={menuRef}>
          <button
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="bg-black border border-[#333333] text-white px-2 py-1 rounded text-xs hover:border-[#666666] transition-colors"
            title="Gallery Options"
          >
            ...
          </button>
        </div>
        
        {/* Admin Menu - only if user is also admin */}
        {isAdmin && (
          <AdminContextMenu listingId={listingId} sellerAddress={sellerAddress} />
        )}
      </div>
      {typeof document !== "undefined" && createPortal(dropdownContent, document.body)}
    </>
  );
}
