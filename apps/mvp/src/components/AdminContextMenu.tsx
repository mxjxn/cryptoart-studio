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
        className="text-[#999999] hover:text-white p-1 rounded"
        disabled={isLoading}
        title="Admin Options"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-8 z-50 bg-[#1a1a1a] border border-[#333333] rounded-lg shadow-lg min-w-[180px] py-1">
          {listingId && (
            <>
              {isFeatured ? (
                <button
                  onClick={handleRemoveFromFeatured}
                  disabled={isLoading}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#333333] transition-colors"
                >
                  Remove from Featured
                </button>
              ) : (
                <button
                  onClick={handleAddToFeatured}
                  disabled={isLoading}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#333333] transition-colors"
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
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#333333] transition-colors"
            >
              Hide User
            </button>
          )}
          {listingId && (
            <a
              href={`/admin/featured`}
              className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-[#333333] transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Admin Dashboard
            </a>
          )}
        </div>
      )}
    </div>
  );
}

