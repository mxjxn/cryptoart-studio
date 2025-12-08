"use client";

import { useState, useRef, useEffect } from "react";
import { useAdminMode } from "~/hooks/useAdminMode";
import { useAccount } from "wagmi";
import { useQueryClient, useQuery } from "@tanstack/react-query";

interface AdminContextMenuProps {
  listingId?: string;
  sellerAddress?: string;
  isFeatured?: boolean;
}

export function AdminContextMenu({ 
  listingId, 
  sellerAddress,
  isFeatured: propIsFeatured
}: AdminContextMenuProps) {
  const { isAdminModeEnabled } = useAdminMode();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check if listing is featured
  const { data: featuredData } = useQuery({
    queryKey: ["admin", "featured"],
    queryFn: () => fetch("/api/admin/featured").then(r => r.json()),
    enabled: !!listingId && isAdminModeEnabled,
  });

  const isFeatured = propIsFeatured ?? (featuredData?.listings?.some((l: any) => l.listingId === listingId) ?? false);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (!isAdminModeEnabled) {
    return null;
  }

  const handleAddToFeatured = async () => {
    if (!listingId || !address) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/featured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, adminAddress: address }),
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["admin", "featured"] });
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Error adding to featured:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFromFeatured = async () => {
    if (!listingId || !address) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/featured/${listingId}?adminAddress=${address}`, {
        method: "DELETE",
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["admin", "featured"] });
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Error removing from featured:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHideUser = async () => {
    if (!sellerAddress || !address) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/users/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: sellerAddress, adminAddress: address }),
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Error hiding user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="bg-black border-2 border-red-500 text-white px-2 py-1 rounded text-xs hover:bg-[#1a1a1a] transition-colors"
        disabled={isLoading}
        title="Admin Options"
      >
        ...
      </button>

      {isOpen && (
        <div className="absolute right-0 top-8 z-50 bg-black border-2 border-red-500 rounded-lg shadow-lg min-w-[160px] py-1">
          {listingId && (
            <>
              {isFeatured ? (
                <button
                  onClick={handleRemoveFromFeatured}
                  disabled={isLoading}
                  className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333333] transition-colors"
                >
                  Remove from Featured
                </button>
              ) : (
                <button
                  onClick={handleAddToFeatured}
                  disabled={isLoading}
                  className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333333] transition-colors"
                >
                  Add to Featured
                </button>
              )}
            </>
          )}
          {sellerAddress && (
            <button
              onClick={handleHideUser}
              disabled={isLoading}
              className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333333] transition-colors"
            >
              Hide User
            </button>
          )}
        </div>
      )}
    </div>
  );
}

