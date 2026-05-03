"use client";

import { useState, useEffect, useMemo } from "react";

interface NumberSelectorProps {
  value: string | number;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, error?: string) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * NumberSelector component with increment/decrement buttons and min/max constraints
 * Prevents invalid values through UI constraints and shows validation errors
 */
export function NumberSelector({
  value,
  onChange,
  onValidationChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  label,
  placeholder,
  disabled = false,
  required = false,
}: NumberSelectorProps) {
  const [inputValue, setInputValue] = useState<string>(String(value || ""));
  const [hasBlurred, setHasBlurred] = useState(false);

  // Sync input value when prop changes
  useEffect(() => {
    const strValue = String(value || "");
    if (strValue !== inputValue) {
      setInputValue(strValue);
      // Reset blur state when value is set externally
      if (strValue && parseFloat(strValue) >= min && parseFloat(strValue) <= max) {
        setHasBlurred(false);
      }
    }
  }, [value, min, max]);

  // Helper to clamp value within bounds
  const clampValue = (val: number): number => {
    return Math.max(min, Math.min(max, val));
  };

  // Helper to parse and validate input
  const parseAndClamp = (str: string): number | null => {
    if (str === "" || str === "-" || str === ".") return null;
    const num = parseFloat(str);
    if (isNaN(num)) return null;
    return clampValue(num);
  };

  // Validation logic
  const validation = useMemo(() => {
    if (!inputValue || inputValue === "") {
      if (required) {
        return { isValid: false, error: "This field is required" };
      }
      return { isValid: true, error: undefined };
    }

    const num = parseFloat(inputValue);
    if (isNaN(num)) {
      return { isValid: false, error: "Please enter a valid number" };
    }

    if (num < min) {
      return { isValid: false, error: `Value must be at least ${min}` };
    }

    if (num > max) {
      return { isValid: false, error: `Value must be at most ${max}` };
    }

    return { isValid: true, error: undefined };
  }, [inputValue, min, max, required]);

  // Notify parent of validation state
  useEffect(() => {
    onValidationChange?.(validation.isValid, validation.error);
  }, [validation.isValid, validation.error, onValidationChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Keep typing predictable by allowing partial numeric values during input.
    // Canonical formatting/clamping happens on blur.
    if (!/^-?\d*\.?\d*$/.test(newValue)) {
      return;
    }

    setInputValue(newValue);

    if (newValue === "") {
      onChange("");
      return;
    }

    const parsed = parseFloat(newValue);
    if (!isNaN(parsed)) {
      onChange(newValue);
    }
  };

  const handleInputBlur = () => {
    setHasBlurred(true);
    const clamped = parseAndClamp(inputValue);
    if (clamped !== null) {
      // Format to appropriate decimal places based on step
      const decimals = step < 1 ? String(step).split(".")[1]?.length || 0 : 0;
      const formatted = decimals > 0 ? clamped.toFixed(decimals) : String(clamped);
      setInputValue(formatted);
      onChange(formatted);
    } else {
      // If invalid, reset to min or empty
      if (required) {
        const formatted = step < 1 ? min.toFixed(String(step).split(".")[1]?.length || 0) : String(min);
        setInputValue(formatted);
        onChange(formatted);
      } else {
        setInputValue("");
        onChange("");
      }
    }
  };

  const handleIncrement = () => {
    const current = parseFloat(String(value || min));
    const newValue = clampValue(current + step);
    const decimals = step < 1 ? String(step).split(".")[1]?.length || 0 : 0;
    const formatted = decimals > 0 ? newValue.toFixed(decimals) : String(newValue);
    setInputValue(formatted);
    onChange(formatted);
    setHasBlurred(false); // Reset blur since we set a valid value
  };

  const handleDecrement = () => {
    const current = parseFloat(String(value || min));
    const newValue = clampValue(current - step);
    const decimals = step < 1 ? String(step).split(".")[1]?.length || 0 : 0;
    const formatted = decimals > 0 ? newValue.toFixed(decimals) : String(newValue);
    setInputValue(formatted);
    onChange(formatted);
    setHasBlurred(false); // Reset blur since we set a valid value
  };

  const currentNum = parseFloat(String(value || min));
  const isAtMin = currentNum <= min;
  const isAtMax = currentNum >= max;
  const showError = hasBlurred && !validation.isValid;

  return (
    <div>
      {label && (
        <label className="mb-2 block text-sm font-medium text-neutral-700 font-space-grotesk">{label}</label>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || isAtMin}
          className="flex h-10 w-10 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <span className="text-lg">−</span>
        </button>
        <div className="flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            inputMode={step < 1 ? "decimal" : "numeric"}
            className={`w-full rounded-lg border bg-white px-4 py-2 text-center text-neutral-900 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20 font-mono ${
              showError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-neutral-200"
            }`}
          />
          {showError && validation.error && (
            <p className="mt-1 text-xs text-red-600">{validation.error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || isAtMax}
          className="flex h-10 w-10 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <span className="text-lg">+</span>
        </button>
      </div>
    </div>
  );
}




