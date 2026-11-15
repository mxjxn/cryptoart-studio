/**
 * Token URI for a studio mint.
 * A job id counts only after `usePinnedMedia` reports `mintEnabled`.
 * `devMetadataUri` is a no-job fallback for local checks (`ar://` or `https://`).
 */
export function mintTokenUri(input: {
  jobId: string | null;
  pin: { metadataUri: string | null; mintEnabled: boolean } | null;
  devMetadataUri?: string | null;
}): string | null {
  const jobId = input.jobId?.trim() || null;
  if (jobId) {
    if (!input.pin?.mintEnabled) return null;
    const uri = input.pin.metadataUri?.trim() ?? '';
    return uri || null;
  }
  const fallback = input.devMetadataUri?.trim() ?? '';
  if (fallback.startsWith('ar://') || fallback.startsWith('https://')) return fallback;
  return null;
}
