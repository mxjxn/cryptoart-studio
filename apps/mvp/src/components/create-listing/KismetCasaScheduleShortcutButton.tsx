"use client";

interface KismetCasaScheduleShortcutButtonProps {
  visible: boolean;
  onApply: () => void;
}

/** Temporary gated shortcut for Kismet Casa — remove when no longer needed. */
export function KismetCasaScheduleShortcutButton({ visible, onApply }: KismetCasaScheduleShortcutButtonProps) {
  if (!visible) return null;

  return (
    <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="mb-1.5 text-[11px] font-medium text-amber-950">Kismet Casa (temporary)</p>
      <p className="mb-2 text-[11px] leading-snug text-amber-900">
        Sets start to the earliest allowed slot (~10 min from now) and end to the next <strong>4:45 PM</strong> in your
        local time that is at least one hour after start.
      </p>
      <button
        type="button"
        onClick={onApply}
        className="rounded border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 shadow-sm transition-colors hover:bg-amber-100"
      >
        Apply Casa schedule (soon → 4:45 PM local)
      </button>
    </div>
  );
}
