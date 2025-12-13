import { type Address, isAddress } from 'viem';

/**
 * Validates if a string is a properly formatted Ethereum address
 * - 42 characters total
 * - Starts with '0x'
 * - Followed by 40 hexadecimal characters
 */
export function isValidAddressFormat(address: string): boolean {
  if (typeof address !== 'string') return false;
  if (address.length !== 42) return false;
  if (!address.startsWith('0x')) return false;
  const hexPart = address.slice(2);
  return /^[0-9a-fA-F]{40}$/.test(hexPart);
}

/**
 * Contract information interface
 */
export interface ContractInfo {
  name: string | null;
  owner: string | null;
  source: 'alchemy' | 'onchain';
}

/**
 * Fetches contract information from Alchemy API
 * First tries getContractMetadata, then falls back to getNFTsForOwner
 */
export async function fetchContractInfoFromAlchemy(
  contractAddress: string
): Promise<ContractInfo | null> {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!apiKey) {
    console.log('[ContractInfo] No Alchemy API key configured');
    return null;
  }

  console.log(`[ContractInfo] Fetching from Alchemy for contract: ${contractAddress}`);

  try {
    // First, try to get contract metadata directly
    const metadataUrl = `https://base-mainnet.g.alchemy.com/nft/v3/${apiKey}/getContractMetadata?contractAddress=${contractAddress}`;
    console.log(`[ContractInfo] Trying getContractMetadata: ${metadataUrl}`);
    
    const metadataResponse = await fetch(metadataUrl);
    
    if (metadataResponse.ok) {
      const metadataData = await metadataResponse.json();
      console.log('[ContractInfo] getContractMetadata response:', metadataData);
      
      // Check both top-level name and nested contractMetadata.name
      const contractName = metadataData.name || metadataData.contractMetadata?.name;
      
      if (contractName) {
        const result = {
          name: contractName,
          owner: null, // Will be filled by onchain call
          source: 'alchemy' as const,
        };
        console.log(`[ContractInfo] Found name from getContractMetadata: ${result.name}`);
        return result;
      }
    } else {
      console.log(`[ContractInfo] getContractMetadata failed with status: ${metadataResponse.status}`);
    }

    // Fallback: Use getNFTsForOwner to get contract info from NFTs
    // NOTE: This gets NFTs owned BY the address, not FROM the contract
    // This is a fallback and may not be accurate if the address owns NFTs from other contracts
    const url = `https://base-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${contractAddress}&withMetadata=true&pageSize=1`;
    console.log(`[ContractInfo] Fallback: Trying getNFTsForOwner: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[ContractInfo] getNFTsForOwner failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log('[ContractInfo] getNFTsForOwner response:', data);
    
    // If we get NFTs back, try to extract contract name from the first NFT
    // WARNING: This might not be accurate if the address owns NFTs from multiple contracts
    if (data.ownedNfts && data.ownedNfts.length > 0) {
      const nft = data.ownedNfts[0];
      const contractName = nft.contract?.name || nft.contractMetadata?.name || null;
      
      console.log(`[ContractInfo] Extracted contract name from NFT: ${contractName}`);
      console.log(`[ContractInfo] NFT contract address: ${nft.contract?.address}, input address: ${contractAddress}`);
      
      // Only use this if the NFT is actually from the contract we're querying
      if (contractName && nft.contract?.address?.toLowerCase() === contractAddress.toLowerCase()) {
        const result = {
          name: contractName,
          owner: null, // Will be filled by onchain call
          source: 'alchemy' as const,
        };
        console.log(`[ContractInfo] Using name from getNFTsForOwner: ${result.name}`);
        return result;
      } else {
        console.log('[ContractInfo] NFT contract address does not match input address, ignoring');
      }
    }

    console.log('[ContractInfo] No contract info found from Alchemy');
    return null;
  } catch (error) {
    console.error('[ContractInfo] Error fetching contract info from Alchemy:', error);
    return null;
  }
}

/**
 * Floor price information interface
 */
export interface FloorPriceInfo {
  floorPrice: number;
  priceCurrency: string;
  collectionUrl?: string;
  retrievedAt?: string;
}

/**
 * Fetches floor price for an NFT collection from Alchemy API
 * Returns null if no floor price is available or if there's an error
 */
export async function fetchFloorPriceFromAlchemy(
  contractAddress: string
): Promise<FloorPriceInfo | null> {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!apiKey) {
    console.log('[FloorPrice] No Alchemy API key configured');
    return null;
  }

  console.log(`[FloorPrice] Fetching floor price from Alchemy for contract: ${contractAddress}`);

  try {
    // Use v2 API endpoint for getFloorPrice (as per Alchemy docs)
    const url = `https://base-mainnet.g.alchemy.com/nft/v2/${apiKey}/getFloorPrice?contractAddress=${contractAddress}`;
    console.log(`[FloorPrice] Fetching from: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`[FloorPrice] API request failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log('[FloorPrice] API response:', data);
    
    // Check if we have marketplace data with floor price
    if (data.nftMarketplace) {
      const marketplace = data.nftMarketplace;
      
      // Check for error in response
      if (marketplace.error) {
        console.log(`[FloorPrice] Marketplace returned error: ${marketplace.error}`);
        return null;
      }
      
      // Check if floor price exists and is valid
      if (marketplace.floorPrice !== undefined && marketplace.floorPrice !== null) {
        const result: FloorPriceInfo = {
          floorPrice: marketplace.floorPrice,
          priceCurrency: marketplace.priceCurrency || 'ETH',
          collectionUrl: marketplace.collectionUrl,
          retrievedAt: marketplace.retrievedAt,
        };
        console.log(`[FloorPrice] Found floor price: ${result.floorPrice} ${result.priceCurrency}`);
        return result;
      }
    }

    console.log('[FloorPrice] No floor price found in response');
    return null;
  } catch (error) {
    console.error('[FloorPrice] Error fetching floor price from Alchemy:', error);
    return null;
  }
}

/**
 * ABI for reading name and owner from contracts
 */
export const CONTRACT_INFO_ABI = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

