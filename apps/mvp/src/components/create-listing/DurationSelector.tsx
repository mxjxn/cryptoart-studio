"use client";

import { useState, useEffect } from "react";

interface DurationSelectorProps {
  value: number; // Duration in seconds
  onChange: (durationSeconds: number) => void;
  disabled?: boolean;
}

/**
 * DurationSelector component with week/day/hour counters
 * Converts duration in seconds to weeks/days/hours for display
 */
export function DurationSelector({ value, onChange, disabled = false }: DurationSelectorProps) {
  // Convert seconds to weeks, days, hours
  const secondsToComponents = (totalSeconds: number) => {
    const weeks = Math.floor(totalSeconds / (7 * 24 * 60 * 60));
    const days = Math.floor((totalSeconds % (7 * 24 * 60 * 60)) / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    return { weeks, days, hours };
  };

  const { weeks: initialWeeks, days: initialDays, hours: initialHours } = secondsToComponents(value);
  const [weeks, setWeeks] = useState(initialWeeks);
  const [days, setDays] = useState(initialDays);
  const [hours, setHours] = useState(initialHours);

  // Update local state when value prop changes
  useEffect(() => {
    const { weeks: w, days: d, hours: h } = secondsToComponents(value);
    setWeeks(w);
    setDays(d);
    setHours(h);
  }, [value]);

  // Helper to adjust number with min/max bounds
  const adjustNumber = (current: number, delta: number, min: number = 0, max: number = 999): number => {
    return Math.max(min, Math.min(max, current + delta));
  };

  // Convert weeks/days/hours back to seconds and notify parent
  const updateDuration = (w: number, d: number, h: number) => {
    const totalSeconds = w * 7 * 24 * 60 * 60 + d * 24 * 60 * 60 + h * 60 * 60;
    onChange(totalSeconds);
  };

  const handleWeeksChange = (delta: number) => {
    const newWeeks = adjustNumber(weeks, delta, 0, 52);
    setWeeks(newWeeks);
    updateDuration(newWeeks, days, hours);
  };

  const handleDaysChange = (delta: number) => {
    const newDays = adjustNumber(days, delta, 0, 6); // Max 6 days (weeks handles 7+)
    setDays(newDays);
    updateDuration(weeks, newDays, hours);
  };

  const handleHoursChange = (delta: number) => {
    const newHours = adjustNumber(hours, delta, 0, 23);
    setHours(newHours);
    updateDuration(weeks, days, newHours);
  };

  const NumberCounter = ({
    value,
    onIncrement,
    onDecrement,
    label,
    max,
  }: {
    value: number;
    onIncrement: () => void;
    onDecrement: () => void;
    label: string;
    max: number;
  }) => (
    <div className="flex flex-col items-center gap-1">
      <label className="text-xs text-neutral-600">{label}</label>
      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={onIncrement}
          disabled={disabled || value >= max}
          className="flex h-6 w-8 items-center justify-center rounded-t border border-neutral-200 bg-white text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <span className="text-sm">^</span>
        </button>
        <div className="flex h-10 w-12 items-center justify-center border border-neutral-200 bg-neutral-50 font-mono text-sm text-neutral-900">
          {value}
        </div>
        <button
          type="button"
          onClick={onDecrement}
          disabled={disabled || value <= 0}
          className="flex h-6 w-8 items-center justify-center rounded-b border border-neutral-200 bg-white text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <span className="text-sm">v</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-4">
      <NumberCounter
        value={weeks}
        onIncrement={() => handleWeeksChange(1)}
        onDecrement={() => handleWeeksChange(-1)}
        label="weeks"
        max={52}
      />
      <NumberCounter
        value={days}
        onIncrement={() => handleDaysChange(1)}
        onDecrement={() => handleDaysChange(-1)}
        label="days"
        max={6}
      />
      <NumberCounter
        value={hours}
        onIncrement={() => handleHoursChange(1)}
        onDecrement={() => handleHoursChange(-1)}
        label="hours"
        max={23}
      />
    </div>
  );
}
