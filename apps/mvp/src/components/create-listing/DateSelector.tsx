"use client";

interface DateSelectorProps {
  value: string;
  onChange: (value: string) => void;
  min?: string; // datetime-local format: YYYY-MM-DDTHH:mm
  max?: string; // datetime-local format: YYYY-MM-DDTHH:mm
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * DateSelector component with min/max constraints
 * Prevents invalid date selections through HTML5 constraints
 */
export function DateSelector({
  value,
  onChange,
  min,
  max,
  label,
  required = false,
  disabled = false,
}: DateSelectorProps) {
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
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        className="w-full px-3 py-2 bg-black border border-[#333333] text-white text-sm rounded focus:ring-2 focus:ring-white focus:border-white"
      />
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




