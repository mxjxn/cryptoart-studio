export interface ChainConfig {
  chainId: number;
  rpcUrl: string;
  factoryAddress: `0x${string}`;
  startBlock: number;
}

export interface IndexerConfig {
  chains: ChainConfig[];
  batchSize: number;
  factoryPollInterval: number;
  collectionPollInterval: number;
  metadataPollInterval: number;
  maxMetadataRetries: number;
  ipfsGateway: string;
  metadataBatchSize: number;
}

export function getConfig(): IndexerConfig {
  const chainIdsStr = process.env['CHAIN_IDS'];
  if (!chainIdsStr) {
    throw new Error('CHAIN_IDS environment variable is required');
  }

  const chainIds = chainIdsStr.split(',').map((id) => parseInt(id.trim(), 10));

  const chains: ChainConfig[] = [];
  for (const chainId of chainIds) {
    const prefix = `CHAIN_${chainId}`;
    const rpcUrl = process.env[`${prefix}_RPC_URL`];
    const factoryAddress = process.env[`${prefix}_FACTORY_ADDRESS`];
    const startBlockStr = process.env[`${prefix}_START_BLOCK`];

    if (!rpcUrl) {
      throw new Error(`${prefix}_RPC_URL is required for chain ${chainId}`);
    }
    if (!factoryAddress) {
      throw new Error(`${prefix}_FACTORY_ADDRESS is required for chain ${chainId}`);
    }

    chains.push({
      chainId,
      rpcUrl,
      factoryAddress: factoryAddress as `0x${string}`,
      startBlock: startBlockStr ? parseInt(startBlockStr, 10) : 0,
    });
  }

  return {
    chains,
    batchSize: parseInt(process.env['BATCH_SIZE'] ?? '200'),
    factoryPollInterval: parseInt(process.env['FACTORY_POLL_INTERVAL'] ?? '30000'),
    collectionPollInterval: parseInt(process.env['COLLECTION_POLL_INTERVAL'] ?? '5000'),
    metadataPollInterval: parseInt(process.env['METADATA_POLL_INTERVAL'] ?? '10000'),
    maxMetadataRetries: parseInt(process.env['MAX_METADATA_RETRIES'] ?? '3'),
    ipfsGateway: process.env['IPFS_GATEWAY'] ?? 'https://ipfs.io/ipfs',
    metadataBatchSize: parseInt(process.env['METADATA_BATCH_SIZE'] ?? '10'),
  };
}
