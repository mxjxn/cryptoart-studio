/**
 * Configuration for Creator Core Indexer
 */

export interface IndexerConfig {
  rpcUrl: string;
  chainId: number;
  startBlock?: number;
  batchSize: number;
  pollInterval: number; // milliseconds
  // Known implementation addresses to track (for upgradeable contracts)
  erc721ImplementationAddresses?: string[];
  erc1155ImplementationAddresses?: string[];
  erc6551ImplementationAddresses?: string[];
}

export function getConfig(): IndexerConfig {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error('RPC_URL environment variable is required');
  }

  const chainId = parseInt(process.env.CHAIN_ID || '8453'); // Default to Base
  const startBlock = process.env.START_BLOCK ? parseInt(process.env.START_BLOCK) : undefined;
  const batchSize = parseInt(process.env.BATCH_SIZE || '100');
  const pollInterval = parseInt(process.env.POLL_INTERVAL || '12000'); // 12 seconds default

  // Implementation addresses (comma-separated)
  const erc721Impls = process.env.ERC721_IMPLEMENTATION_ADDRESSES?.split(',').filter(Boolean);
  const erc1155Impls = process.env.ERC1155_IMPLEMENTATION_ADDRESSES?.split(',').filter(Boolean);
  const erc6551Impls = process.env.ERC6551_IMPLEMENTATION_ADDRESSES?.split(',').filter(Boolean);

  return {
    rpcUrl,
    chainId,
    startBlock,
    batchSize,
    pollInterval,
    erc721ImplementationAddresses: erc721Impls,
    erc1155ImplementationAddresses: erc1155Impls,
    erc6551ImplementationAddresses: erc6551Impls,
  };
}

