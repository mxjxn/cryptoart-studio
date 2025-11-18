/**
 * Event processing handlers for Creator Core contracts
 */

import { PublicClient, Address, Log } from 'viem';
import { getSharedDatabase } from '@repo/shared-db-config';
import {
  creatorCoreContracts,
  creatorCoreTokens,
  creatorCoreTransfers,
  creatorCoreExtensions,
} from '@repo/db';
import { eq, and } from 'drizzle-orm';

// Transfer event signature (ERC721)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
// TransferSingle event signature (ERC1155)
const TRANSFER_SINGLE_TOPIC = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';
// TransferBatch event signature (ERC1155)
const TRANSFER_BATCH_TOPIC = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb';
// ExtensionRegistered event signature
const EXTENSION_REGISTERED_TOPIC = '0x5f8e26a46bd3d9f0e5eaa4dd6c89f486f7f03ae3fc2e61e9550fa504f9b4800';
// ExtensionUnregistered event signature
const EXTENSION_UNREGISTERED_TOPIC = '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface ProcessedTransfer {
  contractAddress: string;
  tokenId: string;
  from: string;
  to: string;
  amount: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  timestamp: Date | null;
}

/**
 * Process Transfer event (ERC721)
 */
export function processTransferEvent(log: Log, timestamp: Date | null): ProcessedTransfer | null {
  if (log.topics.length < 4) return null;

  const contractAddress = log.address.toLowerCase();
  const from = ('0x' + log.topics[1].slice(-40)).toLowerCase();
  const to = ('0x' + log.topics[2].slice(-40)).toLowerCase();
  const tokenId = BigInt(log.topics[3]).toString();

  return {
    contractAddress,
    tokenId,
    from,
    to,
    amount: '1',
    txHash: log.transactionHash!,
    blockNumber: Number(log.blockNumber),
    logIndex: Number(log.logIndex),
    timestamp,
  };
}

/**
 * Process TransferSingle event (ERC1155)
 */
export function processTransferSingleEvent(log: Log, timestamp: Date | null): ProcessedTransfer | null {
  if (log.topics.length < 4 || !log.data) return null;

  const contractAddress = log.address.toLowerCase();
  const operator = ('0x' + log.topics[1].slice(-40)).toLowerCase();
  const from = ('0x' + log.topics[2].slice(-40)).toLowerCase();
  const to = ('0x' + log.topics[3].slice(-40)).toLowerCase();
  
  // Decode data: id (uint256), value (uint256)
  const data = log.data.slice(2);
  const tokenId = BigInt('0x' + data.slice(0, 64)).toString();
  const amount = BigInt('0x' + data.slice(64, 128)).toString();

  return {
    contractAddress,
    tokenId,
    from,
    to,
    amount,
    txHash: log.transactionHash!,
    blockNumber: Number(log.blockNumber),
    logIndex: Number(log.logIndex),
    timestamp,
  };
}

/**
 * Process TransferBatch event (ERC1155) - creates multiple transfers
 */
export function processTransferBatchEvent(log: Log, timestamp: Date | null): ProcessedTransfer[] {
  if (log.topics.length < 4 || !log.data) return [];

  const contractAddress = log.address.toLowerCase();
  const operator = ('0x' + log.topics[1].slice(-40)).toLowerCase();
  const from = ('0x' + log.topics[2].slice(-40)).toLowerCase();
  const to = ('0x' + log.topics[3].slice(-40)).toLowerCase();

  // Decode data: ids (uint256[]), values (uint256[])
  // This is complex - for now, we'll need to decode properly
  // For simplicity, returning empty array - can be enhanced later
  return [];
}

/**
 * Store transfer event in database
 */
