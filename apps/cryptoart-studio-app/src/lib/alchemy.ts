import { Alchemy, Network } from 'alchemy-sdk';

let alchemyClient: Alchemy | null = null;

/**
 * Get Alchemy client instance
 * @returns Alchemy client configured for Base mainnet
 */
export function getAlchemyClient(): Alchemy {
  if (!alchemyClient) {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error('ALCHEMY_API_KEY not configured');
    }
    
    alchemyClient = new Alchemy({
      apiKey,
      network: Network.BASE_MAINNET,
      // Add timeout and retry configuration for production
      maxRetries: 3,
      requestTimeout: 10000, // 10 seconds
    });
  }
  return alchemyClient;
}

export interface NFTBalance {
  contractAddress: string;
  tokenId: string;
  tokenType: 'ERC721' | 'ERC1155';
  balance: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
}

/**
 * Get NFTs from specific contract owned by wallet
 * @param walletAddress - The wallet address to check
 * @param contractAddress - The NFT contract address
 * @param tokenId - Optional specific token ID to check
 * @returns Promise<NFTBalance[]> - Array of NFT balances
 */
export async function getNFTsByContract(
  walletAddress: string, 
  contractAddress: string,
  tokenId?: string
): Promise<NFTBalance[]> {
  try {
    const alchemy = getAlchemyClient();
    
    if (tokenId) {
      // Get specific token
      const nft = await alchemy.nft.getNftMetadata(contractAddress, tokenId);
      const balance = await alchemy.nft.getOwnersForNft(contractAddress, tokenId);
      
      const isOwner = balance.owners.includes(walletAddress.toLowerCase());
      if (!isOwner) return [];
      
      return [{
        contractAddress,
        tokenId,
        tokenType: nft.tokenType as 'ERC721' | 'ERC1155',
        balance: '1',
        metadata: {
          name: nft.name,
          description: nft.description,
          image: nft.image?.originalUrl,
          attributes: nft.raw?.metadata?.attributes,
        },
      }];
    } else {
      // Get all NFTs from contract owned by wallet
      const nfts = await alchemy.nft.getNftsForOwner(walletAddress, {
        contractAddresses: [contractAddress],
      });
      
      return nfts.ownedNfts.map(nft => ({
        contractAddress: nft.contract.address,
        tokenId: nft.tokenId,
        tokenType: nft.tokenType as 'ERC721' | 'ERC1155',
        balance: nft.balance || '1',
        metadata: {
          name: nft.name,
          description: nft.description,
          image: nft.image?.originalUrl,
          attributes: nft.raw?.metadata?.attributes,
        },
      }));
    }
  } catch (error) {
    console.error('Error fetching NFTs by contract:', error);
    return [];
  }
}

/**
 * Get all NFTs owned by a wallet address
 * @param walletAddress - The wallet address to check
 * @param limit - Maximum number of NFTs to return (default: 100)
 * @returns Promise<NFTBalance[]> - Array of all NFT balances
 */
export async function getAllNFTsForWallet(
  walletAddress: string,
  limit: number = 100
): Promise<NFTBalance[]> {
  try {
    const alchemy = getAlchemyClient();
    const nfts = await alchemy.nft.getNftsForOwner(walletAddress, {
      pageSize: limit,
    });
    
    return nfts.ownedNfts.map(nft => ({
      contractAddress: nft.contract.address,
      tokenId: nft.tokenId,
      tokenType: nft.tokenType as 'ERC721' | 'ERC1155',
      balance: nft.balance || '1',
      metadata: {
        name: nft.name,
        description: nft.description,
        image: nft.image?.originalUrl,
        attributes: nft.raw?.metadata?.attributes,
      },
    }));
  } catch (error) {
    console.error('Error fetching all NFTs for wallet:', error);
    return [];
  }
}

/**
 * Check if wallet owns NFTs from multiple contracts
 * @param walletAddress - The wallet address to check
 * @param contractAddresses - Array of contract addresses to check
 * @param minBalance - Minimum balance required (default: 1)
 * @returns Promise<{ contractAddress: string; balance: string; nfts: NFTBalance[] }[]>
 */
export async function checkMultipleContractOwnership(
  walletAddress: string,
  contractAddresses: string[],
  minBalance: number = 1
): Promise<{ contractAddress: string; balance: string; nfts: NFTBalance[] }[]> {
  const results = [];
  
  for (const contractAddress of contractAddresses) {
    const nfts = await getNFTsByContract(walletAddress, contractAddress);
    const totalBalance = nfts.reduce((sum, nft) => sum + parseInt(nft.balance), 0);
    
    if (totalBalance >= minBalance) {
      results.push({
        contractAddress,
        balance: totalBalance.toString(),
        nfts,
      });
    }
  }
  
  return results;
}

/**
 * Get contract metadata
 * @param contractAddress - The contract address
 * @returns Promise<{ name: string; symbol: string; totalSupply?: string } | null>
 */
export async function getContractMetadata(contractAddress: string): Promise<{
  name: string;
  symbol: string;
  totalSupply?: string;
} | null> {
  try {
    const alchemy = getAlchemyClient();
    const contract = await alchemy.nft.getContractMetadata(contractAddress);
    
    return {
      name: contract.name || 'Unknown',
      symbol: contract.symbol || 'UNKNOWN',
      totalSupply: contract.totalSupply,
    };
  } catch (error) {
    console.error('Error fetching contract metadata:', error);
    return null;
  }
}
