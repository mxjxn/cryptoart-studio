/**
 * Helpers for `<input type="datetime-local">` values (no timezone in the string).
 * Browsers interpret them in the user's local timezone; contracts use UTC instants (Unix).
 */

export function getBrowserIanaTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  } catch {
    return "unknown";
  }
}

/** e.g. UTC+02:00 for the instant `d` in the user's local zone */
export function formatUtcOffsetLabelForLocalInstant(d: Date): string {
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

export type DatetimeLocalUtcSummary = {
  /** IANA zone, e.g. Europe/Rome */
  ianaZone: string;
  /** Offset at this wall-clock moment, e.g. UTC+02:00 */
  offsetLabel: string;
  /** ISO-8601 in Z (explicit UTC) */
  utcIso: string;
  /** Human-readable line in UTC for non-technical readers */
  utcReadable: string;
  unixSeconds: number;
};

/**
 * Parse a `datetime-local` string from the input value into the single UTC instant
 * the browser will use for `Date` (local interpretation).
 */
export function summarizeDatetimeLocalForUtc(value: string): DatetimeLocalUtcSummary | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const utcReadable =
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d) + " (UTC)";

  return {
    ianaZone: getBrowserIanaTimeZone(),
    offsetLabel: formatUtcOffsetLabelForLocalInstant(d),
    utcIso: d.toISOString(),
    utcReadable,
    unixSeconds: Math.floor(d.getTime() / 1000),
  };
}
