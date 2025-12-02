/**
 * Manual artist name overrides for addresses that cannot be resolved via Neynar or ENS.
 * 
 * This is a server-side fallback that allows you to manually set artist names
 * for addresses until they claim their profile via Farcaster or set a display name.
 * 
 * Format: { [address in lowercase]: "Artist Name" }
 * 
 * Note: These overrides do NOT override:
 * - An artist's self-set display name
 * - A Farcaster-verified user's name
 * 
 * They are only used when no other name source is available.
 */
export const artistOverrides: Record<string, string> = {
  // Example entries (add your own):
  // "0x1234567890abcdef1234567890abcdef12345678": "Artist Name",
  // "0xabcdef1234567890abcdef1234567890abcdef12": "Another Artist",
};

/**
 * Get an override name for an address if one exists.
 * @param address - The Ethereum address to look up (case-insensitive)
 * @returns The override name if found, null otherwise
 */
export function getArtistOverride(address: string): string | null {
  const normalizedAddress = address.toLowerCase();
  return artistOverrides[normalizedAddress] || null;
}

