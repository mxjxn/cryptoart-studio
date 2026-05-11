import { createPublicClient, http, type Address, isAddress, zeroAddress } from "viem";
import { base, mainnet } from "viem/chains";

/** Minimal ERC20 ABI for OG price labels (symbol + decimals). */
export const OG_ERC20_ABI = [
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

export function isOgPaymentEth(tokenAddress: string | undefined | null): boolean {
  if (!tokenAddress) return true;
  return tokenAddress.toLowerCase() === zeroAddress.toLowerCase();
}

/**
 * Read ERC20 symbol/decimals on the chain where the listing settles (Base or Ethereum mainnet).
 */
export async function getOgErc20TokenInfo(
  tokenAddress: string,
  listingChainId: number
): Promise<{ symbol: string; decimals: number } | null> {
  if (isOgPaymentEth(tokenAddress) || !isAddress(tokenAddress)) {
    return null;
  }

  const onMainnet = listingChainId === 1;
  try {
    const publicClient = createPublicClient({
      chain: onMainnet ? mainnet : base,
      transport: http(
        onMainnet
          ? process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "https://eth.llamarpc.com"
          : process.env.NEXT_PUBLIC_RPC_URL ||
            process.env.RPC_URL ||
            process.env.NEXT_PUBLIC_BASE_RPC_URL ||
            "https://mainnet.base.org"
      ),
    });

    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress as Address,
        abi: OG_ERC20_ABI,
        functionName: "symbol",
      }),
      publicClient.readContract({
        address: tokenAddress as Address,
        abi: OG_ERC20_ABI,
        functionName: "decimals",
      }),
    ]);

    return {
      symbol: symbol as string,
      decimals: decimals as number,
    };
  } catch (error) {
    console.error(`[OG Image] Error fetching ERC20 token info:`, error);
    return null;
  }
}
