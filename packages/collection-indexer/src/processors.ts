import { eq, and, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  collections,
  collectionTokens,
  collectionDeployments,
  collectionExtensions,
  collectionRoyalties,
  transferEvents,
} from '@cryptoart/db';
import { ZERO_ADDRESS } from './constants.js';

export interface ProcessContext {
  db: PostgresJsDatabase<Record<string, never>>;
  collectionId: string;
  chainId: number;
  contractAddress: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  blockTimestamp: Date;
}

export async function getCollectionId(
  db: PostgresJsDatabase<Record<string, never>>,
  contractAddress: string,
  chainId: number,
): Promise<string | null> {
  const rows = await db
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(
        eq(collections.contractAddress, contractAddress),
        eq(collections.chainId, chainId),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function processCollectionCreated(
  db: PostgresJsDatabase<Record<string, never>>,
  params: {
    chainId: number;
    factoryAddress: string;
    contractAddress: string;
    ownerAddress: string;
    name: string;
    symbol: string;
    txHash: string;
    blockNumber: number;
    blockTimestamp: Date;
    fromAddress: string;
    royaltyReceiver: string | null;
    royaltyBPS: number | null;
  },
): Promise<string> {
  const result = await db
    .insert(collections)
    .values({
      name: params.name,
      symbol: params.symbol,
      chainId: params.chainId,
      contractAddress: params.contractAddress,
      factoryAddress: params.factoryAddress,
      deployTxHash: params.txHash,
      deployBlockNumber: params.blockNumber,
      ownerAddress: params.ownerAddress,
      royaltyReceiver: params.royaltyReceiver,
      royaltyBPS: params.royaltyBPS,
      status: 'active',
      confirmedAt: params.blockTimestamp,
    })
    .onConflictDoUpdate({
      target: [collections.contractAddress, collections.chainId],
      set: {
        ownerAddress: params.ownerAddress,
        status: 'active',
        confirmedAt: params.blockTimestamp,
        updatedAt: new Date(),
      },
    })
    .returning({ id: collections.id });

  await db
    .insert(collectionDeployments)
    .values({
      collectionId: result[0]!.id,
      chainId: params.chainId,
      txHash: params.txHash,
      fromAddress: params.fromAddress,
      toAddress: params.contractAddress,
      name: params.name,
      symbol: params.symbol,
      royaltyReceiver: params.royaltyReceiver,
      royaltyBPS: params.royaltyBPS,
      status: 'confirmed',
      blockNumber: params.blockNumber,
      confirmedAt: params.blockTimestamp,
    })
    .onConflictDoUpdate({
      target: [collectionDeployments.txHash, collectionDeployments.chainId],
      set: {
        status: 'confirmed',
        blockNumber: params.blockNumber,
        confirmedAt: params.blockTimestamp,
        collectionId: result[0]!.id,
      },
    });

  await db
    .update(collectionDeployments)
    .set({
      status: 'confirmed',
      blockNumber: params.blockNumber,
      confirmedAt: params.blockTimestamp,
      collectionId: result[0]!.id,
    })
    .where(
      and(
        sql`tx_hash LIKE 'pending-%'`,
        eq(collectionDeployments.chainId, params.chainId),
        eq(collectionDeployments.fromAddress, params.fromAddress),
        eq(collectionDeployments.name, params.name),
        eq(collectionDeployments.symbol, params.symbol),
      ),
    );

  return result[0]!.id;
}

export async function processTransfer(
  ctx: ProcessContext,
  from: string,
  to: string,
  tokenId: number,
): Promise<void> {
  await ctx.db
    .insert(transferEvents)
    .values({
      collectionId: ctx.collectionId,
      chainId: ctx.chainId,
      contractAddress: ctx.contractAddress,
      tokenId,
      fromAddress: from,
      toAddress: to,
      eventType: from === ZERO_ADDRESS ? 'mint' : to === ZERO_ADDRESS ? 'burn' : 'transfer',
      txHash: ctx.txHash,
      blockNumber: ctx.blockNumber,
      logIndex: ctx.logIndex,
      timestamp: ctx.blockTimestamp,
    })
    .onConflictDoNothing({
      target: [transferEvents.txHash, transferEvents.logIndex],
    });

  if (from === ZERO_ADDRESS) {
    await ctx.db
      .insert(collectionTokens)
      .values({
        collectionId: ctx.collectionId,
        chainId: ctx.chainId,
        contractAddress: ctx.contractAddress,
        tokenId,
        ownerAddress: to,
        mintTxHash: ctx.txHash,
        mintBlockNumber: ctx.blockNumber,
        metadataStatus: 'pending',
        mintedAt: ctx.blockTimestamp,
      })
      .onConflictDoUpdate({
        target: [collectionTokens.contractAddress, collectionTokens.chainId, collectionTokens.tokenId],
        set: {
          ownerAddress: to,
          mintTxHash: ctx.txHash,
          mintBlockNumber: ctx.blockNumber,
          burnedAt: null,
          updatedAt: new Date(),
        },
      });
  } else if (to === ZERO_ADDRESS) {
    await ctx.db
      .update(collectionTokens)
      .set({
        burnedAt: ctx.blockTimestamp,
        ownerAddress: ZERO_ADDRESS,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(collectionTokens.contractAddress, ctx.contractAddress),
          eq(collectionTokens.chainId, ctx.chainId),
          eq(collectionTokens.tokenId, tokenId),
        ),
      );
  } else {
    await ctx.db
      .update(collectionTokens)
      .set({
        ownerAddress: to,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(collectionTokens.contractAddress, ctx.contractAddress),
          eq(collectionTokens.chainId, ctx.chainId),
          eq(collectionTokens.tokenId, tokenId),
        ),
      );
  }
}

export async function processMinted(
  ctx: ProcessContext,
  _to: string,
  tokenId: number,
  tokenURI: string,
): Promise<void> {
  await ctx.db
    .update(collectionTokens)
    .set({
      tokenURI,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(collectionTokens.contractAddress, ctx.contractAddress),
        eq(collectionTokens.chainId, ctx.chainId),
        eq(collectionTokens.tokenId, tokenId),
      ),
    );
}

export async function processExtensionRegistered(
  ctx: ProcessContext,
  extensionAddress: string,
): Promise<void> {
  await ctx.db
    .insert(collectionExtensions)
    .values({
      collectionId: ctx.collectionId,
      chainId: ctx.chainId,
      contractAddress: ctx.contractAddress,
      extensionAddress,
      status: 'active',
      registeredBlock: ctx.blockNumber,
      registeredAt: ctx.blockTimestamp,
    })
    .onConflictDoUpdate({
      target: [collectionExtensions.contractAddress, collectionExtensions.chainId, collectionExtensions.extensionAddress],
      set: {
        status: 'active',
        registeredBlock: ctx.blockNumber,
        registeredAt: ctx.blockTimestamp,
        unregisteredAt: null,
        unregisteredBlock: null,
      },
    });
}

export async function processExtensionUnregistered(
  ctx: ProcessContext,
  extensionAddress: string,
): Promise<void> {
  await ctx.db
    .update(collectionExtensions)
    .set({
      status: 'unregistered',
      unregisteredAt: ctx.blockTimestamp,
      unregisteredBlock: ctx.blockNumber,
    })
    .where(
      and(
        eq(collectionExtensions.contractAddress, ctx.contractAddress),
        eq(collectionExtensions.chainId, ctx.chainId),
        eq(collectionExtensions.extensionAddress, extensionAddress),
      ),
    );
}

export async function processRoyaltyUpdated(
  ctx: ProcessContext,
  receiver: string,
  bps: number,
): Promise<void> {
  await ctx.db
    .update(collections)
    .set({
      royaltyReceiver: receiver,
      royaltyBPS: bps,
      updatedAt: new Date(),
    })
    .where(eq(collections.id, ctx.collectionId));

  await ctx.db
    .insert(collectionRoyalties)
    .values({
      collectionId: ctx.collectionId,
      chainId: ctx.chainId,
      contractAddress: ctx.contractAddress,
      tokenId: null,
      receiverAddress: receiver,
      bps,
    })
    .onConflictDoUpdate({
      target: [collectionRoyalties.contractAddress, collectionRoyalties.chainId, collectionRoyalties.tokenId],
      set: {
        receiverAddress: receiver,
        bps,
        updatedAt: new Date(),
      },
    });
}

export async function processBaseURIUpdated(
  ctx: ProcessContext,
): Promise<void> {
  await ctx.db
    .update(collections)
    .set({ updatedAt: new Date() })
    .where(eq(collections.id, ctx.collectionId));
}

export async function processOwnershipTransferred(
  ctx: ProcessContext,
  newOwner: string,
): Promise<void> {
  await ctx.db
    .update(collections)
    .set({
      ownerAddress: newOwner,
      updatedAt: new Date(),
    })
    .where(eq(collections.id, ctx.collectionId));
}

export async function updateTotalSupply(
  db: PostgresJsDatabase<Record<string, never>>,
  collectionId: string,
  totalSupply: number,
): Promise<void> {
  await db
    .update(collections)
    .set({ totalSupply })
    .where(eq(collections.id, collectionId));
}
