import { formatDateAsDatetimeLocal, getDateTimeMinutesFromNow } from "~/components/create-listing/DateSelector";

const MIN_END_AFTER_START_MS = 60 * 60 * 1000;

/**
 * Temporary Kismet Casa team helper: earliest “soon” start (aligned with listing min picker / chain buffer).
 */
export function getKismetCasaImmediateStartDatetimeLocal(): string {
  return getDateTimeMinutesFromNow(10);
}

/**
 * Next local wall-clock `{ hour24, minute }` that is at least 1 hour after `startDatetimeLocal`
 * (datetime-local string, interpreted in the user’s local zone).
 */
export function getLocalWallClockAtLeastOneHourAfterStart(
  startDatetimeLocal: string,
  hour24: number,
  minute: number,
): string {
  const startMs = new Date(startDatetimeLocal).getTime();
  const minEnd = startMs + MIN_END_AFTER_START_MS;
  if (Number.isNaN(startMs)) {
    const fallback = new Date();
    fallback.setHours(hour24, minute, 0, 0);
    if (fallback.getTime() <= Date.now()) {
      fallback.setDate(fallback.getDate() + 1);
    }
    return formatDateAsDatetimeLocal(fallback);
  }
  const d = new Date(startMs);
  let c = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour24, minute, 0, 0);
  if (c.getTime() <= startMs) {
    c.setDate(c.getDate() + 1);
  }
  while (c.getTime() < minEnd) {
    c.setDate(c.getDate() + 1);
  }
  return formatDateAsDatetimeLocal(c);
}

/**
 * Start ≈ now+10m, end = **4:45 PM on the calendar day after** start (local wall clock),
 * bumped by whole days if needed so end is ≥ 1h after start.
 *
 * This matches “tomorrow 4:45 PM” when start is today; the previous implementation used
 * “next 4:45 PM”, which was **today** 4:45 PM whenever that was still ≥1h after start —
 * listing pages then showed ~5–6h to end instead of ~24h+.
 */
export function getKismetCasaShortcutScheduleTimes(): { start: string; end: string } {
  const start = getKismetCasaImmediateStartDatetimeLocal();
  const startMs = new Date(start).getTime();
  if (Number.isNaN(startMs)) {
    return {
      start,
      end: getLocalWallClockAtLeastOneHourAfterStart(start, 16, 45),
    };
  }
  const s = new Date(startMs);
  let endMs = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1, 16, 45, 0, 0).getTime();
  const minEnd = startMs + MIN_END_AFTER_START_MS;
  while (endMs < minEnd) {
    endMs += 24 * 60 * 60 * 1000;
  }
  return { start, end: formatDateAsDatetimeLocal(new Date(endMs)) };
}

/**
 * Comma-separated lowercased `0x` addresses from
 * `NEXT_PUBLIC_KISMET_CASA_FAMILY_WALLETS` (build-time / client bundle).
 */
export function parseKismetCasaFamilyWalletAllowlistFromEnv(): string[] {
  const raw = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_KISMET_CASA_FAMILY_WALLETS : "";
  if (!raw?.trim()) return [];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function viewerMatchesKismetCasaScheduleShortcut(viewerAddresses: string[]): boolean {
  const allowed = parseKismetCasaFamilyWalletAllowlistFromEnv();
  if (allowed.length === 0) return false;
  return viewerAddresses.some((a) => allowed.includes(a.toLowerCase()));
}
