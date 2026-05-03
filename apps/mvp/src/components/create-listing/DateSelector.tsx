"use client";

import { useState, useEffect, useMemo } from "react";
import { summarizeDatetimeLocalForUtc } from "~/lib/datetime-local-utc";

interface DateSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, error?: string) => void;
  min?: string; // datetime-local format: YYYY-MM-DDTHH:mm
  max?: string; // datetime-local format: YYYY-MM-DDTHH:mm
  label?: string;
  required?: boolean;
  disabled?: boolean;
  /** Show browser TZ + UTC instant + Unix (default true for create listing) */
  showUtcPreview?: boolean;
}

/**
 * DateSelector component with min/max constraints
 * Prevents invalid date selections through HTML5 constraints and shows validation errors
 */
export function DateSelector({
  value,
  onChange,
  onValidationChange,
  min,
  max,
  label,
  required = false,
  disabled = false,
  showUtcPreview = true,
}: DateSelectorProps) {
  const [hasBlurred, setHasBlurred] = useState(false);

  const utcSummary = useMemo(() => {
    if (!showUtcPreview || !value) return null;
    return summarizeDatetimeLocalForUtc(value);
  }, [value, showUtcPreview]);

  // Validation logic
  const validation = useMemo(() => {
    if (!value || value === "") {
      if (required) {
        return { isValid: false, error: "This field is required" };
      }
      return { isValid: true, error: undefined };
    }

    const selectedDate = new Date(value);
    const now = new Date();

    if (min) {
      const minDate = new Date(min);
      if (selectedDate < minDate) {
        return { isValid: false, error: "Date must be after the minimum allowed date" };
      }
    }

    if (max) {
      const maxDate = new Date(max);
      if (selectedDate > maxDate) {
        return { isValid: false, error: "Date must be before the maximum allowed date" };
      }
    }

    // Additional check: if required, ensure date is valid
    if (isNaN(selectedDate.getTime())) {
      return { isValid: false, error: "Please enter a valid date and time" };
    }

    return { isValid: true, error: undefined };
  }, [value, min, max, required]);

  // Notify parent of validation state
  useEffect(() => {
    onValidationChange?.(validation.isValid, validation.error);
  }, [validation.isValid, validation.error, onValidationChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    // Reset blur state when user changes value
    if (newValue) {
      setHasBlurred(false);
    }
  };

  const handleBlur = () => {
    setHasBlurred(true);
  };

  const showError = hasBlurred && !validation.isValid;

  return (
    <div>
      {label && <label className="mb-2 block text-xs text-neutral-700">{label}</label>}
      <input
        type="datetime-local"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        className={`w-full rounded border bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20 ${
          showError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-neutral-200"
        }`}
      />
      {showUtcPreview && (
        <div className="mt-2 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
          {utcSummary ? (
            <dl className="space-y-1.5">
              <div>
                <dt className="inline font-medium text-neutral-900">Your timezone</dt>
                <dd className="mt-0.5 font-mono text-[11px] text-neutral-800">
                  {utcSummary.ianaZone} ({utcSummary.offsetLabel} at this moment)
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-neutral-900">Same instant in UTC</dt>
                <dd className="mt-0.5 font-mono text-[11px] text-neutral-800">{utcSummary.utcIso}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-neutral-900">Readable (UTC)</dt>
                <dd className="mt-0.5 text-neutral-800">{utcSummary.utcReadable}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-neutral-900">Unix timestamp</dt>
                <dd className="mt-0.5 font-mono text-[11px] text-neutral-800">{utcSummary.unixSeconds}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-neutral-600">Choose a date and time to see the exact UTC instant and Unix value.</p>
          )}
        </div>
      )}
      {showError && validation.error && (
        <p className="mt-1 text-xs text-red-600">{validation.error}</p>
      )}
    </div>
  );
}

/**
 * Helper function to format current date/time for min constraint
 */
export function getMinDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Helper function to format date X years from now for max constraint
 */
export function getMaxDateTime(yearsFromNow: number = 10): string {
  const future = new Date();
  future.setFullYear(future.getFullYear() + yearsFromNow);
  const year = future.getFullYear();
  const month = String(future.getMonth() + 1).padStart(2, "0");
  const day = String(future.getDate()).padStart(2, "0");
  const hours = String(future.getHours()).padStart(2, "0");
  const minutes = String(future.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Helper function to format date X hours after a given datetime string
 */
export function getDateTimeAfterHours(datetimeStr: string, hours: number): string {
  const date = new Date(datetimeStr);
  date.setHours(date.getHours() + hours);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hrs = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hrs}:${mins}`;
}




