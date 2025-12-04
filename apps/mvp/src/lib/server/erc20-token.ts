import { createPublicClient, http, type Address, isAddress, zeroAddress } from "viem";
import { base } from "viem/chains";

// Standard ERC20 ABI for the functions we need
const ERC20_ABI = [
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;

export interface ERC20TokenInfo {
  symbol: string | null;
  decimals: number;
  isValid: boolean;
}

/**
 * Check if an address represents ETH (zero address or undefined)
 */
function isETH(tokenAddress: string | undefined | null): boolean {
  if (!tokenAddress) return true;
  return tokenAddress.toLowerCase() === zeroAddress.toLowerCase();
}

/**
 * Server-side ERC20 token information fetching.
 * Fetches symbol and decimals for a given ERC20 token address.
 * 
 * @param tokenAddress - The ERC20 token address to query
 * @returns Token info with symbol and decimals, or defaults for ETH
 */
export async function getERC20TokenInfoServer(
  tokenAddress: string | undefined | null
): Promise<ERC20TokenInfo> {
  // If no address or zero address, it's ETH
  if (isETH(tokenAddress)) {
    return {
      symbol: "ETH",
      decimals: 18,
      isValid: true,
    };
  }

  // Validate address format
  if (!tokenAddress || !isAddress(tokenAddress)) {
    return {
      symbol: null,
      decimals: 18,
      isValid: false,
    };
  }

  const address = tokenAddress as Address;

  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(
        process.env.RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"
      ),
    });

    // Fetch symbol and decimals in parallel
    const [symbolResult, decimalsResult] = await Promise.all([
      publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: "symbol",
      }).catch(() => null),
      publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: "decimals",
      }).catch(() => null),
    ]);

    const symbol = symbolResult && typeof symbolResult === "string" ? symbolResult : null;
    const decimals = decimalsResult && typeof decimalsResult === "number" ? decimalsResult : 18;

    if (!symbol) {
      return {
        symbol: null,
        decimals,
        isValid: false,
      };
    }

    return {
      symbol,
      decimals,
      isValid: true,
    };
  } catch (error) {
    console.error(`[getERC20TokenInfoServer] Error fetching ERC20 token info for ${tokenAddress}:`, error);
    return {
      symbol: null,
      decimals: 18,
      isValid: false,
    };
  }
}

