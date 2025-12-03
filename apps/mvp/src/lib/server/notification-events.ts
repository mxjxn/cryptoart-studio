import { request, gql } from 'graphql-request';
import { createNotification } from './notifications';
import { lookupNeynarByAddress } from '~/lib/artist-name-resolution';
import { fetchNFTMetadata } from '~/lib/nft-metadata';
import { Address } from 'viem';
import { discoverAndCacheUserBackground } from '~/lib/server/user-discovery';

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error(
    'Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL'
  );
};

/**
 * Get headers for subgraph requests, including API key if available
 */
const getSubgraphHeaders = (): Record<string, string> => {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
  return {};
};

/**
 * Query for new listings since a timestamp
 */
const NEW_LISTINGS_QUERY = gql`
  query NewListings($since: BigInt!) {
    listings(
      where: { createdAtBlock_gte: $since }
      first: 1000
      orderBy: createdAtBlock
      orderDirection: asc
    ) {
      id
      listingId
      seller
      listingType
      tokenAddress
      tokenId
      tokenSpec
      createdAtBlock
    }
  }
`;

/**
 * Query for new bids since a timestamp
 */
const NEW_BIDS_QUERY = gql`
  query NewBids($since: BigInt!) {
    bids(
      where: { timestamp_gte: $since }
      first: 1000
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      listing {
        id
        listingId
        seller
        listingType
        tokenAddress
        tokenId
        tokenSpec
      }
      bidder
      amount
      timestamp
    }
  }
`;

/**
 * Query for purchases since a timestamp
 */
const NEW_PURCHASES_QUERY = gql`
  query NewPurchases($since: BigInt!) {
    purchases(
      where: { timestamp_gte: $since }
      first: 1000
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      listing {
        id
        listingId
        seller
        listingType
        tokenAddress
        tokenId
        tokenSpec
      }
      buyer
      amount
      count
      timestamp
    }
  }
`;

/**
 * Query for finalized listings since a timestamp
 */
const FINALIZED_LISTINGS_QUERY = gql`
  query FinalizedListings($since: BigInt!) {
    listings(
      where: { finalized: true, updatedAtBlock_gte: $since }
      first: 1000
      orderBy: updatedAtBlock
      orderDirection: asc
    ) {
      id
      listingId
      seller
      listingType
      tokenAddress
      tokenId
      tokenSpec
      hasBid
      bids(orderBy: amount, orderDirection: desc, first: 1) {
        bidder
        amount
      }
      updatedAtBlock
    }
  }
`;

/**
 * Query for listing bids to find previous highest bidder
 */
const LISTING_BIDS_QUERY = gql`
  query ListingBids($listingId: BigInt!) {
    bids(
      where: { listingId: $listingId }
      orderBy: amount
      orderDirection: desc
      first: 2
    ) {
      id
      bidder
      amount
      timestamp
    }
  }
`;

/**
 * Get user name for notification
 */
