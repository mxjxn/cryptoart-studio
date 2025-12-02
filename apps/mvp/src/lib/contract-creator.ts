import { type Address, createPublicClient, http, isAddress } from "viem";
import { base } from "viem/chains";
import { CHAIN_ID } from "./contracts/marketplace";

/**
 * Contract creator lookup utilities.
 * 
 * Tries multiple methods to find the contract creator:
 * 1. Etherscan/Basescan API - Gets the contract deployer from blockchain explorer
 * 2. owner() - Most common, typically returns deployer
 * 3. creator() - Some contracts have dedicated creator function
 * 4. royaltyInfo() - ERC2981 royalty recipient (often the creator)
 */

// ABI for owner() function (standard Ownable pattern)
const OWNER_ABI = [
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

// ABI for creator() function (some custom contracts)
const CREATOR_ABI = [
  {
    type: "function",
    name: "creator",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

// ABI for ERC2981 royaltyInfo() - returns (receiver, royaltyAmount)
const ROYALTY_INFO_ABI = [
  {
    type: "function",
    name: "royaltyInfo",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "salePrice", type: "uint256" },
    ],
    outputs: [
      { name: "receiver", type: "address" },
      { name: "royaltyAmount", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;

// Create public client for Base (where contracts are deployed)
const getPublicClient = () => {
  return createPublicClient({
    chain: base,
    transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
  });
};

export interface ContractCreatorResult {
  creator: Address | null;
  source: "etherscan" | "owner" | "creator" | "royalty" | null;
}

/**
 * Get contract creator from Etherscan API
 * This is the most reliable method as it gets the actual deployer address
 * Supports multiple chains via the chainid parameter (1 for Ethereum, 8453 for Base, etc.)
 */
async function getContractCreatorFromEtherscan(
  contractAddress: string,
  chainId: number = CHAIN_ID
): Promise<Address | null> {
  console.log('[getContractCreatorFromEtherscan] Starting lookup for contract:', contractAddress, 'chainId:', chainId);
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    console.warn('[getContractCreatorFromEtherscan] ETHERSCAN_API_KEY not set, skipping Etherscan API lookup');
    return null;
  }

  try {
    // Etherscan API supports multiple chains via the chainid parameter
    // Use the same endpoint for all supported chains (Ethereum, Base, etc.)
    const baseUrl = 'https://api.etherscan.io/v2/api';
    
    const url = `${baseUrl}?apikey=${apiKey}&chainid=${chainId}&module=contract&action=getcontractcreation&contractaddresses=${contractAddress}`;
    console.log('[getContractCreatorFromEtherscan] Fetching from URL:', url.replace(apiKey, 'REDACTED'));
    
    const response = await fetch(url, { method: 'GET' });
    console.log('[getContractCreatorFromEtherscan] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[getContractCreatorFromEtherscan] Etherscan API returned ${response.status} for ${contractAddress}:`, errorText);
      return null;
    }

    const data = await response.json();
    console.log('[getContractCreatorFromEtherscan] Response data:', JSON.stringify(data, null, 2));
    
    // Etherscan API response structure:
    // { status: "1", message: "OK", result: [{ contractAddress: "...", contractCreator: "...", txHash: "..." }] }
    if (data.status === "1" && data.result && data.result.length > 0) {
      const creator = data.result[0].contractCreator;
      console.log('[getContractCreatorFromEtherscan] Found creator:', creator);
      if (creator && isAddress(creator)) {
        const normalizedCreator = creator.toLowerCase() as Address;
        console.log('[getContractCreatorFromEtherscan] Returning normalized creator:', normalizedCreator);
        return normalizedCreator;
      }
    }
    
    console.log('[getContractCreatorFromEtherscan] No creator found in response');
    return null;
  } catch (error) {
    console.error(`[getContractCreatorFromEtherscan] Error fetching from Etherscan API for ${contractAddress}:`, error);
    return null;
  }
}

/**
 * Get contract creator using Etherscan API first, then on-chain methods as fallback.
 * Tries Etherscan API, then owner(), creator(), and royaltyInfo() in order.
 * 
 * @param contractAddress - The contract address to query
 * @param tokenId - Optional token ID for royaltyInfo lookup (uses 0 if not provided)
 * @returns Creator address and the method that found it
 */
export async function getContractCreator(
  contractAddress: string,
  tokenId?: bigint | number
): Promise<ContractCreatorResult> {
  if (!isAddress(contractAddress)) {
    return { creator: null, source: null };
  }

  const address = contractAddress as Address;

  // 1. Try Etherscan/Basescan API first (most reliable - gets actual deployer)
  console.log(`[getContractCreator] Trying Etherscan API for ${contractAddress}`);
  try {
    const etherscanCreator = await getContractCreatorFromEtherscan(address, CHAIN_ID);
    console.log(`[getContractCreator] Etherscan API result:`, etherscanCreator);
    if (etherscanCreator && etherscanCreator !== "0x0000000000000000000000000000000000000000") {
      console.log(`[getContractCreator] Returning creator from Etherscan:`, etherscanCreator);
      return { creator: etherscanCreator, source: "etherscan" };
    }
  } catch (error) {
    console.error(`[getContractCreator] Etherscan API lookup failed for ${contractAddress}:`, error);
    // Continue to on-chain methods
  }

  // 2. Fall back to on-chain methods
  const client = getPublicClient();

  try {
    // Try owner() (most common on-chain method)
    try {
      const owner = await client.readContract({
        address,
        abi: OWNER_ABI,
        functionName: "owner",
      });
      if (owner && owner !== "0x0000000000000000000000000000000000000000") {
        return { creator: owner as Address, source: "owner" };
      }
    } catch (error) {
      // Contract doesn't have owner() or it reverted - continue to next method
      console.debug(`[ContractCreator] owner() failed for ${contractAddress}:`, error);
    }

    // 3. Try creator() function
    try {
      const creator = await client.readContract({
        address,
        abi: CREATOR_ABI,
        functionName: "creator",
      });
      if (creator && creator !== "0x0000000000000000000000000000000000000000") {
        return { creator: creator as Address, source: "creator" };
      }
    } catch (error) {
      // Contract doesn't have creator() - continue to next method
      console.debug(`[ContractCreator] creator() failed for ${contractAddress}:`, error);
    }

    // 4. Try royaltyInfo() - use tokenId if provided, otherwise 0
    try {
      const tokenIdBigInt = tokenId ? BigInt(tokenId) : 0n;
      const [receiver] = await client.readContract({
        address,
        abi: ROYALTY_INFO_ABI,
        functionName: "royaltyInfo",
        args: [tokenIdBigInt, 1000000n], // Use 1 ETH as sale price for lookup
      });
      if (receiver && receiver !== "0x0000000000000000000000000000000000000000") {
        return { creator: receiver as Address, source: "royalty" };
      }
    } catch (error) {
      // Contract doesn't have royaltyInfo() or it reverted
      console.debug(`[ContractCreator] royaltyInfo() failed for ${contractAddress}:`, error);
    }

    // No creator found via any method
    return { creator: null, source: null };
  } catch (error) {
    console.error(`[ContractCreator] Error getting creator for ${contractAddress}:`, error);
    return { creator: null, source: null };
  }
}

/**
 * Get contract creator with off-chain fallbacks.
 * Tries on-chain methods first, then falls back to Alchemy API if available.
 * 
 * @param contractAddress - The contract address to query
 * @param tokenId - Optional token ID for royaltyInfo lookup
 * @returns Creator address and the method that found it
 */
export async function getContractCreatorWithFallback(
  contractAddress: string,
  tokenId?: bigint | number
): Promise<ContractCreatorResult> {
  // Try on-chain methods first
  const onChainResult = await getContractCreator(contractAddress, tokenId);
  if (onChainResult.creator) {
    return onChainResult;
  }

  // TODO: Add off-chain fallbacks (OpenSea, Alchemy collection metadata, etc.)
  // For now, we only use on-chain methods

  return { creator: null, source: null };
}

