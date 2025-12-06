"use client";

import React, { useEffect, useRef } from "react";
import type { EnrichedAuctionData } from "~/lib/types";
import { useAuthMode } from "~/hooks/useAuthMode";

interface ListingLoadingOverlayProps {
  auction: EnrichedAuctionData;
  gradient: string;
  cardElement: HTMLElement | null;
  onClose?: () => void;
}

export function ListingLoadingOverlay({
  auction,
  gradient,
  cardElement,
  onClose,
}: ListingLoadingOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { isMiniApp } = useAuthMode();

  useEffect(() => {
    // Prevent body scroll while overlay is shown
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const title = auction.title || `Listing #${auction.listingId}`;
  const viewTransitionName = `artwork-${auction.listingId}`;

  return (
    <div
      ref={overlayRef}
      className={`fixed z-50 flex items-center justify-center bg-black/95 animate-in fade-in duration-200 ${
        isMiniApp ? "inset-0" : "inset-0 md:inset-4 md:rounded-lg"
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Loading ${title}`}
    >
      {/* Image container - prevent clicks from closing */}
      <div
        className="w-full h-full flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {auction.image ? (
          <img
            src={auction.image}
            alt={title}
            className="max-w-full max-h-full object-contain"
            style={{
              viewTransitionName,
            }}
          />
        ) : (
          <div
            className="max-w-full max-h-full aspect-square rounded-lg"
            style={{
              background: gradient,
              viewTransitionName,
            }}
          />
        )}
      </div>

      {/* Loading overlay */}
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
        <div className="text-white text-sm font-medium">
          loading
          <span className="loading-dots">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </div>
      </div>
    </div>
  );
}


