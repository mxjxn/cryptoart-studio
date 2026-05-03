/**
 * True when `value` is meant as a duration in whole seconds (digits only),
 * as from DurationSelector / useDuration — not a datetime-local string.
 *
 * `parseInt("2026-05-04T07:33", 10) === 2026` would wrongly classify ISO-like
 * dates as a ~2000s duration; require the entire trimmed string to be digits.
 */
export function isPlainDurationSecondsString(value: string): boolean {
  const t = value.trim();
  if (!t || !/^\d+$/.test(t)) return false;
  const n = parseInt(t, 10);
  return n > 0 && n < 100_000_000;
}
