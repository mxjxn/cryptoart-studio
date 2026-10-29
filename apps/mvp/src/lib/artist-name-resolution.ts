import { createPublicClient } from "viem";
import { mainnet } from "viem/chains";
import { HYPERSNAP_FARCASTER_URL, fetchFarcasterAccountByAddress, fetchFarcasterAccountsByAddress } from "../../../../packages/identity/src/farcasterDirectory";
import { getUserFromCache, cacheUserInfo } from "~/lib/server/user-cache";
import { mainnetTransport } from "~/lib/chain-rpc";

/**
 * Shared artist name resolution utilities.
 * Extracted from API route handler for reuse across the application.
 */

// Create a public client for ENS resolution (mainnet)
export const publicClient = createPublicClient({
  chain: mainnet,
  transport: mainnetTransport(),
});

/**
 * Lookup the Farcaster account that lists this ETH address.
 * A match means the address is custody or verified for that FID. It does not authorize posting.
 * The function name stays so existing callers keep working.
 */
export async function lookupNeynarByAddress(
  address: string
): Promise<{ name: string; fid: number } | null> {
  try {
    const cached = await getUserFromCache(address);
    if (cached && cached.expiresAt > new Date() && cached.fid) {
      const name = cached.username || cached.displayName || cached.ensName;
      if (name) {
        return { name, fid: cached.fid };
      }
    }
  } catch {
    // Cache lookup failed, continue to the directory
  }

  try {
    const account = await fetchFarcasterAccountByAddress(
      address,
      fetch,
      process.env.HYPERSNAP_BASE_URL || HYPERSNAP_FARCASTER_URL,
    );
    if (!account) return null;
    const name = account.username || account.displayName;
    if (!name) return null;

    try {
      await cacheUserInfo(address, {
        fid: account.fid,
        username: account.username,
        displayName: account.displayName,
        pfpUrl: account.pfpUrl,
        verifiedWallets: account.verifiedAddresses,
        source: 'hypersnap',
      });
    } catch {
      // Ignore cache errors
    }

    return { name, fid: account.fid };
  } catch {
    return null;
  }
}

/**
 * Lookup user by username using Neynar API
 * Returns user data including address, which can then be cached
 */
export async function lookupNeynarByUsername(
  username: string
): Promise<{
  address: string;
  fid: number;
  username: string;
  displayName: string | null;
  pfpUrl: string | null;
  verifiedWallets: string[];
} | null> {
  console.log(`[lookupNeynarByUsername] Starting lookup for username: "${username}"`);
  
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    console.error(
      "[lookupNeynarByUsername] NEYNAR_API_KEY not configured! This will cause profile lookup to fail."
    );
    return null;
  }
  console.log(`[lookupNeynarByUsername] API key is configured (length: ${apiKey.length})`)

  try {
    // Remove @ if present
    const cleanUsername = username.replace(/^@/, '').toLowerCase();
    const url = `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(cleanUsername)}`;
    console.log("[lookupNeynarByUsername] Fetching from URL:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "x-neynar-experimental": "false",
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    console.log(
      "[lookupNeynarByUsername] Response status:",
      response.status,
      response.statusText
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(
          "[lookupNeynarByUsername] No user found with this username (404)"
        );
        return null;
      }
      const errorText = await response.text();
      console.error(
        "[lookupNeynarByUsername] Neynar API error:",
        response.status,
        errorText
      );
      return null;
    }

    const data = await response.json();
    console.log(
      "[lookupNeynarByUsername] Raw response keys:",
      Object.keys(data)
    );
    console.log(
      "[lookupNeynarByUsername] data.result exists:",
      !!data.result,
      "data.user exists:",
      !!data.user
    );

    // The by_username endpoint returns a user object directly
    // Response format: { result: { user: { fid, username, display_name, pfp_url, verified_addresses, ... } } }
    const user = data.result?.user || data.user;
    
    console.log(`[lookupNeynarByUsername] Parsed user object:`, user ? {
      fid: user.fid,
      username: user.username,
      display_name: user.display_name,
      verified_addresses: user.verified_addresses,
    } : 'NOT FOUND');
    
    if (user && user.fid) {
      const primaryAddress = user.verified_addresses?.eth_addresses?.[0];
      console.log(`[lookupNeynarByUsername] Primary address:`, primaryAddress || 'NONE');
      
      if (!primaryAddress) {
        console.log("[lookupNeynarByUsername] User found but no verified ETH address - this is the problem!");
        return null;
      }

      const result = {
        address: primaryAddress.toLowerCase(),
        fid: user.fid,
        username: user.username,
        displayName: user.display_name || null,
        pfpUrl: user.pfp_url || null,
        verifiedWallets: (user.verified_addresses?.eth_addresses || []).map((addr: string) => addr.toLowerCase()),
      };

      // Cache the result for future use
      try {
        await cacheUserInfo(result.address, {
          fid: result.fid,
          username: result.username,
          displayName: result.displayName,
          pfpUrl: result.pfpUrl,
          verifiedWallets: result.verifiedWallets,
          source: 'neynar',
        });
      } catch (error) {
        // Database connection failure - log but don't fail the lookup
        console.warn("[lookupNeynarByUsername] Failed to cache user info:", error instanceof Error ? error.message : String(error));
      }

      return result;
    }

    console.log("[lookupNeynarByUsername] No valid user found, returning null");
    return null;
  } catch (error) {
    console.error(
      "[lookupNeynarByUsername] Error looking up Neynar user by username:",
      error
    );
    return null;
  }
}

/**
 * Every Farcaster handle that lists this ETH address.
 * A listing is not permission to post.
 */
export async function lookupAllFarcasterHandlesByAddress(
  address: string
): Promise<Array<{ fid: number; username: string; displayName: string | null; pfpUrl: string | null }>> {
  try {
    const accounts = await fetchFarcasterAccountsByAddress(
      address,
      fetch,
      process.env.HYPERSNAP_BASE_URL || HYPERSNAP_FARCASTER_URL,
    );
    return accounts.flatMap(account => account.username ? [{
      fid: account.fid,
      username: account.username,
      displayName: account.displayName,
      pfpUrl: account.pfpUrl,
    }] : []);
  } catch {
    return [];
  }
}

/**
 * Reverse resolve ENS name from address
 * Now checks cache first before making RPC calls
 */
export async function resolveEnsName(address: string): Promise<string | null> {
  // Check cache first (wrap in try-catch to handle database connection failures)
  try {
    const cached = await getUserFromCache(address);
    if (cached && cached.expiresAt > new Date() && cached.ensName) {
      console.log("[resolveEnsName] Using cached ENS name for:", address);
      return cached.ensName;
    }
  } catch (error) {
    // Database connection failure - log but continue to ENS lookup
    console.warn("[resolveEnsName] Cache lookup failed, falling back to ENS lookup:", error instanceof Error ? error.message : String(error));
  }
  
  try {
    const ensName = await publicClient.getEnsName({
      address: address as `0x${string}`,
    });
    
    // Cache the result if found (wrap in try-catch to handle database connection failures)
    if (ensName) {
      try {
        await cacheUserInfo(address, {
          ensName,
          source: 'ens',
        });
      } catch (error) {
        // Database connection failure - log but don't fail the lookup
        console.warn("[resolveEnsName] Failed to cache ENS name:", error instanceof Error ? error.message : String(error));
      }
    }
    
    return ensName;
  } catch (error) {
    console.error("Error resolving ENS name:", error);
    return null;
  }
}

