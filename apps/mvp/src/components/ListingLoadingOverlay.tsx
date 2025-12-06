"use client";

import React, { useEffect, useState, useRef } from "react";
import type { EnrichedAuctionData } from "~/lib/types";

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
  const [cardPosition, setCardPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardElement) return;

    // Get the card's position and dimensions
    const rect = cardElement.getBoundingClientRect();
    setCardPosition({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    });

    // Prevent body scroll while overlay is shown
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [cardElement]);

  if (!cardPosition) return null;

  // Calculate enlarged dimensions (slightly larger)
  const scale = 1.1;
  const enlargedWidth = cardPosition.width * scale;
  const enlargedHeight = cardPosition.height * scale;
  const offsetX = (enlargedWidth - cardPosition.width) / 2;
  const offsetY = (enlargedHeight - cardPosition.height) / 2;

  const title = auction.title || `Listing #${auction.listingId}`;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/60 animate-in fade-in duration-100"
      onClick={onClose}
    >
      {/* Enlarged card */}
      <div
        className="absolute transition-all duration-300 ease-out"
        style={{
          top: `${cardPosition.top - offsetY}px`,
          left: `${cardPosition.left - offsetX}px`,
          width: `${enlargedWidth}px`,
          height: `${enlargedHeight}px`,
        }}
      >
        <div
          className="w-full h-full relative overflow-hidden"
          style={{
            background: auction.image
              ? `url(${auction.image}) center/cover`
              : gradient,
          }}
        >
          {/* Loading overlay on the card */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
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
      </div>
    </div>
  );
}