export async function storeTransfer(transfer: ProcessedTransfer): Promise<void> {
  const db = getSharedDatabase();

  // Check if already indexed
  const existing = await db
    .select()
    .from(creatorCoreTransfers)
    .where(
      and(
        eq(creatorCoreTransfers.txHash, transfer.txHash),
        eq(creatorCoreTransfers.logIndex, transfer.logIndex)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return; // Already indexed
  }

  await db.insert(creatorCoreTransfers).values({
    contractAddress: transfer.contractAddress,
    tokenId: transfer.tokenId,
    from: transfer.from,
    to: transfer.to,
    amount: transfer.amount,
    txHash: transfer.txHash,
    blockNumber: transfer.blockNumber,
    timestamp: transfer.timestamp,
    logIndex: transfer.logIndex,
  });

  // If this is a mint (from = zero address), update/create token record
  if (transfer.from === ZERO_ADDRESS) {
    await handleMint(transfer);
  } else {
    // Update current owner
    await updateTokenOwner(transfer);
  }
}

/**
 * Handle mint event - create or update token record
 */
async function handleMint(transfer: ProcessedTransfer): Promise<void> {
  const db = getSharedDatabase();

  // Check if token already exists
  const existing = await db
    .select()
    .from(creatorCoreTokens)
    .where(
      and(
        eq(creatorCoreTokens.contractAddress, transfer.contractAddress),
        eq(creatorCoreTokens.tokenId, transfer.tokenId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing token
    await db
      .update(creatorCoreTokens)
      .set({
        currentOwner: transfer.to,
        mintTxHash: transfer.txHash,
        mintedAt: transfer.timestamp,
        mintedAtBlock: transfer.blockNumber,
        mintedBy: transfer.to, // For mints, to is the minter
      })
      .where(
        and(
          eq(creatorCoreTokens.contractAddress, transfer.contractAddress),
          eq(creatorCoreTokens.tokenId, transfer.tokenId)
        )
      );
  } else {
    // Create new token record
    await db.insert(creatorCoreTokens).values({
      contractAddress: transfer.contractAddress,
      tokenId: transfer.tokenId,
      mintTxHash: transfer.txHash,
      mintedBy: transfer.to,
      mintedAt: transfer.timestamp,
      mintedAtBlock: transfer.blockNumber,
      currentOwner: transfer.to,
      totalSupply: transfer.amount !== '1' ? transfer.amount : null,
    });
  }
}

/**
 * Update token owner after transfer
 */
async function updateTokenOwner(transfer: ProcessedTransfer): Promise<void> {
  const db = getSharedDatabase();

  // If to is zero address, this is a burn
  const newOwner = transfer.to === ZERO_ADDRESS ? null : transfer.to;

  await db
    .update(creatorCoreTokens)
    .set({ currentOwner: newOwner })
    .where(
      and(
        eq(creatorCoreTokens.contractAddress, transfer.contractAddress),
        eq(creatorCoreTokens.tokenId, transfer.tokenId)
      )
    );
}

/**
 * Process ExtensionRegistered event
 */
export async function processExtensionRegistered(
  log: Log,
  timestamp: Date | null
): Promise<void> {
  if (log.topics.length < 3) return;

  const contractAddress = log.address.toLowerCase();
  const extensionAddress = ('0x' + log.topics[2].slice(-40)).toLowerCase();

  const db = getSharedDatabase();

  // Check if already exists
  const existing = await db
    .select()
    .from(creatorCoreExtensions)
    .where(
      eq(creatorCoreExtensions.contractAddress, contractAddress) &&
      eq(creatorCoreExtensions.extensionAddress, extensionAddress)
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db
      .update(creatorCoreExtensions)
      .set({
        registeredAt: timestamp,
        registeredAtBlock: Number(log.blockNumber),
        isBlacklisted: false,
      })
      .where(
        eq(creatorCoreExtensions.contractAddress, contractAddress) &&
        eq(creatorCoreExtensions.extensionAddress, extensionAddress)
      );
  } else {
    // Create new
    await db.insert(creatorCoreExtensions).values({
      contractAddress,
      extensionAddress,
      registeredAt: timestamp,
      registeredAtBlock: Number(log.blockNumber),
      isBlacklisted: false,
    });
  }
}

/**
 * Process ExtensionUnregistered event
 */
export async function processExtensionUnregistered(
  log: Log,
  timestamp: Date | null
): Promise<void> {
  if (log.topics.length < 3) return;

  const contractAddress = log.address.toLowerCase();
  const extensionAddress = ('0x' + log.topics[2].slice(-40)).toLowerCase();

  const db = getSharedDatabase();

  await db
    .update(creatorCoreExtensions)
    .set({
      unregisteredAt: timestamp,
      unregisteredAtBlock: Number(log.blockNumber),
    })
    .where(
      eq(creatorCoreExtensions.contractAddress, contractAddress) &&
      eq(creatorCoreExtensions.extensionAddress, extensionAddress)
    );
}

