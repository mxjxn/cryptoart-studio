/**
 * Database storage utilities for auction house indexer
 */

import { getDatabase } from '@repo/db';
import { auctionListings, auctionBids } from '@repo/db';
import { eq } from 'drizzle-orm';

const db = getDatabase();

/**
 * Decode CreateListing event data
 */
export function decodeCreateListingEvent(logData, topics) {
  // CreateListing event structure:
  // topic[0]: event signature
  // topic[1]: listingId (indexed uint40)
  // data: marketplaceBPS (uint16), referrerBPS (uint16), listingType (uint8), 
  //       totalAvailable (uint24), totalPerSale (uint24), startTime (uint48), 
  //       endTime (uint48), initialAmount (uint256), extensionInterval (uint16),
  //       minIncrementBPS (uint16), erc20 (address), identityVerifier (address)
  
  const listingId = parseInt(topics[1], 16);
  
  // Decode data (skip first 2 bytes for function selector if present)
  let offset = 2; // Skip 0x prefix
  
  // Note: This is a simplified decoder - in production, use ethers.js ABI decoder
  // For now, we'll need to fetch full listing data from contract
  
  return {
    listingId,
    // Other fields will be fetched from contract
  };
}

/**
 * Decode CreateListingTokenDetails event
 */
export function decodeTokenDetailsEvent(logData, topics) {
  const listingId = parseInt(topics[1], 16);
  
  // Decode: id (uint256), address_ (address), spec (uint8), lazy (bool)
  // This is simplified - use proper ABI decoding
  
  return {
    listingId,
    // Fields will be decoded properly
  };
}

/**
 * Store or update listing in database
 */
export async function upsertListing(listingData) {
  try {
    const existing = await db
      .select()
      .from(auctionListings)
      .where(eq(auctionListings.listingId, listingData.listingId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing listing
      await db
        .update(auctionListings)
        .set({
          ...listingData,
          updatedAt: new Date(),
        })
        .where(eq(auctionListings.listingId, listingData.listingId));
    } else {
      // Insert new listing
      await db.insert(auctionListings).values({
        ...listingData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    console.error('Error upserting listing:', error);
    throw error;
  }
}

/**
 * Store bid in database
 */
export async function insertBid(bidData) {
  try {
    await db.insert(auctionBids).values({
      ...bidData,
      timestamp: new Date(),
    });

    // Update listing's current bid
    await db
      .update(auctionListings)
      .set({
        currentBidAmount: bidData.amount,
        currentBidder: bidData.bidder,
        currentBidTimestamp: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(auctionListings.listingId, bidData.listingId));
  } catch (error) {
    console.error('Error inserting bid:', error);
    throw error;
  }
}

/**
 * Update listing status (finalized, canceled, etc.)
 */
export async function updateListingStatus(listingId, updates) {
  try {
    await db
      .update(auctionListings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(auctionListings.listingId, listingId));
  } catch (error) {
    console.error('Error updating listing status:', error);
    throw error;
  }
}

