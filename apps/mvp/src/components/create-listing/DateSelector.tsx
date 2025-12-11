"use client";

import { useState, useEffect, useMemo } from "react";

interface DateSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, error?: string) => void;
  min?: string; // datetime-local format: YYYY-MM-DDTHH:mm
  max?: string; // datetime-local format: YYYY-MM-DDTHH:mm
  label?: string;
  required?: boolean;
  disabled?: boolean;
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
}: DateSelectorProps) {
  const [hasBlurred, setHasBlurred] = useState(false);

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
      {label && (
        <label className="block text-xs text-[#cccccc] mb-2">
          {label}
        </label>
      )}
      <input
        type="datetime-local"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-black border text-white text-sm rounded focus:ring-2 focus:ring-white focus:border-white ${
          showError ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-[#333333]"
        }`}
      />
      {showError && validation.error && (
        <p className="mt-1 text-xs text-red-400">{validation.error}</p>
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




