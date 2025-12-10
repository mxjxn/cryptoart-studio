"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useAuthMode } from "~/hooks/useAuthMode";
import { formatEther } from "viem";
import type { ContractListing } from "~/lib/contracts/marketplace";
import { hasBid, isFinalized, getCancelWarning } from "~/lib/contracts/marketplace";

interface AdminCancelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (holdbackBPS: number) => void;
  listing: ContractListing | null;
  listingId: string;
  isLoading?: boolean;
  error?: Error | null;
}

export function AdminCancelDialog({
  isOpen,
  onClose,
  onConfirm,
  listing,
  listingId,
  isLoading = false,
  error = null,
}: AdminCancelDialogProps) {
  const { isMiniApp } = useAuthMode();
  const [holdbackBPS, setHoldbackBPS] = useState<number>(0);

  // Reset holdback when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setHoldbackBPS(0);
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  const warning = getCancelWarning(listing);
  const listingHasBid = listing ? hasBid(listing) : false;
  const listingIsFinalized = listing ? isFinalized(listing) : false;
  const bidAmount = listing?.bid.amount ?? 0n;

  const handleConfirm = () => {
    if (!isLoading && !listingIsFinalized) {
      onConfirm(holdbackBPS);
    }
  };

  const handleHoldbackChange = (value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      setHoldbackBPS(0);
    } else if (num < 0) {
      setHoldbackBPS(0);
    } else if (num > 1000) {
      setHoldbackBPS(1000);
    } else {
      setHoldbackBPS(num);
    }
  };

  return (
    <div
      className={`fixed z-50 flex items-center justify-center bg-black/95 animate-in fade-in duration-200 ${
        isMiniApp ? "inset-0" : "inset-0 md:inset-4 md:rounded-lg"
      }`}
      onClick={(e) => {
        if (!isLoading) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Cancel listing confirmation"
    >
      <div
        className="w-full max-w-md mx-4 bg-[#1a1a1a] border border-[#333333] rounded-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        {!isLoading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="space-y-4">
          {/* Header */}
          <div>
            <h2 className="text-xl font-light text-white mb-2">
              Cancel Listing
            </h2>
            <p className="text-sm text-[#999999]">
              Listing ID: {listingId}
            </p>
          </div>

          {/* Listing Details */}
          {listing && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#999999]">Seller:</span>
                <span className="text-white font-mono text-xs">
                  {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                </span>
              </div>
              {listingHasBid && (
                <div className="flex justify-between">
                  <span className="text-[#999999]">Current Bid:</span>
                  <span className="text-white">
                    {formatEther(bidAmount)} ETH
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Warning Message */}
          {warning && (
            <div
              className={`flex items-start gap-3 p-3 rounded-lg ${
                listingIsFinalized
                  ? "bg-red-500/10 border border-red-500/20"
                  : listingHasBid
                  ? "bg-yellow-500/10 border border-yellow-500/20"
                  : "bg-blue-500/10 border border-blue-500/20"
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  listingIsFinalized
                    ? "text-red-400"
                    : listingHasBid
                    ? "text-yellow-400"
                    : "text-blue-400"
                }`}
              />
              <p
                className={`text-sm ${
                  listingIsFinalized
                    ? "text-red-300"
                    : listingHasBid
                    ? "text-yellow-300"
                    : "text-blue-300"
                }`}
              >
                {warning}
              </p>
            </div>
          )}

          {/* Holdback Configuration (only if listing has bid) */}
          {listingHasBid && !listingIsFinalized && (
            <div className="space-y-2">
              <label className="block text-sm text-[#999999]">
                Holdback Percentage (optional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={holdbackBPS}
                  onChange={(e) => handleHoldbackChange(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 bg-black border border-[#333333] rounded text-white text-sm focus:outline-none focus:border-red-500 disabled:opacity-50"
                  placeholder="0"
                />
                <span className="text-sm text-[#999999]">BPS (max 1000 = 10%)</span>
              </div>
              <p className="text-xs text-[#666666]">
                Optional penalty percentage (in basis points) to holdback from bid refund.
                Leave at 0 for full refund.
              </p>
            </div>
          )}

          {/* Error state - listing already finalized */}
          {listingIsFinalized && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-300">
                This listing cannot be cancelled because it is already finalized.
              </p>
            </div>
          )}

          {/* Transaction error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-300">
                Error: {error.message || "Failed to cancel listing. Please try again."}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-[#333333] text-white rounded hover:bg-[#444444] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || listingIsFinalized}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Processing..." : "Confirm Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

