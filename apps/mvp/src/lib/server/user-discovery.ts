import { lookupNeynarByAddress, resolveEnsName } from "~/lib/artist-name-resolution";
import { getUserFromCache, cacheUserInfo } from "~/lib/server/user-cache";
import type { UserCacheData } from "@cryptoart/db";

/**
 * User Discovery Service
 * 
 * Centralized service to discover and cache user data for any Ethereum address.
 * This ensures that whenever we encounter an address (seller, bidder, buyer, contract creator),
 * we proactively look it up via Neynar/ENS and cache it in the database.
 */

export interface DiscoveredUserData {
  address: string;
  fid?: number;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
  verifiedWallets?: string[];
  ensName?: string | null;
  source: 'neynar' | 'ens' | 'cached' | null;
}

/**
 * Discover and cache user data for an address
 * 
 * This function:
 * 1. Checks cache first (returns immediately if found and valid)
 * 2. Tries Neynar lookup (Farcaster)
 * 3. Falls back to ENS lookup
 * 4. Caches the result
 * 5. Returns user data
 * 
 * @param address - Ethereum address to discover
 * @param options - Optional configuration
 * @returns User data or null if not found
 */
export async function discoverAndCacheUser(
  address: string,
  options: {
    /**
     * If true, only check cache and don't make API calls
     * Useful for non-critical lookups where we don't want to block
     */
    cacheOnly?: boolean;
    /**
     * If true, don't throw errors, just return null
     * Default: true (fail gracefully)
     */
    failSilently?: boolean;
  } = {}
): Promise<DiscoveredUserData | null> {
  const { cacheOnly = false, failSilently = true } = options;
  const normalizedAddress = address.toLowerCase();

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedAddress)) {
    if (failSilently) {
      return null;
    }
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  try {
    // Step 1: Check cache first
    const cached = await getUserFromCache(normalizedAddress);
    if (cached && cached.expiresAt > new Date()) {
      // Cache hit - no logging needed
      return {
        address: normalizedAddress,
        fid: cached.fid || undefined,
        username: cached.username || null,
        displayName: cached.displayName || null,
        pfpUrl: cached.pfpUrl || null,
        verifiedWallets: (cached.verifiedWallets as string[] | null) || undefined,
        ensName: cached.ensName || null,
        source: 'cached',
      };
    }

    // If cache-only mode, return null if not in cache
    if (cacheOnly) {
      return null;
    }

    // Step 2: Try Neynar lookup (Farcaster)
    const neynarResult = await lookupNeynarByAddress(normalizedAddress);
    
    if (neynarResult) {
      // Neynar lookup already caches the result, so we can return
      // But we need to get the full cached data
      const cachedAfterNeynar = await getUserFromCache(normalizedAddress);
      if (cachedAfterNeynar) {
        return {
          address: normalizedAddress,
          fid: cachedAfterNeynar.fid || undefined,
          username: cachedAfterNeynar.username || null,
          displayName: cachedAfterNeynar.displayName || null,
          pfpUrl: cachedAfterNeynar.pfpUrl || null,
          verifiedWallets: (cachedAfterNeynar.verifiedWallets as string[] | null) || undefined,
          ensName: cachedAfterNeynar.ensName || null,
          source: 'neynar',
        };
      }
    }

    // Step 3: Fallback to ENS lookup
    const ensName = await resolveEnsName(normalizedAddress);
    
    if (ensName) {
      // ENS lookup already caches the result
      const cachedAfterEns = await getUserFromCache(normalizedAddress);
      if (cachedAfterEns) {
        return {
          address: normalizedAddress,
          fid: cachedAfterEns.fid || undefined,
          username: cachedAfterEns.username || null,
          displayName: cachedAfterEns.displayName || null,
          pfpUrl: cachedAfterEns.pfpUrl || null,
          verifiedWallets: (cachedAfterEns.verifiedWallets as string[] | null) || undefined,
          ensName: cachedAfterEns.ensName || null,
          source: 'ens',
        };
      }
    }

    // Step 4: No data found - cache a null result to avoid repeated lookups
    // We'll cache with minimal data to indicate we've tried
    if (!cached) {
      await cacheUserInfo(normalizedAddress, {
        source: 'neynar', // Use neynar as source even though lookup failed
      });
    }

    return null;
  } catch (error) {
    // Only log actual errors, not cache misses
    
    if (failSilently) {
      return null;
    }
    
    throw error;
  }
}

/**
 * Discover and cache multiple users in parallel
 * Useful for batch operations like processing listings or bids
 * 
 * @param addresses - Array of Ethereum addresses to discover
 * @param options - Optional configuration
 * @returns Map of address -> user data (or null if not found)
 */
export async function discoverAndCacheUsers(
  addresses: string[],
  options: {
    cacheOnly?: boolean;
    failSilently?: boolean;
  } = {}
): Promise<Map<string, DiscoveredUserData | null>> {
  const results = new Map<string, DiscoveredUserData | null>();
  
  // Process in parallel but limit concurrency to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (address) => {
        const result = await discoverAndCacheUser(address, options);
        return { address: address.toLowerCase(), result };
      })
    );
    
    batchResults.forEach(({ address, result }) => {
      results.set(address, result);
    });
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < addresses.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Discover user in background (non-blocking)
 * Useful for non-critical lookups where we don't want to block the main flow
 * 
 * @param address - Ethereum address to discover
 */
export function discoverAndCacheUserBackground(address: string): void {
  // Fire and forget - don't await
  discoverAndCacheUser(address, { failSilently: true }).catch(() => {
    // Silently ignore background lookup failures
  });
}

