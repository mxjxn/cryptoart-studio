"use client";

import React from "react";
import type { EnrichedAuctionData } from "~/lib/types";
import { getListingDisplayStatus } from "~/lib/time-utils";

interface ListingChipsProps {
  auction: EnrichedAuctionData;
}

/**
 * Get color for status dot
 */
function getStatusColor(status: ReturnType<typeof getListingDisplayStatus>): string {
  switch (status) {
    case "cancelled":
      return "#6b7280"; // Gray
    case "not started":
      return "#fbbf24"; // Amber/Yellow
    case "active":
      return "#10b981"; // Green
    case "concluded":
      return "#3b82f6"; // Blue
    case "finalized":
      return "#8b5cf6"; // Purple
    default:
      return "#6b7280"; // Gray fallback
  }
}

/**
 * Get display text for status
 */
function getStatusText(status: ReturnType<typeof getListingDisplayStatus>): string {
  switch (status) {
    case "cancelled":
      return "Cancelled";
    case "not started":
      return "Not started";
    case "active":
      return "Active";
    case "concluded":
      return "Ended";
    case "finalized":
      return "Finalized";
    default:
      return "Unknown";
  }
}

export function ListingChips({ auction }: ListingChipsProps) {
  const displayStatus = getListingDisplayStatus(auction);
  const statusColor = getStatusColor(displayStatus);
  const statusText = getStatusText(displayStatus);

  return (
    <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full border border-white/10">
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: statusColor }}
      />
      <span className="text-[10px] font-medium tracking-[0.5px] text-white/90">
        {statusText}
      </span>
    </div>
  );
}

