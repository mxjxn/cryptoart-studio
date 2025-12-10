import { createPublicClient, http, type Address, isAddress } from "viem";
import { base } from "viem/chains";
import { GALLERY_ACCESS_NFT_CONTRACT_ADDRESS } from "~/lib/constants";
import { isAdminAddress } from "~/lib/server/admin";

// Standard ERC721/ERC1155 ABI for balanceOf
const NFT_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// Create a public client for Base chain (server-side)
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

/**
 * Check if an address has NFT balance > 0
 */
async function checkAddressBalance(address: Address): Promise<boolean> {
  try {
    const balance = await publicClient.readContract({
      address: GALLERY_ACCESS_NFT_CONTRACT_ADDRESS,
      abi: NFT_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    return balance > 0n;
  } catch (error) {
    console.error(`[checkAddressBalance] Error checking balance for ${address}:`, error);
    return false;
  }
}

/**
 * Get verified addresses for a user from Neynar API
 */
async function getVerifiedAddresses(address: Address): Promise<Address[]> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return [address]; // Fallback to just the provided address
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
      return [address];
    }

    const data = await response.json();
    const addressLower = address.toLowerCase();
    const users = data[addressLower];

    if (users && Array.isArray(users) && users.length > 0) {
      const user = users[0];
      const verifiedAddresses: Address[] = [address]; // Always include the provided address
      
      // Add verified addresses from Farcaster
      if (user.verified_addresses?.eth_addresses) {
        for (const addr of user.verified_addresses.eth_addresses) {
          if (isAddress(addr)) {
            const addrLower = addr.toLowerCase();
            if (addrLower !== address.toLowerCase()) {
              verifiedAddresses.push(addr as Address);
            }
          }
        }
      }
      
      // Add custody address
      if (user.custody_address && isAddress(user.custody_address)) {
        const custodyLower = user.custody_address.toLowerCase();
        if (!verifiedAddresses.some(a => a.toLowerCase() === custodyLower)) {
          verifiedAddresses.push(user.custody_address as Address);
        }
      }
      
      return verifiedAddresses;
    }

    return [address];
  } catch (error) {
    console.error(`[getVerifiedAddresses] Error fetching verified addresses for ${address}:`, error);
    return [address]; // Fallback to just the provided address
  }
}

/**
 * Server-side check if a user has access to galleries (balanceOf > 0 or admin).
 * 
 * Admin users always have access. For non-admins:
 * - Checks multiple addresses:
 *   1. The provided address
 *   2. Any verifiedAddresses provided by the client (from client-side hook)
 *   3. Falls back to fetching verified addresses from Neynar API if verifiedAddresses not provided
 * 
 * @param address - The primary wallet address
 * @param verifiedAddresses - Optional array of verified addresses that have NFT (from client-side hook)
 * @returns true if user is admin or any address has balanceOf > 0, false otherwise
 */
export async function hasGalleryAccess(
  address: Address,
  verifiedAddresses?: string[]
): Promise<boolean> {
  // Check if user is admin first - admins always have access
  if (isAdminAddress(address)) {
    return true;
  }
  
  try {
    // If client provided verified addresses that have NFT, check those first (trust but verify)
    if (verifiedAddresses && verifiedAddresses.length > 0) {
      const addressesToCheck = verifiedAddresses
        .filter(addr => isAddress(addr))
        .map(addr => addr.toLowerCase() as Address);
      
      // Also include the primary address
      const primaryLower = address.toLowerCase();
      if (!addressesToCheck.includes(primaryLower as Address)) {
        addressesToCheck.push(primaryLower as Address);
      }
      
      // Check all provided addresses
      for (const addr of addressesToCheck) {
        if (await checkAddressBalance(addr)) {
          return true;
        }
      }
    }
    
    // If no verified addresses provided or none had NFT, check the primary address
    if (await checkAddressBalance(address)) {
      return true;
    }
    
    // As a fallback, try to get verified addresses from Neynar and check them
    // (This helps when client doesn't provide verifiedAddresses, e.g., direct API calls)
    const allVerifiedAddresses = await getVerifiedAddresses(address);
    for (const addr of allVerifiedAddresses) {
      if (addr.toLowerCase() !== address.toLowerCase() && await checkAddressBalance(addr)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`[hasGalleryAccess] Error checking access for ${address}:`, error);
    // Fail closed - if we can't verify, deny access
    return false;
  }
}
