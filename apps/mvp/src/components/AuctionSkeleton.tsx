"use client";

import React from "react";


export function AuctionSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white animate-pulse">
      {/* Header Placeholder */}
      <div className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
        <div className="w-8 h-8 bg-neutral-800 rounded-full" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-neutral-800 rounded-full" />
        </div>
      </div>

      {/* Back Button Area */}
      <div className="border-b border-[#333333]">
        <div className="container mx-auto px-5 py-2 max-w-4xl">
          <div className="w-16 h-5 bg-neutral-800 rounded" />
        </div>
      </div>

      <div className="container mx-auto px-5 py-4 max-w-4xl">
        {/* Banner Placeholder (optional) */}
        
        {/* Artwork Placeholder */}
        <div className="mb-4">
          <div className="w-full aspect-square bg-neutral-900 rounded-lg" />
        </div>

        {/* Title, Collection, Creator Placeholders */}
        <div className="mb-4 space-y-2">
          {/* Title */}
          <div className="h-8 bg-neutral-800 rounded w-3/4" />
          
          {/* Edition/Contract */}
          <div className="h-4 bg-neutral-800 rounded w-1/4" />
          
          {/* Creator Line */}
          <div className="flex items-center justify-between mt-2">
            <div className="h-4 bg-neutral-800 rounded w-1/3" />
            <div className="flex gap-2">
               <div className="w-8 h-8 bg-neutral-800 rounded-full" />
               <div className="w-24 h-8 bg-neutral-800 rounded-full" />
            </div>
          </div>
        </div>

        {/* Description Placeholder */}
        <div className="mb-8 space-y-2">
          <div className="h-3 bg-neutral-900 rounded w-full" />
          <div className="h-3 bg-neutral-900 rounded w-full" />
          <div className="h-3 bg-neutral-900 rounded w-5/6" />
        </div>
        
        {/* Action Button Placeholder */}
        <div className="w-full h-12 bg-neutral-800 rounded-md" />
      </div>
    </div>
  );
}
