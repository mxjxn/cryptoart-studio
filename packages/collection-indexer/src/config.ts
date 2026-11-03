export type TokenStandard = 'erc721' | 'erc1155';

export interface ChainConfig {
  chainId: number;
  rpcUrl: string;
  factoryAddress: `0x${string}`;
  startBlock: number;
  tokenStandard: TokenStandard;
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

function pushFactory(
  chains: ChainConfig[],
  chainId: number,
  rpcUrl: string,
  startBlock: number,
  factoryAddress: string | undefined,
  tokenStandard: TokenStandard,
  envKey: string,
) {
  if (!factoryAddress) return;
  if (!/^0x[a-fA-F0-9]{40}$/.test(factoryAddress)) {
    throw new Error(`${envKey} must be a 0x-prefixed address`);
  }
  chains.push({
    chainId,
    rpcUrl,
    factoryAddress: factoryAddress as `0x${string}`,
    startBlock,
    tokenStandard,
  });
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
    const startBlockStr = process.env[`${prefix}_START_BLOCK`];
    const startBlock = startBlockStr ? parseInt(startBlockStr, 10) : 0;

    if (!rpcUrl) {
      throw new Error(`${prefix}_RPC_URL is required for chain ${chainId}`);
    }

    const factory721 = process.env[`${prefix}_FACTORY_ADDRESS`];
    const factory1155 = process.env[`${prefix}_ERC1155_FACTORY_ADDRESS`];

    pushFactory(chains, chainId, rpcUrl, startBlock, factory721, 'erc721', `${prefix}_FACTORY_ADDRESS`);
    pushFactory(
      chains,
      chainId,
      rpcUrl,
      startBlock,
      factory1155,
      'erc1155',
      `${prefix}_ERC1155_FACTORY_ADDRESS`,
    );

    if (!factory721 && !factory1155) {
      throw new Error(
        `${prefix}_FACTORY_ADDRESS or ${prefix}_ERC1155_FACTORY_ADDRESS is required for chain ${chainId}`,
      );
    }
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
