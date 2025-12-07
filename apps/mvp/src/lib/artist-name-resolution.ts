import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { getUserFromCache, cacheUserInfo } from "~/lib/server/user-cache";

/**
 * Shared artist name resolution utilities.
 * Extracted from API route handler for reuse across the application.
 */

// Create a public client for ENS resolution (mainnet)
export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "https://eth.llamarpc.com"),
});

/**
 * Lookup user by verified ETH address using Neynar API
 * Uses the bulk-by-address endpoint which is more reliable
 * Now checks cache first before making API calls
 */
export async function lookupNeynarByAddress(
  address: string
): Promise<{ name: string; fid: number } | null> {
  // Check cache first
  try {
    const cached = await getUserFromCache(address);
    if (cached && cached.expiresAt > new Date() && cached.fid) {
      const name = cached.username || cached.displayName || cached.ensName;
      if (name) {
        return { name, fid: cached.fid };
      }
    }
  } catch {
    // Cache lookup failed, continue to API
  }
  
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address/?addresses=${address}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "x-neynar-experimental": "false",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const addressLower = address.toLowerCase();
    const users = data[addressLower];

    if (users && Array.isArray(users) && users.length > 0) {
      const user = users[0];
      if (user && user.fid) {
        const name = user.username || user.display_name || `@${user.username}`;
        
        // Cache the result
        try {
          await cacheUserInfo(address, {
            fid: user.fid,
            username: user.username,
            displayName: user.display_name,
            pfpUrl: user.pfp_url,
            verifiedWallets: user.verified_addresses?.eth_addresses || [],
            source: 'neynar',
          });
        } catch {
          // Ignore cache errors
        }
        
        return { name, fid: user.fid };
      }
    }

    return null;
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
 * Lookup all Farcaster handles associated with a verified ETH address
 * Uses the bulk-by-address endpoint which returns an array of all users with that address
 * Returns array of all Farcaster handles, not just the first one
 */
export async function lookupAllFarcasterHandlesByAddress(
  address: string
): Promise<Array<{ fid: number; username: string; displayName: string | null; pfpUrl: string | null }>> {
  console.log("[lookupAllFarcasterHandlesByAddress] Starting lookup for address:", address);
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    console.warn(
      "[lookupAllFarcasterHandlesByAddress] NEYNAR_API_KEY not configured, skipping Neynar lookup"
    );
    return [];
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address/?addresses=${address}`;
    console.log("[lookupAllFarcasterHandlesByAddress] Fetching from URL:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "x-neynar-experimental": "false",
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    console.log(
      "[lookupAllFarcasterHandlesByAddress] Response status:",
      response.status,
      response.statusText
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(
          "[lookupAllFarcasterHandlesByAddress] No users found with this verified address (404)"
        );
        return [];
      }
      const errorText = await response.text();
      console.error(
        "[lookupAllFarcasterHandlesByAddress] Neynar API error:",
        response.status,
        errorText
      );
      return [];
    }

    const data = await response.json();
    const addressLower = address.toLowerCase();
    console.log(
      "[lookupAllFarcasterHandlesByAddress] Looking for address (lowercase):",
      addressLower
    );

    // Get users array for this address
    const users = data[addressLower];
    console.log(
      "[lookupAllFarcasterHandlesByAddress] Users found:",
      users ? `Array with ${users.length} users` : "null/undefined"
    );

    if (users && Array.isArray(users) && users.length > 0) {
      // Return all users, not just the first one
      const handles = users
        .filter((user: any) => user && user.fid && user.username)
        .map((user: any) => ({
          fid: user.fid,
          username: user.username,
          displayName: user.display_name || null,
          pfpUrl: user.pfp_url || null,
        }));

      console.log(
        "[lookupAllFarcasterHandlesByAddress] Returning",
        handles.length,
        "handles"
      );
      return handles;
    }

    console.log("[lookupAllFarcasterHandlesByAddress] No valid users found, returning empty array");
    return [];
  } catch (error) {
    console.error(
      "[lookupAllFarcasterHandlesByAddress] Error looking up Neynar users by address:",
      error
    );
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

