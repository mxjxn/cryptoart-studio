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
  // Check cache first (wrap in try-catch to handle database connection failures)
  try {
    const cached = await getUserFromCache(address);
    if (cached && cached.expiresAt > new Date() && cached.fid) {
      const name = cached.username || cached.displayName || cached.ensName;
      if (name) {
        console.log("[lookupNeynarByAddress] Using cached data for:", address);
        return {
          name,
          fid: cached.fid,
        };
      }
    }
  } catch (error) {
    // Database connection failure - log but continue to API lookup
    console.warn("[lookupNeynarByAddress] Cache lookup failed, falling back to API:", error instanceof Error ? error.message : String(error));
  }
  
  // Cache miss or expired - fetch from API
  console.log("[lookupNeynarByAddress] Starting lookup for address:", address);
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    console.warn(
      "[lookupNeynarByAddress] NEYNAR_API_KEY not configured, skipping Neynar lookup"
    );
    return null;
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address/?addresses=${address}`;
    console.log("[lookupNeynarByAddress] Fetching from URL:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "x-neynar-experimental": "false",
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    console.log(
      "[lookupNeynarByAddress] Response status:",
      response.status,
      response.statusText
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(
          "[lookupNeynarByAddress] No user found with this verified address (404)"
        );
        return null;
      }
      const errorText = await response.text();
      console.error(
        "[lookupNeynarByAddress] Neynar API error:",
        response.status,
        errorText
      );
      return null;
    }

    const data = await response.json();
    console.log(
      "[lookupNeynarByAddress] Response data keys:",
      Object.keys(data)
    );
    console.log(
      "[lookupNeynarByAddress] Full response data:",
      JSON.stringify(data, null, 2)
    );

    // The bulk-by-address endpoint returns an object with addresses as keys (lowercase)
    // Each address maps to an array of user objects
    // Response format: { "0x...": [{ object: "user", fid, username, display_name, ... }] }
    const addressLower = address.toLowerCase();
    console.log(
      "[lookupNeynarByAddress] Looking for address (lowercase):",
      addressLower
    );

    // Get users array for this address
    const users = data[addressLower];
    console.log(
      "[lookupNeynarByAddress] Users found:",
      users ? `Array with ${users.length} users` : "null/undefined"
    );

    if (users && Array.isArray(users) && users.length > 0) {
      // Use the first user found
      const user = users[0];
      console.log("[lookupNeynarByAddress] First user:", {
        fid: user.fid,
        username: user.username,
        display_name: user.display_name,
      });

      if (user && user.fid) {
        const name = user.username || user.display_name || `@${user.username}`;
        console.log("[lookupNeynarByAddress] Returning name:", name);
        
        // Cache the result for future use (wrap in try-catch to handle database connection failures)
        try {
          await cacheUserInfo(address, {
            fid: user.fid,
            username: user.username,
            displayName: user.display_name,
            pfpUrl: user.pfp_url,
            verifiedWallets: user.verified_addresses?.eth_addresses || [],
            source: 'neynar',
          });
        } catch (error) {
          // Database connection failure - log but don't fail the lookup
          console.warn("[lookupNeynarByAddress] Failed to cache user info:", error instanceof Error ? error.message : String(error));
        }
        
        return {
          name,
          fid: user.fid,
        };
      }
    }

    console.log("[lookupNeynarByAddress] No valid user found, returning null");
    return null;
  } catch (error) {
    console.error(
      "[lookupNeynarByAddress] Error looking up Neynar user by address:",
      error
    );
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
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    console.warn(
      "[lookupNeynarByUsername] NEYNAR_API_KEY not configured, skipping Neynar lookup"
    );
    return null;
  }

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
      "[lookupNeynarByUsername] Response data:",
      JSON.stringify(data, null, 2)
    );

    // The by_username endpoint returns a user object directly
    // Response format: { result: { user: { fid, username, display_name, pfp_url, verified_addresses, ... } } }
    const user = data.result?.user || data.user;
    
    if (user && user.fid) {
      const primaryAddress = user.verified_addresses?.eth_addresses?.[0];
      if (!primaryAddress) {
        console.log("[lookupNeynarByUsername] User found but no verified ETH address");
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

