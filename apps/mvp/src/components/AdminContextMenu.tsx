"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const { isAdmin } = useAdminMode();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Check if listing is featured
  const { data: featuredData } = useQuery({
    queryKey: ["admin", "featured"],
    queryFn: () => fetch("/api/admin/featured").then(r => r.json()),
    enabled: !!listingId && isAdmin,
  });

  const isFeatured = propIsFeatured ?? (featuredData?.listings?.some((l: any) => l.listingId === listingId) ?? false);

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 160; // min-w-[160px]
      
      // Calculate position: below button, aligned to right edge
      let left = rect.right - dropdownWidth;
      
      // Ensure dropdown doesn't go off-screen to the left
      if (left < 8) {
        left = 8; // Add some padding from viewport edge
      }
      
      // Ensure dropdown doesn't go off-screen to the right
      if (rect.right > window.innerWidth - 8) {
        left = window.innerWidth - dropdownWidth - 8;
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
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (!isAdmin) {
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

  const dropdownContent = isOpen ? (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-black border-2 border-red-500 rounded-lg shadow-lg min-w-[160px] py-1"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
      }}
    >
      {listingId && (
        <>
          {isFeatured ? (
            <button
              onClick={handleRemoveFromFeatured}
              disabled={isLoading}
              className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333333] transition-colors whitespace-nowrap"
            >
              Remove from Featured
            </button>
          ) : (
            <button
              onClick={handleAddToFeatured}
              disabled={isLoading}
              className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333333] transition-colors whitespace-nowrap"
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
          className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#333333] transition-colors whitespace-nowrap"
        >
          Hide User
        </button>
      )}
    </div>
  ) : null;

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          ref={buttonRef}
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
      </div>
      {typeof document !== "undefined" && createPortal(dropdownContent, document.body)}
    </>
  );
}

