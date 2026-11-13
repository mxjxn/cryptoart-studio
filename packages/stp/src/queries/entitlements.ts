import type { Address } from 'viem';
import { getDatabase, eq, and } from '@cryptoart/db';
import { AppPerk } from '../types/index.js';
import { APP_MEMBERSHIP_STP } from '../config/contracts.js';

/**
 * Check if a user has a specific app perk based on their STP subscription
 * 
 * @param identifier - Either a Farcaster ID (number) or Ethereum address (string)
 * @param perk - The perk to check (from AppPerk enum)
 * @returns Promise<boolean> - true if user has the perk
 * 
 * @example
 * // Check by address
 * const hasCustomGallery = await hasPerk('0x1234...', AppPerk.CUSTOM_GALLERY_URI);
 * 
 * // Check by FID
 * const hasProfileCustomization = await hasPerk(12345, AppPerk.PROFILE_CUSTOMIZATION);
 */
export async function hasPerk(
  identifier: number | Address,
  perk: AppPerk
): Promise<boolean> {
  const db = getDatabase();
  
  // Resolve address from FID if needed
  let address: Address;
  if (typeof identifier === 'number') {
    // Look up address from user cache by FID
    const result = await db.query.userCache.findFirst({
      where: (userCache, { eq }) => eq(userCache.fid, identifier),
      columns: {
        ethAddress: true,
      },
    });
    
    if (!result) {
      return false; // FID not found
    }
    address = result.ethAddress as Address;
  } else {
    address = identifier.toLowerCase() as Address;
  }

  // Check if the perk is enabled
  const perkConfig = await db.query.appPerks?.findFirst({
    where: (appPerks, { eq, and }) => and(
      eq(appPerks.perkName, perk),
      eq(appPerks.enabled, true)
    ),
  });

  if (!perkConfig) {
    return false; // Perk doesn't exist or is disabled
  }

  // Check if user has an active subscription to the app membership STP
  // Note: This queries the stp_subscriptions table which will be populated
  // by the event handler once contracts are deployed
  try {
    const subscription = await db.execute(
      `SELECT is_active, expires_at 
       FROM stp_subscriptions 
       WHERE owner_address = $1 
         AND contract_address = $2 
         AND chain_id = $3 
         AND is_active = true 
       LIMIT 1`,
      [address, APP_MEMBERSHIP_STP.address.toLowerCase(), APP_MEMBERSHIP_STP.chainId]
    );

    if (subscription.rows.length === 0) {
      return false; // No active subscription
    }

    const row = subscription.rows[0];
    
    // Double-check expiry (belt-and-suspenders with is_active)
    if (row.expires_at) {
      const expiryDate = new Date(row.expires_at);
      const now = new Date();
      if (expiryDate < now) {
        return false; // Expired
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking perk entitlement:', error);
    return false;
  }
}

/**
 * Get all perks a user currently has
 * 
 * @param identifier - Either a Farcaster ID (number) or Ethereum address (string)
 * @returns Promise<AppPerk[]> - Array of perks the user has access to
 */
export async function getUserPerks(identifier: number | Address): Promise<AppPerk[]> {
  const perks = Object.values(AppPerk);
  const results = await Promise.all(
    perks.map(async (perk) => ({
      perk,
      hasAccess: await hasPerk(identifier, perk),
    }))
  );

  return results.filter((r) => r.hasAccess).map((r) => r.perk);
}

/**
 * Get all users who have a specific perk
 * Useful for admin/analytics purposes
 * 
 * @param perk - The perk to query
 * @returns Promise<Address[]> - Array of addresses with the perk
 */
export async function getUsersWithPerk(perk: AppPerk): Promise<Address[]> {
  const db = getDatabase();

  try {
    const result = await db.execute(
      `SELECT DISTINCT owner_address 
       FROM stp_subscriptions 
       WHERE contract_address = $1 
         AND chain_id = $2 
         AND is_active = true`,
      [APP_MEMBERSHIP_STP.address.toLowerCase(), APP_MEMBERSHIP_STP.chainId]
    );

    return result.rows.map((row) => row.owner_address as Address);
  } catch (error) {
    console.error('Error fetching users with perk:', error);
    return [];
  }
}
