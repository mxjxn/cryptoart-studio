import type { Log } from 'viem';
import { decodeEventLog } from 'viem';
import { getDatabase } from '@cryptoart/db';
import { STPV2ABI } from '../abis/STPV2.js';
import { STPV2FactoryABI } from '../abis/STPV2Factory.js';

/**
 * Event handler module for STP v2 contracts
 * 
 * This follows the chain-indexer pattern from PR #199.
 * 
 * INTEGRATION INSTRUCTIONS:
 * Once PR #199 merges, add STP event handling by:
 * 
 * 1. Import this module in chain-indexer's event processor:
 *    import { processStpEvent } from '@cryptoart/stp/handlers/event-handlers';
 * 
 * 2. Add STP contracts to chain-indexer's config:
 *    import { STP_V2_CONTRACTS } from '@cryptoart/stp/config/contracts';
 * 
 * 3. Call processStpEvent in the event processing loop:
 *    if (isStpContract(event.address)) {
 *      await processStpEvent(event);
 *    }
 * 
 * 4. Add STP ABIs to chain-indexer's ABI map
 * 
 * This design keeps STP indexing modular and doesn't require changes to
 * chain-indexer's core logic.
 */

/**
 * Main event processor for STP events
 * Decodes and routes events to specific handlers
 */
export async function processStpEvent(log: Log): Promise<void> {
  try {
    const decoded = decodeEventLog({
      abi: STPV2ABI,
      data: log.data,
      topics: log.topics,
    });

    switch (decoded.eventName) {
      case 'Transfer':
        await handleTransfer(log, decoded.args);
        break;
      case 'Purchase':
        await handlePurchase(log, decoded.args);
        break;
      case 'Refund':
        await handleRefund(log, decoded.args);
        break;
      case 'Grant':
        await handleGrant(log, decoded.args);
        break;
      case 'GrantRevoke':
        await handleGrantRevoke(log, decoded.args);
        break;
      case 'SwitchTier':
        await handleSwitchTier(log, decoded.args);
        break;
      case 'TierCreated':
        await handleTierCreated(log, decoded.args);
        break;
      case 'TierUpdated':
        await handleTierUpdated(log, decoded.args);
        break;
      default:
        // Ignore other events (SharesIssued, ReferralPayout, etc.)
        break;
    }

    // Store raw event (idempotent)
    await storeRawEvent(log, decoded.eventName, decoded.args);
  } catch (error) {
    console.error('Error processing STP event:', error, log);
  }
}

/**
 * Handle ERC721 Transfer events to track ownership changes
 */
async function handleTransfer(log: Log, args: any): Promise<void> {
  const db = getDatabase();
  const { from, to, tokenId } = args;

  if (!log.address) return;

  // Skip mint events (handled by Purchase)
  if (from === '0x0000000000000000000000000000000000000000') return;

  // Skip burn events
  if (to === '0x0000000000000000000000000000000000000000') return;

  // Update owner in subscriptions table
  await db.execute(
    `UPDATE stp_subscriptions 
     SET owner_address = $1, updated_at = NOW()
     WHERE contract_address = $2 
       AND token_id = $3`,
    [to.toLowerCase(), log.address.toLowerCase(), tokenId.toString()]
  );
}

/**
 * Handle Purchase events (mints and renewals)
 */
async function handlePurchase(log: Log, args: any): Promise<void> {
  const db = getDatabase();
  const { tokenId, tokensTransferred, timePurchased, expiresAt } = args;

  if (!log.address || !log.transactionHash) return;

  // Convert timestamps to Date objects
  const expiryDate = new Date(Number(expiresAt) * 1000);
  const purchaseDate = new Date(Number(timePurchased) * 1000);
  const now = new Date();
  const isActive = expiryDate > now;

  // Upsert subscription record
  await db.execute(
    `INSERT INTO stp_subscriptions 
       (chain_id, contract_address, token_id, owner_address, expires_at, 
        purchase_expires_at, last_purchase_amount, last_purchase_tx_hash, 
        last_purchase_timestamp, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, NOW(), NOW())
     ON CONFLICT (chain_id, contract_address, token_id) 
     DO UPDATE SET 
       expires_at = EXCLUDED.expires_at,
       purchase_expires_at = EXCLUDED.purchase_expires_at,
       last_purchase_amount = EXCLUDED.last_purchase_amount,
       last_purchase_tx_hash = EXCLUDED.last_purchase_tx_hash,
       last_purchase_timestamp = EXCLUDED.last_purchase_timestamp,
       is_active = EXCLUDED.is_active,
       updated_at = NOW()`,
    [
      1, // TODO: Extract actual chain ID from log
      log.address.toLowerCase(),
      tokenId.toString(),
      '0x0000000000000000000000000000000000000000', // Will be set by Transfer event or backfill
      expiryDate,
      tokensTransferred.toString(),
      log.transactionHash.toLowerCase(),
      purchaseDate,
      isActive,
    ]
  );
}