async function getUserName(address: string): Promise<string> {
  const neynar = await lookupNeynarByAddress(address);
  if (neynar) {
    return neynar.name;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get artwork name for notification
 */
async function getArtworkName(
  tokenAddress: string,
  tokenId: string,
  tokenSpec: string
): Promise<string> {
  try {
    // Convert tokenSpec string to proper type
    const tokenSpecType: 'ERC721' | 'ERC1155' | number = 
      tokenSpec === 'ERC721' ? 'ERC721' :
      tokenSpec === 'ERC1155' ? 'ERC1155' :
      parseInt(tokenSpec) || 0;
    
    const metadata = await fetchNFTMetadata(
      tokenAddress as Address,
      tokenId,
      tokenSpecType
    );
    return metadata?.title || metadata?.name || `Token #${tokenId}`;
  } catch {
    return `Token #${tokenId}`;
  }
}

/**
 * Format listing type for display
 */
function formatListingType(listingType: string | number): string {
  if (typeof listingType === 'number') {
    const types = ['INVALID', 'AUCTION', 'FIXED_PRICE', 'DYNAMIC_PRICE', 'OFFERS_ONLY'];
    return types[listingType] || 'LISTING';
  }
  return String(listingType).replace(/_/g, ' ').toLowerCase();
}

/**
 * Process new listings and create notifications
 */
export async function processNewListings(sinceBlock: number): Promise<void> {
  const endpoint = getSubgraphEndpoint();
  
  try {
    const data = await request<{ listings: any[] }>(
      endpoint,
      NEW_LISTINGS_QUERY,
      { since: sinceBlock.toString() },
      getSubgraphHeaders()
    );
    
    for (const listing of data.listings || []) {
      // Discover seller in background
      discoverAndCacheUserBackground(listing.seller);
      
      const artworkName = await getArtworkName(
        listing.tokenAddress,
        listing.tokenId,
        listing.tokenSpec
      );
      const listingType = formatListingType(listing.listingType);
      
      // Notify seller
      const sellerNeynar = await lookupNeynarByAddress(listing.seller);
      await createNotification(
        listing.seller,
        'LISTING_CREATED',
        'Listing Created',
        `You created a ${listingType} ${artworkName}`,
        {
          fid: sellerNeynar?.fid,
          listingId: listing.listingId,
          metadata: {
            listingType: listing.listingType,
            artworkName,
          },
        }
      );
    }
  } catch (error) {
    console.error('[notification-events] Error processing new listings:', error);
  }
}

/**
 * Process new bids and create notifications
 */
export async function processNewBids(sinceTimestamp: number): Promise<void> {
  const endpoint = getSubgraphEndpoint();
  
  try {
    const data = await request<{ bids: any[] }>(
      endpoint,
      NEW_BIDS_QUERY,
      { since: sinceTimestamp.toString() },
      getSubgraphHeaders()
    );
    
    for (const bid of data.bids || []) {
      if (!bid.listing) continue;
      
      const listing = bid.listing;
      
      // Discover bidder and seller in background
      discoverAndCacheUserBackground(bid.bidder);
      discoverAndCacheUserBackground(listing.seller);
      
      const artworkName = await getArtworkName(
        listing.tokenAddress,
        listing.tokenId,
        listing.tokenSpec
      );
      const bidderName = await getUserName(bid.bidder);
      const amount = BigInt(bid.amount).toString();
      
      // Notify seller
      const sellerNeynar = await lookupNeynarByAddress(listing.seller);
      await createNotification(
        listing.seller,
        'NEW_BID',
        'New Bid',
        `New bid on ${artworkName} from ${bidderName} for ${amount}`,
        {
          fid: sellerNeynar?.fid,
          listingId: listing.listingId,
          metadata: {
            bidder: bid.bidder,
            amount: bid.amount,
            artworkName,
          },
        }
      );
      
      // Notify bidder
      const bidderNeynar = await lookupNeynarByAddress(bid.bidder);
      await createNotification(
        bid.bidder,
        'BID_PLACED',
        'Bid Placed',
        `You've placed a bid on ${artworkName}`,
        {
          fid: bidderNeynar?.fid,
          listingId: listing.listingId,
          metadata: {
            amount: bid.amount,
            artworkName,
          },
        }
      );
      
      // Notify previous highest bidder if they were outbid
      try {
        // Query all bids for this listing, sorted by amount descending
        // We fetch the top 2 to efficiently get the highest and second-highest bids
        const bidsData = await request<{ bids: any[] }>(
          endpoint,
          LISTING_BIDS_QUERY,
          { listingId: listing.listingId },
          getSubgraphHeaders()
        );
        
        if (!bidsData.bids || bidsData.bids.length < 2) {
          // First bid on this listing, no one to outbid
          continue;
        }
        
        const newBidAmount = BigInt(bid.amount);
        const currentBidderLower = bid.bidder.toLowerCase();
        
        // Find the previous highest bidder (the highest bid that's NOT from the current bidder)
        // Since bids are sorted by amount desc, we iterate to find the first bid
        // from a different bidder that's less than the new bid amount
        let previousHighestBid = null;
        for (const existingBid of bidsData.bids) {
          const existingBidAmount = BigInt(existingBid.amount);
          const isCurrentBidder = existingBid.bidder.toLowerCase() === currentBidderLower;
          
          // Skip if this is the current bidder's bid
          if (isCurrentBidder) {
            continue;
          }
          
          // If this bid is less than the new bid, this bidder was outbid
          // Since bids are sorted desc, this is the previous highest bidder
          if (existingBidAmount < newBidAmount) {
            previousHighestBid = existingBid;
            break; // Found the previous highest bidder
          }
        }
        
        // If we found a previous highest bidder who was outbid, notify them
        if (previousHighestBid) {
          // Discover previous bidder in background
          discoverAndCacheUserBackground(previousHighestBid.bidder);
          const previousBidderNeynar = await lookupNeynarByAddress(previousHighestBid.bidder);
          const newBidAmountStr = newBidAmount.toString();
          const previousBidAmountStr = BigInt(previousHighestBid.amount).toString();
          
          await createNotification(
            previousHighestBid.bidder,
            'OUTBID',
            'You\'ve Been Outbid',
            `You've been outbid on ${artworkName}. New highest bid: ${newBidAmountStr} (your bid: ${previousBidAmountStr})`,
            {
              fid: previousBidderNeynar?.fid,
              listingId: listing.listingId,
              metadata: {
                newHighestBid: bid.amount,
                previousBid: previousHighestBid.amount,
                artworkName,
              },
            }
          );
        }
      } catch (error) {
        // Don't fail the whole process if outbid notification fails
        // Log the error for debugging but continue processing other bids
        console.error(
          `[notification-events] Error notifying previous bidder for listing ${listing.listingId}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error('[notification-events] Error processing new bids:', error);
  }
}

/**
 * Process purchases and create notifications
 */
export async function processPurchases(sinceTimestamp: number): Promise<void> {
  const endpoint = getSubgraphEndpoint();
  
  try {
    const data = await request<{ purchases: any[] }>(
      endpoint,
      NEW_PURCHASES_QUERY,
      { since: sinceTimestamp.toString() },
      getSubgraphHeaders()
    );
    
    for (const purchase of data.purchases || []) {
      if (!purchase.listing) continue;
      
      const listing = purchase.listing;
      
      // Discover buyer and seller in background
      discoverAndCacheUserBackground(purchase.buyer);
      discoverAndCacheUserBackground(listing.seller);
      
      const artworkName = await getArtworkName(
        listing.tokenAddress,
        listing.tokenId,
        listing.tokenSpec
      );
      const buyerName = await getUserName(purchase.buyer);
      const amount = BigInt(purchase.amount).toString();
      const isERC1155 = listing.tokenSpec === 'ERC1155' || listing.tokenSpec === 2;
      
      // Notify seller
      const sellerNeynar = await lookupNeynarByAddress(listing.seller);
      await createNotification(
        listing.seller,
        'BUY_NOW_SALE',
        'Sale Completed',
        `New sale on ${artworkName} to ${buyerName} for ${amount}`,
        {
          fid: sellerNeynar?.fid,
          listingId: listing.listingId,
          metadata: {
            buyer: purchase.buyer,
            amount: purchase.amount,
            count: purchase.count,
            artworkName,
          },
        }
      );
      
      // Notify buyer
      const buyerNeynar = await lookupNeynarByAddress(purchase.buyer);
      const notificationType = isERC1155 ? 'ERC1155_PURCHASE' : 'ERC721_PURCHASE';
      const message = isERC1155
        ? `You bought ${purchase.count} ${artworkName}`
        : `You purchased ${artworkName}`;
      
      await createNotification(
        purchase.buyer,
        notificationType,
        'Purchase Completed',
        message,
        {
          fid: buyerNeynar?.fid,
          listingId: listing.listingId,
          metadata: {
            amount: purchase.amount,
            count: purchase.count,
            artworkName,
          },
        }
      );
    }
  } catch (error) {
    console.error('[notification-events] Error processing purchases:', error);
  }
}

/**
 * Process finalized listings and create notifications
 */
export async function processFinalizedListings(sinceBlock: number): Promise<void> {
  const endpoint = getSubgraphEndpoint();
  
  try {
    const data = await request<{ listings: any[] }>(
      endpoint,
      FINALIZED_LISTINGS_QUERY,
      { since: sinceBlock.toString() },
      getSubgraphHeaders()
    );
    
    for (const listing of data.listings || []) {
      const artworkName = await getArtworkName(
        listing.tokenAddress,
        listing.tokenId,
        listing.tokenSpec
      );
      
      if (listing.hasBid && listing.bids && listing.bids.length > 0) {
        // Auction won
        const winningBid = listing.bids[0];
        
        // Discover winner and seller in background
        discoverAndCacheUserBackground(winningBid.bidder);
        discoverAndCacheUserBackground(listing.seller);
        
        const winnerName = await getUserName(winningBid.bidder);
        const amount = BigInt(winningBid.amount).toString();
        
        // Notify winner
        const winnerNeynar = await lookupNeynarByAddress(winningBid.bidder);
        await createNotification(
          winningBid.bidder,
          'AUCTION_WON',
          'Auction Won',
          `Auction ${artworkName} won by ${winnerName} for ${amount}`,
          {
            fid: winnerNeynar?.fid,
            listingId: listing.listingId,
            metadata: {
              amount: winningBid.amount,
              artworkName,
            },
          }
        );
      } else {
        // Auction ended without bids
        const sellerNeynar = await lookupNeynarByAddress(listing.seller);
        await createNotification(
          listing.seller,
          'AUCTION_ENDED_NO_BIDS',
          'Auction Ended',
          `Auction ended without any bids`,
          {
            fid: sellerNeynar?.fid,
            listingId: listing.listingId,
            metadata: {
              artworkName,
            },
          }
        );
      }
    }
  } catch (error) {
    console.error('[notification-events] Error processing finalized listings:', error);
  }
}

/**
 * Process all events since a given block/timestamp
 * This is the main entry point for the notification worker
 */
export async function processEventsSince(
  sinceBlock: number,
  sinceTimestamp: number
): Promise<void> {
  await Promise.all([
    processNewListings(sinceBlock),
    processNewBids(sinceTimestamp),
    processPurchases(sinceTimestamp),
    processFinalizedListings(sinceBlock),
  ]);
}

