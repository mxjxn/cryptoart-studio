import type { Address } from 'viem';
import { getDatabase } from '@cryptoart/db';

/**
 * Get all currently active subscribers for a specific STP contract
 * Used for airdrops to active supporters
 * 
 * @param contractAddress - The STP contract address
 * @param chainId - The chain ID (8453 for Base, 1 for Ethereum)
 * @returns Promise<Address[]> - Array of owner addresses with active subscriptions
 * 
 * @example
 * const activeSubscribers = await getActiveSubscribers('0x1234...', 8453);
 * // Use with SuchCollection multi-recipient airdrop
 */
export async function getActiveSubscribers(
  contractAddress: Address,
  chainId: number
): Promise<Address[]> {
  const db = getDatabase();

  try {
    const result = await db.execute(
      `SELECT DISTINCT owner_address 
       FROM stp_subscriptions 
       WHERE contract_address = $1 
         AND chain_id = $2 
         AND is_active = true 
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY owner_address`,
      [contractAddress.toLowerCase(), chainId]
    );

    return result.rows.map((row) => row.owner_address as Address);
  } catch (error) {
    console.error('Error fetching active subscribers:', error);
    return [];
  }
}

/**
 * Get all STP NFT holders (including lapsed/inactive subscriptions)
 * Used for airdrops to all past and present supporters
 * 
 * @param contractAddress - The STP contract address
 * @param chainId - The chain ID (8453 for Base, 1 for Ethereum)
 * @returns Promise<Address[]> - Array of all owner addresses who ever held an STP NFT
 * 
 * @example
 * const allHolders = await getAllStpHolders('0x1234...', 8453);
 * // Includes both active and lapsed subscribers
 */
export async function getAllStpHolders(
  contractAddress: Address,
  chainId: number
): Promise<Address[]> {
  const db = getDatabase();

  try {
    const result = await db.execute(
      `SELECT DISTINCT owner_address 
       FROM stp_subscriptions 
       WHERE contract_address = $1 
         AND chain_id = $2
       ORDER BY owner_address`,
      [contractAddress.toLowerCase(), chainId]
    );

    return result.rows.map((row) => row.owner_address as Address);
  } catch (error) {
    console.error('Error fetching all STP holders:', error);
    return [];
  }
}

/**
 * Get active subscribers for a specific tier
 * Useful for tier-specific airdrops or perks
 * 
 * @param contractAddress - The STP contract address
 * @param chainId - The chain ID
 * @param tierId - The tier ID (0 for default tier)
 * @returns Promise<Address[]> - Array of addresses subscribed to the tier
 */
export async function getActiveSubscribersByTier(
  contractAddress: Address,
  chainId: number,
  tierId: number
): Promise<Address[]> {
  const db = getDatabase();

  try {
    const result = await db.execute(
      `SELECT DISTINCT owner_address 
       FROM stp_subscriptions 
       WHERE contract_address = $1 
         AND chain_id = $2 
         AND tier_id = $3
         AND is_active = true 
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY owner_address`,
      [contractAddress.toLowerCase(), chainId, tierId]
    );

    return result.rows.map((row) => row.owner_address as Address);
  } catch (error) {
    console.error('Error fetching active subscribers by tier:', error);
    return [];
  }
}

/**
 * Get subscription stats for a contract (useful for UI displays)
 * 
 * @param contractAddress - The STP contract address
 * @param chainId - The chain ID
 * @returns Promise with active/total counts and tier breakdown
 */
export async function getSubscriptionStats(
  contractAddress: Address,
  chainId: number
): Promise<{
  activeCount: number;
  totalCount: number;
  tierBreakdown: { tierId: number; count: number }[];
}> {
  const db = getDatabase();

  try {
    // Get total and active counts
    const countsResult = await db.execute(
      `SELECT 
         COUNT(*) as total_count,
         COUNT(*) FILTER (WHERE is_active = true) as active_count
       FROM stp_subscriptions 
       WHERE contract_address = $1 AND chain_id = $2`,
      [contractAddress.toLowerCase(), chainId]
    );

    // Get tier breakdown
    const tierResult = await db.execute(
      `SELECT 
         tier_id,
         COUNT(*) as count
       FROM stp_subscriptions 
       WHERE contract_address = $1 
         AND chain_id = $2 
         AND is_active = true
       GROUP BY tier_id
       ORDER BY tier_id`,
      [contractAddress.toLowerCase(), chainId]
    );

    const counts = countsResult.rows[0] || { total_count: 0, active_count: 0 };

    return {
      activeCount: Number(counts.active_count || 0),
      totalCount: Number(counts.total_count || 0),
      tierBreakdown: tierResult.rows.map((row) => ({
        tierId: Number(row.tier_id),
        count: Number(row.count),
      })),
    };
  } catch (error) {
    console.error('Error fetching subscription stats:', error);
    return {
      activeCount: 0,
      totalCount: 0,
      tierBreakdown: [],
    };
  }
}

/**
 * Get top supporters by purchase amount (for leaderboards/recognition)
 * 
 * @param contractAddress - The STP contract address
 * @param chainId - The chain ID
 * @param limit - Maximum number of results (default 100)
 * @returns Promise with addresses and total purchase amounts
 */
export async function getTopSupporters(
  contractAddress: Address,
  chainId: number,
  limit: number = 100
): Promise<{ address: Address; totalSpent: bigint }[]> {
  const db = getDatabase();

  try {
    const result = await db.execute(
      `SELECT 
         owner_address,
         SUM(last_purchase_amount) as total_spent
       FROM stp_subscriptions 
       WHERE contract_address = $1 
         AND chain_id = $2
         AND last_purchase_amount IS NOT NULL
       GROUP BY owner_address
       ORDER BY total_spent DESC
       LIMIT $3`,
      [contractAddress.toLowerCase(), chainId, limit]
    );

    return result.rows.map((row) => ({
      address: row.owner_address as Address,
      totalSpent: BigInt(row.total_spent || 0),
    }));
  } catch (error) {
    console.error('Error fetching top supporters:', error);
    return [];
  }
}