/**
 * Handle Refund events
 */
async function handleRefund(log: Log, args: any): Promise<void> {
  const db = getDatabase();
  const { tokenId } = args;

  if (!log.address) return;

  // Mark subscription as inactive and clear expiry
  await db.execute(
    `UPDATE stp_subscriptions 
     SET is_active = false, expires_at = NULL, updated_at = NOW()
     WHERE contract_address = $1 AND token_id = $2`,
    [log.address.toLowerCase(), tokenId.toString()]
  );
}

/**
 * Handle Grant events (free time granted by creator)
 */
async function handleGrant(log: Log, args: any): Promise<void> {
  const db = getDatabase();
  const { tokenId, expiresAt } = args;

  if (!log.address) return;

  const expiryDate = new Date(Number(expiresAt) * 1000);
  const now = new Date();
  const isActive = expiryDate > now;

  await db.execute(
    `UPDATE stp_subscriptions 
     SET expires_at = $1, is_active = $2, updated_at = NOW()
     WHERE contract_address = $3 AND token_id = $4`,
    [expiryDate, isActive, log.address.toLowerCase(), tokenId.toString()]
  );
}

/**
 * Handle GrantRevoke events
 */
async function handleGrantRevoke(log: Log, args: any): Promise<void> {
  const db = getDatabase();
  const { tokenId, expiresAt } = args;

  if (!log.address) return;

  const expiryDate = new Date(Number(expiresAt) * 1000);
  const now = new Date();
  const isActive = expiryDate > now;

  await db.execute(
    `UPDATE stp_subscriptions 
     SET expires_at = $1, is_active = $2, updated_at = NOW()
     WHERE contract_address = $3 AND token_id = $4`,
    [expiryDate, isActive, log.address.toLowerCase(), tokenId.toString()]
  );
}

/**
 * Handle SwitchTier events
 */
async function handleSwitchTier(log: Log, args: any): Promise<void> {
  const db = getDatabase();
  const { tokenId, newTier } = args;

  if (!log.address) return;

  await db.execute(
    `UPDATE stp_subscriptions 
     SET tier_id = $1, updated_at = NOW()
     WHERE contract_address = $2 AND token_id = $3`,
    [newTier, log.address.toLowerCase(), tokenId.toString()]
  );
}

/**
 * Handle TierCreated events
 */
async function handleTierCreated(log: Log, args: any): Promise<void> {
  // Tier details would be fetched via RPC if needed
  // For now, just track that it exists
  console.log('TierCreated event:', args);
}

/**
 * Handle TierUpdated events
 */
async function handleTierUpdated(log: Log, args: any): Promise<void> {
  // Tier details would be fetched via RPC if needed
  console.log('TierUpdated event:', args);
}

/**
 * Store raw event data (idempotent, same pattern as chain-indexer)
 */
async function storeRawEvent(log: Log, eventName: string, args: any): Promise<void> {
  const db = getDatabase();

  if (!log.transactionHash || log.logIndex === undefined || !log.blockNumber || !log.address) {
    return;
  }

  await db.execute(
    `INSERT INTO stp_events 
       (chain_id, block_number, tx_hash, log_index, contract_address, event_name, event_data, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING`,
    [
      1, // TODO: Extract actual chain ID
      log.blockNumber.toString(),
      log.transactionHash.toLowerCase(),
      log.logIndex,
      log.address.toLowerCase(),
      eventName,
      JSON.stringify(args),
    ]
  );
}

/**
 * Process Factory Deployment event to register new STP contracts
 */
export async function processFactoryEvent(log: Log): Promise<void> {
  try {
    const decoded = decodeEventLog({
      abi: STPV2FactoryABI,
      data: log.data,
      topics: log.topics,
    });

    if (decoded.eventName === 'Deployment') {
      await handleDeployment(log, decoded.args);
    }
  } catch (error) {
    console.error('Error processing Factory event:', error, log);
  }
}

/**
 * Handle Deployment event from factory
 */
async function handleDeployment(log: Log, args: any): Promise<void> {
  const db = getDatabase();
  const { deployment } = args;

  if (!log.blockNumber || !log.transactionHash) return;

  // Register the new STP contract
  await db.execute(
    `INSERT INTO stp_contracts 
       (chain_id, address, creator_address, deploy_block, deploy_tx_hash, deploy_timestamp)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (chain_id, address) DO NOTHING`,
    [
      1, // TODO: Extract actual chain ID
      deployment.toLowerCase(),
      '0x0000000000000000000000000000000000000000', // TODO: Extract from transaction
      log.blockNumber.toString(),
      log.transactionHash.toLowerCase(),
    ]
  );
}
