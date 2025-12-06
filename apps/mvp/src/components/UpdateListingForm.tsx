"use client";

import React, { useState, useEffect } from "react";

interface UpdateListingFormProps {
  currentStartTime: number | null; // Unix timestamp or null
  currentEndTime: number | null; // Unix timestamp or null
  onSubmit: (startTime: number | null, endTime: number | null) => void;
  onCancel: () => void;
  isLoading?: boolean;
  listingType: "INDIVIDUAL_AUCTION" | "FIXED_PRICE" | "OFFERS_ONLY" | "DYNAMIC_PRICE";
}

export function UpdateListingForm({
  currentStartTime,
  currentEndTime,
  onSubmit,
  onCancel,
  isLoading = false,
  listingType,
}: UpdateListingFormProps) {
  // Toggle between duration mode and specific dates mode
  const [useDuration, setUseDuration] = useState(false);
  
  // Duration mode: days and hours
  const [durationDays, setDurationDays] = useState(0);
  const [durationHours, setDurationHours] = useState(24);
  
  // Specific dates mode: calendar inputs
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Initialize form based on current values
  useEffect(() => {
    if (currentStartTime && currentEndTime) {
      // If we have specific start/end times, initialize in specific dates mode
      const start = new Date(currentStartTime * 1000);
      const end = new Date(currentEndTime * 1000);
      
      // Format as datetime-local (YYYY-MM-DDTHH:mm)
      const formatDateTime = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };
      
      setStartDate(formatDateTime(start));
      setEndDate(formatDateTime(end));
      setUseDuration(false);
    } else {
      // Default to duration mode if no specific times
      setUseDuration(true);
    }
  }, [currentStartTime, currentEndTime]);

  // Helper to adjust number input with min/max bounds
  const adjustNumber = (
    current: number,
    delta: number,
    min: number = 0,
    max: number = 999
  ): number => {
    return Math.max(min, Math.min(max, current + delta));
  };

  const handleDurationDaysChange = (delta: number) => {
    setDurationDays((prev) => adjustNumber(prev, delta, 0, 365));
  };

  const handleDurationHoursChange = (delta: number) => {
    setDurationHours((prev) => adjustNumber(prev, delta, 0, 23));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalStartTime: number | null = null;
    let finalEndTime: number | null = null;

    if (useDuration) {
      // Duration mode: Set duration from first bid
      // The contract uses absolute timestamps, so we set endTime to now + duration
      // This ensures the auction can run for at least the specified duration
      // If startTime = 0 (auction starts on first bid), the actual duration from first bid
      // will be the time remaining until endTime when the first bid is placed
      const now = Math.floor(Date.now() / 1000);
      const durationSeconds = durationDays * 24 * 60 * 60 + durationHours * 60 * 60;
      finalStartTime = currentStartTime || 0; // Keep current or 0 if not started
      finalEndTime = now + durationSeconds;
    } else {
      // Specific dates mode: convert datetime-local strings to Unix timestamps
      if (startDate) {
        finalStartTime = Math.floor(new Date(startDate).getTime() / 1000);
      } else {
        finalStartTime = currentStartTime || 0;
      }
      
      if (endDate) {
        finalEndTime = Math.floor(new Date(endDate).getTime() / 1000);
      } else {
        // End date is required
        alert("End date is required");
        return;
      }
    }

    // Validate that end time is after start time
    if (finalStartTime && finalEndTime && finalEndTime <= finalStartTime) {
      alert("End time must be after start time");
      return;
    }

    onSubmit(finalStartTime, finalEndTime);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-[#1a1a1a] border border-[#333333] rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">Update Listing Timeframe</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[#999999] hover:text-[#cccccc]"
        >
          Cancel
        </button>
      </div>

      {/* Toggle Switch */}
      <div className="flex items-center justify-between mb-4">
        <label className="text-xs text-[#cccccc]">Mode</label>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${!useDuration ? 'text-white' : 'text-[#666666]'}`}>
            Specific Dates
          </span>
          <button
            type="button"
            onClick={() => setUseDuration(!useDuration)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              useDuration ? 'bg-white' : 'bg-[#666666]'
            }`}
            role="switch"
            aria-checked={useDuration}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform ${
                useDuration ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-xs ${useDuration ? 'text-white' : 'text-[#666666]'}`}>
            Duration
          </span>
        </div>
      </div>

      {useDuration ? (
        // Duration Mode: Days and Hours inputs with up/down controls
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#cccccc] mb-2">
              Duration from first bid
            </label>
            <div className="flex items-center gap-3">
              {/* Days Input */}
              <div className="flex-1">
                <label className="block text-xs text-[#999999] mb-1">Days</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDurationDaysChange(-1)}
                    className="px-2 py-1 bg-[#333333] text-white rounded hover:bg-[#444444] text-xs"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Math.max(0, Math.min(365, parseInt(e.target.value) || 0)))}
                    className="flex-1 px-2 py-1 bg-black border border-[#333333] text-white text-sm text-center rounded focus:ring-2 focus:ring-white focus:border-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleDurationDaysChange(1)}
                    className="px-2 py-1 bg-[#333333] text-white rounded hover:bg-[#444444] text-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Hours Input */}
              <div className="flex-1">
                <label className="block text-xs text-[#999999] mb-1">Hours</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDurationHoursChange(-1)}
                    className="px-2 py-1 bg-[#333333] text-white rounded hover:bg-[#444444] text-xs"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={durationHours}
                    onChange={(e) => setDurationHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                    className="flex-1 px-2 py-1 bg-black border border-[#333333] text-white text-sm text-center rounded focus:ring-2 focus:ring-white focus:border-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleDurationHoursChange(1)}
                    className="px-2 py-1 bg-[#333333] text-white rounded hover:bg-[#444444] text-xs"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-[#666666] mt-1">
              Total: {durationDays} day{durationDays !== 1 ? 's' : ''}, {durationHours} hour{durationHours !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-[#999999] mt-1">
              This sets the end time based on the duration. The auction will end when this duration has elapsed, starting from when the first bid is placed.
            </p>
          </div>
        </div>
      ) : (
        // Specific Dates Mode: Calendar inputs for start and end dates
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#cccccc] mb-2">
              Start Time
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-black border border-[#333333] text-white text-sm rounded focus:ring-2 focus:ring-white focus:border-white"
            />
            <p className="text-xs text-[#666666] mt-1">
              Leave empty to start when first bid is placed
            </p>
          </div>

          <div>
            <label className="block text-xs text-[#cccccc] mb-2">
              End Time <span className="text-red-400">*</span>
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-black border border-[#333333] text-white text-sm rounded focus:ring-2 focus:ring-white focus:border-white"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isLoading || (useDuration && durationDays === 0 && durationHours === 0) || (!useDuration && !endDate)}
          className="flex-1 px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Updating..." : "Update Listing"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-[#333333] text-white text-sm font-medium tracking-[0.5px] hover:bg-[#444444] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

