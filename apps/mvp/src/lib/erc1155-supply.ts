import { Address } from 'viem';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// ERC1155Supply ABI for totalSupply(uint256 id)
const ERC1155_SUPPLY_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'id', type: 'uint256' }],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_RPC_URL || 
    process.env.RPC_URL || 
    process.env.NEXT_PUBLIC_BASE_RPC_URL || 
    'https://mainnet.base.org'
  ),
});

/**
 * Fetch ERC1155 total supply from Alchemy API
 * Note: Alchemy's getNFTMetadata may not provide per-tokenId total supply
 * This is a placeholder that tries the API first
 */
export async function fetchERC1155TotalSupplyFromAlchemy(
  contractAddress: string,
  tokenId: string
): Promise<bigint | null> {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    console.log('[ERC1155Supply] No Alchemy API key configured');
    return null;
  }

  try {
    // Try Alchemy getNFTMetadata endpoint
    const url = `https://base-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}&tokenType=ERC1155`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[ERC1155Supply] Alchemy API failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Check if Alchemy provides totalSupply in the response
    // Note: Alchemy's getNFTMetadata typically doesn't provide per-tokenId total supply
    // This is a placeholder - we'll fall back to contract call
    if (data.contract?.totalSupply) {
      // This is contract-level total supply, not per-tokenId
      // We'll need to use contract call for per-tokenId supply
      console.log('[ERC1155Supply] Alchemy returned contract-level totalSupply, not per-tokenId');
      return null;
    }

    return null;
  } catch (error) {
    console.error('[ERC1155Supply] Error fetching from Alchemy:', error);
    return null;
  }
}

/**
 * Fetch ERC1155 total supply from contract directly
 * Calls totalSupply(uint256 id) if contract implements ERC1155Supply
 */
export async function getERC1155TotalSupplyFromContract(
  contractAddress: Address,
  tokenId: string
): Promise<bigint | null> {
  try {
    const tokenIdBigInt = BigInt(tokenId);
    
    const totalSupply = await publicClient.readContract({
      address: contractAddress,
      abi: ERC1155_SUPPLY_ABI,
      functionName: 'totalSupply',
      args: [tokenIdBigInt],
    });

    return totalSupply as bigint;
  } catch (error: any) {
    // Contract may not implement ERC1155Supply extension
    if (error?.message?.includes('does not exist') || 
        error?.message?.includes('execution reverted') ||
        error?.code === 'CALL_EXCEPTION') {
      console.log(`[ERC1155Supply] Contract ${contractAddress} does not implement totalSupply(uint256 id)`);
      return null;
    }
    console.error(`[ERC1155Supply] Error reading contract totalSupply:`, error);
    return null;
  }
}

/**
 * Fetch ERC1155 total supply from contract
 * Note: Alchemy API doesn't provide per-tokenId total supply, so we go straight to contract call
 * This uses RPC (not Alchemy NFT API credits) and is cached in the database
 */
export async function fetchERC1155TotalSupply(
  contractAddress: string,
  tokenId: string
): Promise<bigint | null> {
  // Normalize address
  const normalizedAddress = contractAddress.toLowerCase() as Address;

  // Go straight to contract call - Alchemy API doesn't provide per-tokenId supply
  // Contract calls use RPC (not Alchemy NFT API credits) and results are cached
  return await getERC1155TotalSupplyFromContract(normalizedAddress, tokenId);
}

