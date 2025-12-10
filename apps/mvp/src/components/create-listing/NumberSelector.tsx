"use client";

import { useState, useEffect } from "react";

interface NumberSelectorProps {
  value: string | number;
  onChange: (value: string) => void;
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
 * Prevents invalid values through UI constraints rather than alerts
 */
export function NumberSelector({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  label,
  placeholder,
  disabled = false,
  required = false,
}: NumberSelectorProps) {
  const [inputValue, setInputValue] = useState<string>(String(value || ""));

  // Sync input value when prop changes
  useEffect(() => {
    setInputValue(String(value || ""));
  }, [value]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    const clamped = parseAndClamp(newValue);
    if (clamped !== null) {
      // Format to appropriate decimal places based on step
      const decimals = step < 1 ? String(step).split(".")[1]?.length || 0 : 0;
      const formatted = decimals > 0 ? clamped.toFixed(decimals) : String(clamped);
      onChange(formatted);
    } else if (newValue === "") {
      // Allow empty temporarily for user typing
      onChange("");
    }
  };

  const handleInputBlur = () => {
    const clamped = parseAndClamp(inputValue);
    if (clamped !== null) {
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
  };

  const handleDecrement = () => {
    const current = parseFloat(String(value || min));
    const newValue = clampValue(current - step);
    const decimals = step < 1 ? String(step).split(".")[1]?.length || 0 : 0;
    const formatted = decimals > 0 ? newValue.toFixed(decimals) : String(newValue);
    setInputValue(formatted);
    onChange(formatted);
  };

  const currentNum = parseFloat(String(value || min));
  const isAtMin = currentNum <= min;
  const isAtMax = currentNum >= max;

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-[#cccccc] mb-2">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || isAtMin}
          className="w-10 h-10 flex items-center justify-center text-[#cccccc] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-[#333333] rounded hover:border-[#555555] transition-colors bg-black"
        >
          <span className="text-lg">−</span>
        </button>
        <input
          type="number"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="flex-1 px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black text-center"
        />
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || isAtMax}
          className="w-10 h-10 flex items-center justify-center text-[#cccccc] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-[#333333] rounded hover:border-[#555555] transition-colors bg-black"
        >
          <span className="text-lg">+</span>
        </button>
      </div>
    </div>
  );
}



