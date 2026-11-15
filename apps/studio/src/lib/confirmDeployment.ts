import {
  createPublicClient,
  decodeEventLog,
  http,
  type Hex,
  type Log,
} from 'viem';
import { base, baseSepolia, mainnet } from 'viem/chains';
import {
  getDatabase,
  collectionDeployments,
  collections,
  eq,
} from '@cryptoart/db';

const COLLECTION_CREATED_EVENT = {
  type: 'event',
  name: 'CollectionCreated',
  inputs: [
    { name: 'collection', type: 'address', indexed: true },
    { name: 'owner', type: 'address', indexed: true },
    { name: 'name', type: 'string', indexed: false },
    { name: 'symbol', type: 'string', indexed: false },
  ],
} as const;

function resolveRpcUrl(chainId: number): string | null {
  const fromEnv = process.env[`CHAIN_${chainId}_RPC_URL`];
  if (fromEnv) return fromEnv;
  if (chainId === baseSepolia.id) return 'https://sepolia.base.org';
  if (chainId === base.id) return 'https://mainnet.base.org';
  if (chainId === mainnet.id) return 'https://eth.llamarpc.com';
  return null;
}

function resolveChain(chainId: number) {
  if (chainId === baseSepolia.id) return baseSepolia;
  if (chainId === base.id) return base;
  if (chainId === mainnet.id) return mainnet;
  return null;
}

function resolveTokenStandard(chainId: number, factoryAddress: string): 'erc721' | 'erc1155' {
  const erc1155 = process.env[`CHAIN_${chainId}_ERC1155_FACTORY_ADDRESS`]?.toLowerCase();
  if (erc1155 && factoryAddress.toLowerCase() === erc1155) return 'erc1155';
  return 'erc721';
}

function decodeCollectionCreated(log: Log) {
  try {
    const decoded = decodeEventLog({
      abi: [COLLECTION_CREATED_EVENT],
      data: log.data,
      topics: log.topics,
    });
    if (decoded.eventName !== 'CollectionCreated') return null;
    return decoded.args as {
      collection: `0x${string}`;
      owner: `0x${string}`;
      name: string;
      symbol: string;
    };
  } catch {
    return null;
  }
}

export async function confirmDeploymentFromChain(params: {
  deploymentId: string;
  txHash?: string | null;
}): Promise<{
  status: string;
  collectionId: string | null;
  contractAddress: string | null;
  txHash: string | null;
  blockNumber: number | null;
}> {
  const db = getDatabase();
  const rows = await db
    .select()
    .from(collectionDeployments)
    .where(eq(collectionDeployments.id, params.deploymentId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error('Deployment not found');
  }

  const deployment = rows[0]!;
  if (deployment.status === 'confirmed' && deployment.collectionId) {
    const collectionRows = await db
      .select()
      .from(collections)
      .where(eq(collections.id, deployment.collectionId))
      .limit(1);
    return {
      status: 'confirmed',
      collectionId: deployment.collectionId,
      contractAddress: collectionRows[0]?.contractAddress ?? null,
      txHash: deployment.txHash.startsWith('pending-')
        ? (collectionRows[0]?.deployTxHash ?? null)
        : deployment.txHash,
      blockNumber: deployment.blockNumber ?? null,
    };
  }

  const txHash =
    params.txHash && params.txHash.startsWith('0x')
      ? params.txHash
      : deployment.txHash.startsWith('0x')
        ? deployment.txHash
        : null;

  if (!txHash) {
    return {
      status: deployment.status,
      collectionId: deployment.collectionId,
      contractAddress: null,
      txHash: deployment.txHash,
      blockNumber: deployment.blockNumber ?? null,
    };
  }

  if (deployment.txHash.startsWith('pending-') || deployment.txHash !== txHash) {
    await db
      .update(collectionDeployments)
      .set({ txHash, status: 'submitted' })
      .where(eq(collectionDeployments.id, deployment.id));
  }

  const rpcUrl = resolveRpcUrl(deployment.chainId);
  const chain = resolveChain(deployment.chainId);
  if (!rpcUrl || !chain) {
    return {
      status: 'submitted',
      collectionId: null,
      contractAddress: null,
      txHash,
      blockNumber: null,
    };
  }

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const receipt = await client.getTransactionReceipt({ hash: txHash as Hex });
  if (receipt.status !== 'success') {
    await db
      .update(collectionDeployments)
      .set({
        status: 'failed',
        failedAt: new Date(),
        errorMessage: 'Transaction reverted on-chain',
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed),
        effectiveGasPrice: Number(receipt.effectiveGasPrice),
      })
      .where(eq(collectionDeployments.id, deployment.id));

    return {
      status: 'failed',
      collectionId: null,
      contractAddress: null,
      txHash,
      blockNumber: Number(receipt.blockNumber),
    };
  }

  let created: ReturnType<typeof decodeCollectionCreated> = null;
  for (const log of receipt.logs) {
    created = decodeCollectionCreated(log);
    if (created) break;
  }

  if (!created) {
    return {
      status: 'submitted',
      collectionId: null,
      contractAddress: null,
      txHash,
      blockNumber: Number(receipt.blockNumber),
    };
  }

  const factoryAddress = (deployment.toAddress ?? receipt.to ?? '').toLowerCase();
  const contractAddress = created.collection.toLowerCase();
  const tokenStandard = resolveTokenStandard(deployment.chainId, factoryAddress);
  const confirmedAt = new Date();

  const [collection] = await db
    .insert(collections)
    .values({
      name: created.name || deployment.name,
      symbol: created.symbol || deployment.symbol,
      chainId: deployment.chainId,
      contractAddress,
      factoryAddress,
      deployTxHash: txHash,
      deployBlockNumber: Number(receipt.blockNumber),
      ownerAddress: created.owner.toLowerCase(),
      royaltyReceiver: deployment.royaltyReceiver,
      royaltyBPS: deployment.royaltyBPS,
      tokenStandard,
      status: 'active',
      confirmedAt,
    })
    .onConflictDoUpdate({
      target: [collections.contractAddress, collections.chainId],
      set: {
        ownerAddress: created.owner.toLowerCase(),
        tokenStandard,
        status: 'active',
        deployTxHash: txHash,
        deployBlockNumber: Number(receipt.blockNumber),
        confirmedAt,
        updatedAt: new Date(),
      },
    })
    .returning({ id: collections.id, contractAddress: collections.contractAddress });

  await db
    .update(collectionDeployments)
    .set({
      txHash,
      status: 'confirmed',
      collectionId: collection!.id,
      blockNumber: Number(receipt.blockNumber),
      gasUsed: Number(receipt.gasUsed),
      effectiveGasPrice: Number(receipt.effectiveGasPrice),
      confirmedAt,
      errorMessage: null,
      failedAt: null,
    })
    .where(eq(collectionDeployments.id, deployment.id));

  return {
    status: 'confirmed',
    collectionId: collection!.id,
    contractAddress: collection!.contractAddress,
    txHash,
    blockNumber: Number(receipt.blockNumber),
  };
}
