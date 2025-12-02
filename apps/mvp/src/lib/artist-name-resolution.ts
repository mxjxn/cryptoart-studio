import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

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
 */
export async function lookupNeynarByAddress(
  address: string
): Promise<{ name: string; fid: number } | null> {
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
 * Reverse resolve ENS name from address
 */
export async function resolveEnsName(address: string): Promise<string | null> {
  try {
    const ensName = await publicClient.getEnsName({
      address: address as `0x${string}`,
    });
    return ensName;
  } catch (error) {
    console.error("Error resolving ENS name:", error);
    return null;
  }
}

