"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAdminMode } from "~/hooks/useAdminMode";
import { useIsAdminOnChain } from "~/hooks/useIsAdminOnChain";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI, CHAIN_ID, type ContractListing, canCancelListing } from "~/lib/contracts/marketplace";
import { AdminCancelDialog } from "./AdminCancelDialog";

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
  const { isAdminOnChain, isLoading: isAdminOnChainLoading } = useIsAdminOnChain();
  const { address } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Fetch listing data from contract
  const { data: listingData, isLoading: isListingLoading } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "getListing",
    args: listingId ? [Number(listingId)] : undefined,
    query: {
      enabled: !!listingId,
    },
  });

  const listing = listingData as ContractListing | undefined;

  // Cancel listing transaction
  const { writeContract: cancelListing, data: cancelHash, isPending: isCancelling, error: cancelError } = useWriteContract();
  const { isLoading: isConfirmingCancel, isSuccess: isCancelConfirmed } = useWaitForTransactionReceipt({
    hash: cancelHash,
  });

  // Check if user can cancel (must be admin on-chain)
  const canCancel = isAdminOnChain && listing && canCancelListing(listing);

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

  // Only show menu if user is admin (frontend check) or admin on-chain
  // We check both for better UX - frontend for immediate UI, on-chain for actual permissions
  if (!isAdmin && !isAdminOnChain) {
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

  const handleCancelListingClick = () => {
    if (!listingId || !canCancel) return;
    setShowCancelDialog(true);
    setIsOpen(false);
  };

  const handleCancelConfirm = async (holdbackBPS: number) => {
    if (!listingId || !address || !canCancel) return;
    
    try {
      await cancelListing({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'cancel',
        chainId: CHAIN_ID,
        args: [Number(listingId), holdbackBPS],
      });
      // Dialog will close on success via useEffect below
    } catch (error) {
      console.error("Error cancelling listing:", error);
      // Keep dialog open on error so user can retry
    }
  };

  const handleCancelDialogClose = () => {
    setShowCancelDialog(false);
  };

  // Handle successful cancellation
  useEffect(() => {
    if (isCancelConfirmed && listingId) {
      // Close dialog
      setShowCancelDialog(false);
      
      // Invalidate cache
      fetch('/api/auctions/invalidate-cache', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      }).catch(err => console.error('Error invalidating cache:', err));
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["admin", "featured"] });
      
      // Refresh router and navigate to home
      router.refresh();
      setTimeout(() => {
        router.push("/");
      }, 100);
    }
  }, [isCancelConfirmed, listingId, router, queryClient]);

  const isCancelLoading = isCancelling || isConfirmingCancel;

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
      {listingId && canCancel && (
        <button
          onClick={handleCancelListingClick}
          disabled={isLoading || isCancelLoading || isListingLoading || isAdminOnChainLoading}
          className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[#333333] transition-colors whitespace-nowrap"
          title={!isAdminOnChain ? "Admin verification in progress..." : undefined}
        >
          {isCancelLoading
            ? isConfirmingCancel
              ? "Confirming..."
              : "Cancelling..."
            : "Cancel Listing"}
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
          disabled={isLoading || isCancelLoading}
          title="Admin Options"
        >
          ...
        </button>
      </div>
      {typeof document !== "undefined" && createPortal(dropdownContent, document.body)}
      
      {/* Cancel Confirmation Dialog */}
      {listingId && (
        <AdminCancelDialog
          isOpen={showCancelDialog}
          onClose={handleCancelDialogClose}
          onConfirm={handleCancelConfirm}
          listing={listing ?? null}
          listingId={listingId}
          isLoading={isCancelling || isConfirmingCancel}
          error={cancelError}
        />
      )}
    </>
  );
}

