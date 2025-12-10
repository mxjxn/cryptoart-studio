import { Alchemy, Network } from 'alchemy-sdk';

/**
 * Fetch ERC-721 collection total supply from Alchemy API
 * Uses getContractMetadata which returns totalSupply for the collection
 */
export async function fetchERC721TotalSupply(
  contractAddress: string
): Promise<number | null> {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    console.log('[ERC721Supply] No Alchemy API key configured');
    return null;
  }

  try {
    // Configure Alchemy for server-side use
    const alchemy = new Alchemy({
      apiKey,
      network: Network.BASE_MAINNET,
      connectionInfoOverrides: {
        skipFetchSetup: true,
      },
      maxRetries: 3,
      requestTimeout: 10000,
    });

    // Get contract metadata which includes totalSupply
    const contractMetadata = await alchemy.nft.getContractMetadata(contractAddress);
    
    // totalSupply might be a string or number
    if (contractMetadata?.totalSupply !== undefined && contractMetadata.totalSupply !== null) {
      const supply = typeof contractMetadata.totalSupply === 'string' 
        ? parseInt(contractMetadata.totalSupply, 10)
        : contractMetadata.totalSupply;
      return isNaN(supply) ? null : supply;
    }

    return null;
  } catch (error: any) {
    // Log but don't throw - this is optional enrichment data
    const errorMsg = error?.message || String(error);
    console.error(`[ERC721Supply] Error fetching total supply for ${contractAddress}:`, errorMsg);
    return null;
  }
}
