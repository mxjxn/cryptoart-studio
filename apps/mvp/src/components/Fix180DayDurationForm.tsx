"use client";

import React, { useState } from "react";

interface Fix180DayDurationFormProps {
  listingId: string;
  onSubmit: (durationSeconds: number) => void;
  isLoading?: boolean;
}

const DURATION_OPTIONS = [
  { label: "1 Day", seconds: 86400 },
  { label: "2 Days", seconds: 172800 },
  { label: "3 Days", seconds: 259200 },
  { label: "1 Week", seconds: 604800 },
];

export function Fix180DayDurationForm({
  listingId,
  onSubmit,
  isLoading = false,
}: Fix180DayDurationFormProps) {
  const [selectedDuration, setSelectedDuration] = useState<number>(DURATION_OPTIONS[3].seconds); // Default to 1 week

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(selectedDuration);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
      <div>
        <h3 className="text-sm font-medium text-red-400 mb-1">
          Fix Auction Duration
        </h3>
        <p className="text-xs text-red-300 mb-4">
          This auction was created with an incorrect 180-day duration. Please select a new duration to fix it. Once fixed, bidding will be enabled.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-[#cccccc] mb-2">
          Select Duration
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option.seconds}
              type="button"
              onClick={() => setSelectedDuration(option.seconds)}
              className={`px-4 py-3 text-sm rounded border transition-colors ${
                selectedDuration === option.seconds
                  ? "bg-white text-black border-white font-medium"
                  : "bg-[#1a1a1a] border-[#333333] text-white hover:border-[#555555]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Updating..." : "Fix Duration"}
      </button>

      <p className="text-xs text-[#999999] text-center">
        This will update the auction duration to {Math.floor(selectedDuration / 86400)} day{Math.floor(selectedDuration / 86400) !== 1 ? 's' : ''} from the first bid.
      </p>
    </form>
  );
}
