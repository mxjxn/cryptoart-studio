import { request, gql } from 'graphql-request';
import { createNotification } from './notifications';
import { lookupNeynarByAddress } from '~/lib/artist-name-resolution';
import { fetchNFTMetadata } from '~/lib/nft-metadata';
import { Address, createPublicClient, http, isAddress, zeroAddress } from 'viem';
import { base } from 'viem/chains';
import { discoverAndCacheUserBackground } from '~/lib/server/user-discovery';
import { formatPriceForShare } from '~/lib/share-moments';

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
      status
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
        erc20
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
        erc20
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
      erc20
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
 * Query for ended auctions (endTime <= now, not finalized)
 */
const ENDED_AUCTIONS_QUERY = gql`
  query EndedAuctions($now: BigInt!) {
    listings(
      where: {
        status: "ACTIVE"
        finalized: false
        listingType: 1
        endTime_lte: $now
      }
      first: 1000
      orderBy: endTime
      orderDirection: desc
    ) {
      id
      listingId
      seller
      listingType
      tokenAddress
      tokenId
      tokenSpec
      erc20
      startTime
      endTime
      hasBid
      bids(orderBy: amount, orderDirection: desc, first: 1) {
        bidder
        amount
        timestamp
      }
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
 * Check if token address is ETH (zero address)
 */
function isETH(tokenAddress: string | undefined | null): boolean {
  if (!tokenAddress) return true;
  return tokenAddress.toLowerCase() === zeroAddress.toLowerCase();
}

/**
 * Get ERC20 token info (symbol and decimals)
 */
async function getERC20TokenInfo(tokenAddress: string): Promise<{ symbol: string; decimals: number } | null> {
  if (isETH(tokenAddress) || !isAddress(tokenAddress)) {
    return { symbol: 'ETH', decimals: 18 };
  }

  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(
        process.env.NEXT_PUBLIC_RPC_URL || 
        process.env.RPC_URL || 
        process.env.NEXT_PUBLIC_BASE_RPC_URL || 
        "https://mainnet.base.org"
      ),
    });

    const ERC20_ABI = [
      {
        type: "function",
        name: "symbol",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view",
      },
      {
        type: "function",
        name: "decimals",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }],
        stateMutability: "view",
      },
    ] as const;

    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "symbol",
      }),
      publicClient.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "decimals",
      }),
    ]);

    return {
      symbol: symbol as string,
      decimals: decimals as number,
    };
  } catch (error) {
    console.error(`[Notification Events] Error fetching ERC20 token info for ${tokenAddress}:`, error);
    // Default to ETH if we can't fetch token info
    return { symbol: 'ETH', decimals: 18 };
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
  const { getDatabase, follows, eq } = await import('@cryptoart/db');
  
  try {
    const data = await request<{ listings: any[] }>(
      endpoint,
      NEW_LISTINGS_QUERY,
      { since: sinceBlock.toString() },
      getSubgraphHeaders()
    );
    
    for (const listing of data.listings || []) {
      // Skip cancelled listings - don't generate thumbnails or send notifications
      if (listing.status === "CANCELLED") {
        continue;
      }
      
      // Discover seller in background
      discoverAndCacheUserBackground(listing.seller);
      
      // Generate thumbnails in background (fire and forget)
      // This ensures thumbnails are ready before users view listings
      if (listing.tokenAddress && listing.tokenId) {
        const { generateThumbnailsBackground } = await import('./background-thumbnails');
        const { fetchNFTMetadata } = await import('~/lib/nft-metadata');
        
        // Fetch metadata and generate thumbnails in background (non-blocking)
        Promise.resolve().then(async () => {
          try {
            const metadata = await fetchNFTMetadata(
              listing.tokenAddress,
              listing.tokenId,
              listing.tokenSpec
            );
            if (metadata?.image) {
              await generateThumbnailsBackground(metadata.image, listing.listingId, ['small', 'homepage', 'medium']);
            }
          } catch (error) {
            // Don't log errors - this is background work
            // Thumbnails will be generated on-demand if this fails
          }
        }).catch(() => {
          // Silently fail - thumbnails will be generated on-demand
        });
      }
      
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
      
      // Notify followers of the seller
      try {
        const db = getDatabase();
        const normalizedSeller = listing.seller.toLowerCase();
        const followers = await db.select()
          .from(follows)
          .where(eq(follows.followingAddress, normalizedSeller));
        
        const sellerName = await getUserName(listing.seller);
        
        for (const follow of followers) {
          const followerNeynar = await lookupNeynarByAddress(follow.followerAddress);
          await createNotification(
            follow.followerAddress,
            'FOLLOWED_USER_NEW_LISTING',
            'New Listing from Followed User',
            `${sellerName} created a new ${listingType}: ${artworkName}`,
            {
              fid: followerNeynar?.fid,
              listingId: listing.listingId,
              metadata: {
                seller: listing.seller,
                listingType: listing.listingType,
                artworkName,
              },
            }
          );
        }
      } catch (error) {
        console.error('[notification-events] Error notifying followers:', error);
        // Don't fail the whole process if follower notifications fail
      }
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
      
      // Get token info for formatting the bid amount
      const tokenInfo = await getERC20TokenInfo(listing.erc20 || null);
      const tokenSymbol = tokenInfo?.symbol || 'ETH';
      const tokenDecimals = tokenInfo?.decimals || 18;
      const formattedAmount = formatPriceForShare(bid.amount, tokenDecimals);
      
      // Notify seller
      const sellerNeynar = await lookupNeynarByAddress(listing.seller);
      await createNotification(
        listing.seller,
        'NEW_BID',
        'New Bid',
        `New bid on ${artworkName} from ${bidderName} for ${formattedAmount} ${tokenSymbol}`,
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
      
      // Notify users who favorited this listing
      try {
        const { getDatabase, favorites, eq } = await import('@cryptoart/db');
        const db = getDatabase();
        const favoritedUsers = await db.select()
          .from(favorites)
          .where(eq(favorites.listingId, listing.listingId));
        
        // Get token info for formatting (already fetched above)
        const favoritedFormattedAmount = formatPriceForShare(bid.amount, tokenDecimals);
        
        for (const favorite of favoritedUsers) {
          // Don't notify the bidder or seller (they already got notifications)
          if (favorite.userAddress.toLowerCase() === bid.bidder.toLowerCase() ||
              favorite.userAddress.toLowerCase() === listing.seller.toLowerCase()) {
            continue;
          }
          
          const favoriterNeynar = await lookupNeynarByAddress(favorite.userAddress);
          await createNotification(
            favorite.userAddress,
            'FAVORITE_NEW_BID',
            'New Bid on Favorited Listing',
            `${artworkName} received a new bid: ${favoritedFormattedAmount} ${tokenSymbol}`,
            {
              fid: favoriterNeynar?.fid,
              listingId: listing.listingId,
              metadata: {
                bidder: bid.bidder,
                amount: bid.amount,
                artworkName,
              },
            }
          );
        }
      } catch (error) {
        console.error('[notification-events] Error notifying favorited users:', error);
        // Don't fail the whole process if favorite notifications fail
      }
      
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
          // Use token info already fetched above
          const newBidFormatted = formatPriceForShare(bid.amount, tokenDecimals);
          const previousBidFormatted = formatPriceForShare(previousHighestBid.amount, tokenDecimals);
          
          await createNotification(
            previousHighestBid.bidder,
            'OUTBID',
            'You\'ve Been Outbid',
            `You've been outbid on ${artworkName}. New highest bid: ${newBidFormatted} ${tokenSymbol} (your bid: ${previousBidFormatted} ${tokenSymbol})`,
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
      
      // Get token info for formatting the purchase amount
      const tokenInfo = await getERC20TokenInfo(listing.erc20 || null);
      const tokenSymbol = tokenInfo?.symbol || 'ETH';
      const tokenDecimals = tokenInfo?.decimals || 18;
      const formattedAmount = formatPriceForShare(purchase.amount, tokenDecimals);
      
      const isERC1155 = listing.tokenSpec === 'ERC1155' || listing.tokenSpec === 2;
      
      // Notify seller
      const sellerNeynar = await lookupNeynarByAddress(listing.seller);
      await createNotification(
        listing.seller,
        'BUY_NOW_SALE',
        'Sale Completed',
        `New sale on ${artworkName} to ${buyerName} for ${formattedAmount} ${tokenSymbol}`,
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
      
      // For ERC1155 listings, check if stock is running low and notify favorited users
      if (isERC1155) {
        try {
          // Get current listing state to check remaining stock
          const listingData = await request<{ listing: any }>(
            endpoint,
            gql`
              query GetListing($listingId: BigInt!) {
                listing(id: $listingId) {
                  totalAvailable
                  totalSold
                }
              }
            `,
            { listingId: listing.listingId },
            getSubgraphHeaders()
          );
          
          if (listingData.listing) {
            const totalAvailable = parseInt(listingData.listing.totalAvailable || '0');
            const totalSold = parseInt(listingData.listing.totalSold || '0');
            const remaining = totalAvailable - totalSold;
            
            // Notify favorited users if only 1 left
            if (remaining === 1) {
              const { getDatabase, favorites, eq } = await import('@cryptoart/db');
              const db = getDatabase();
              const favoritedUsers = await db.select()
                .from(favorites)
                .where(eq(favorites.listingId, listing.listingId));
              
              for (const favorite of favoritedUsers) {
                // Don't notify the buyer or seller
                if (favorite.userAddress.toLowerCase() === purchase.buyer.toLowerCase() ||
                    favorite.userAddress.toLowerCase() === listing.seller.toLowerCase()) {
                  continue;
                }
                
                const favoriterNeynar = await lookupNeynarByAddress(favorite.userAddress);
                const sellerName = await getUserName(listing.seller);
                await createNotification(
                  favorite.userAddress,
                  'FAVORITE_LOW_STOCK',
                  'Low Stock Alert',
                  `Only one ${artworkName} by ${sellerName} left!`,
                  {
                    fid: favoriterNeynar?.fid,
                    listingId: listing.listingId,
                    metadata: {
                      artworkName,
                      seller: listing.seller,
                      remaining: 1,
                    },
                  }
                );
              }
            }
          }
        } catch (error) {
          console.error('[notification-events] Error checking low stock:', error);
          // Don't fail the whole process if low stock check fails
        }
      }
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
        
        // Get token info for formatting the bid amount
        const tokenInfo = await getERC20TokenInfo(listing.erc20 || null);
        const tokenSymbol = tokenInfo?.symbol || 'ETH';
        const tokenDecimals = tokenInfo?.decimals || 18;
        const formattedAmount = formatPriceForShare(winningBid.amount, tokenDecimals);
        
        // Notify winner
        const winnerNeynar = await lookupNeynarByAddress(winningBid.bidder);
        await createNotification(
          winningBid.bidder,
          'AUCTION_WON',
          'Auction Won',
          `Auction ${artworkName} won by ${winnerName} for ${formattedAmount} ${tokenSymbol}`,
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
 * Process ended auctions (endTime <= now, not yet finalized) and create notifications
 * This detects auctions that have naturally ended but haven't been finalized yet
 */
export async function processEndedAuctions(): Promise<void> {
  const endpoint = getSubgraphEndpoint();
  const now = Math.floor(Date.now() / 1000);
  
  try {
    const data = await request<{ listings: any[] }>(
      endpoint,
      ENDED_AUCTIONS_QUERY,
      { now: now.toString() },
      getSubgraphHeaders()
    );
    
    for (const listing of data.listings || []) {
      // Skip if already finalized (shouldn't happen with the query, but double-check)
      if (listing.finalized) {
        continue;
      }
      
      // Filter out start-on-first-bid auctions that haven't actually ended
      // For startTime=0 auctions, endTime is a duration, not a timestamp
      // We need to check if the auction has actually ended by calculating actualEndTime
      const startTime = parseInt(listing.startTime || "0", 10);
      const endTime = parseInt(listing.endTime || "0", 10);
      const hasBid = listing.hasBid || (listing.bids && listing.bids.length > 0);
      
      if (startTime === 0) {
        // Start-on-first-bid auction
        if (!hasBid) {
          // Auction hasn't started yet - endTime is a duration, not a timestamp
          // Skip this listing as it hasn't actually ended
          console.log(`[notification-events] Skipping listing ${listing.listingId}: start-on-first-bid auction hasn't started yet (no bids)`);
          continue;
        }
        
        // Auction has started - need to calculate actual end time
        // endTime could be either:
        // 1. A duration (if subgraph hasn't updated yet) - need firstBidTimestamp + endTime
        // 2. A timestamp (if contract has converted it) - use as-is
        const ONE_YEAR_IN_SECONDS = 31536000;
        let actualEndTime: number;
        
        if (endTime > now) {
          // endTime is greater than now, so it's likely a timestamp and auction hasn't ended
          console.log(`[notification-events] Skipping listing ${listing.listingId}: start-on-first-bid auction with endTime=${endTime} (timestamp) > now=${now}`);
          continue;
        } else if (endTime <= ONE_YEAR_IN_SECONDS) {
          // endTime is a small number (duration), need to calculate from first bid
          const firstBid = listing.bids && listing.bids.length > 0 ? listing.bids[0] : null;
          if (firstBid && firstBid.timestamp) {
            const firstBidTimestamp = parseInt(firstBid.timestamp, 10);
            actualEndTime = firstBidTimestamp + endTime;
          } else {
            // Can't calculate without first bid timestamp - skip to be safe
            console.log(`[notification-events] Skipping listing ${listing.listingId}: start-on-first-bid auction, can't determine actual end time (missing first bid timestamp)`);
            continue;
          }
        } else {
          // endTime is a large number (timestamp) and <= now, so it's actually ended
          actualEndTime = endTime;
        }
        
        // Check if auction has actually ended
        if (actualEndTime > now) {
          console.log(`[notification-events] Skipping listing ${listing.listingId}: start-on-first-bid auction hasn't ended yet (actualEndTime=${actualEndTime} > now=${now})`);
          continue;
        }
      } else {
        // Fixed start time auction - endTime is always a timestamp
        // Query already filtered by endTime_lte: $now, so this should be correct
        // But double-check to be safe
        if (endTime > now) {
          console.log(`[notification-events] Skipping listing ${listing.listingId}: fixed start time auction with endTime=${endTime} > now=${now} (shouldn't happen with query filter)`);
          continue;
        }
      }
      
      const artworkName = await getArtworkName(
        listing.tokenAddress,
        listing.tokenId,
        listing.tokenSpec
      );
      
      // Get winning bid if exists (use first bid from bids array, which is highest due to ordering)
      const winningBid = listing.bids && listing.bids.length > 0 ? listing.bids[0] : null;
      
      if (winningBid && listing.hasBid) {
        // Auction ended with bids - notify winner and seller
        const winnerAddress = winningBid.bidder;
        
        // Discover winner and seller in background
        discoverAndCacheUserBackground(winnerAddress);
        discoverAndCacheUserBackground(listing.seller);
        
        const winnerName = await getUserName(winnerAddress);
        
        // Get token info for formatting the bid amount
        const tokenInfo = await getERC20TokenInfo(listing.erc20 || null);
        const tokenSymbol = tokenInfo?.symbol || 'ETH';
        const tokenDecimals = tokenInfo?.decimals || 18;
        const formattedAmount = formatPriceForShare(winningBid.amount, tokenDecimals);
        
        // Notify winner - auction ended, they won
        const winnerNeynar = await lookupNeynarByAddress(winnerAddress);
        await createNotification(
          winnerAddress,
          'AUCTION_ENDED_WON',
          'Auction Ended - You Won!',
          `Auction for ${artworkName} has ended. You won with a bid of ${formattedAmount} ${tokenSymbol}! Finalize to claim your NFT.`,
          {
            fid: winnerNeynar?.fid,
            listingId: listing.listingId,
            metadata: {
              amount: winningBid.amount,
              artworkName,
            },
          }
        );
        
        // Notify seller - auction ended, ready to finalize
        const sellerNeynar = await lookupNeynarByAddress(listing.seller);
        await createNotification(
          listing.seller,
          'AUCTION_ENDED_READY_TO_FINALIZE',
          'Auction Ended - Ready to Finalize',
          `Auction for ${artworkName} has ended. ${winnerName} won with a bid of ${formattedAmount} ${tokenSymbol}. Finalize to complete the sale.`,
          {
            fid: sellerNeynar?.fid,
            listingId: listing.listingId,
            metadata: {
              winner: winnerAddress,
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
          `Auction for ${artworkName} has ended without any bids.`,
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
    console.error('[notification-events] Error processing ended auctions:', error);
  }
}

/**
 * Check for listings ending soon and notify favorited users
 * This should be called periodically (e.g., every 15 minutes)
 */
export async function processEndingSoonListings(): Promise<void> {
  const endpoint = getSubgraphEndpoint();
  const { getDatabase, favorites, eq, inArray } = await import('@cryptoart/db');
  
  try {
    // Get current time and 1 hour from now (in seconds)
    const now = Math.floor(Date.now() / 1000);
    const oneHourFromNow = now + 3600;
    
    // Query active listings ending within the next hour
    const data = await request<{ listings: any[] }>(
      endpoint,
      gql`
        query EndingSoonListings($now: BigInt!, $oneHourFromNow: BigInt!) {
          listings(
            where: {
              status: "ACTIVE"
              finalized: false
              endTime_gte: $now
              endTime_lte: $oneHourFromNow
            }
            first: 1000
          ) {
            id
            listingId
            seller
            endTime
            listingType
            tokenAddress
            tokenId
            tokenSpec
            bids(orderBy: amount, orderDirection: desc, first: 1) {
              amount
            }
          }
        }
      `,
      {
        now: now.toString(),
        oneHourFromNow: oneHourFromNow.toString(),
      },
      getSubgraphHeaders()
    );
    
    if (!data.listings || data.listings.length === 0) {
      return;
    }
    
    const listingIds = data.listings.map(l => l.listingId);
    const db = getDatabase();
    
    // Get all favorites for these listings
    const allFavorites = await db.select()
      .from(favorites)
      .where(inArray(favorites.listingId, listingIds));
    
    // Group favorites by listingId
    const favoritesByListing = new Map<string, typeof allFavorites>();
    for (const favorite of allFavorites) {
      if (!favoritesByListing.has(favorite.listingId)) {
        favoritesByListing.set(favorite.listingId, []);
      }
      favoritesByListing.get(favorite.listingId)!.push(favorite);
    }
    
    // Process each listing
    for (const listing of data.listings) {
      const listingFavorites = favoritesByListing.get(listing.listingId) || [];
      if (listingFavorites.length === 0) continue;
      
      const artworkName = await getArtworkName(
        listing.tokenAddress,
        listing.tokenId,
        listing.tokenSpec
      );
      
      // Calculate time remaining
      const endTime = parseInt(listing.endTime);
      const timeRemaining = endTime - now;
      const hoursRemaining = Math.floor(timeRemaining / 3600);
      const minutesRemaining = Math.floor((timeRemaining % 3600) / 60);
      
      let timeString = '';
      if (hoursRemaining > 0) {
        timeString = `${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}`;
      } else {
        timeString = `${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}`;
      }
      
      // Format current bid (use first bid from bids array, which is highest due to ordering)
      let bidInfo = '';
      const highestBid = listing.bids && listing.bids.length > 0 ? listing.bids[0] : null;
      if (highestBid && highestBid.amount) {
        try {
          const bidAmount = BigInt(highestBid.amount);
          const ethValue = Number(bidAmount) / 1e18;
          bidInfo = ` (current bid ${ethValue.toFixed(4)} ETH)`;
        } catch {
          bidInfo = '';
        }
      }
      
      const sellerName = await getUserName(listing.seller);
      
      // Notify each user who favorited this listing
      for (const favorite of listingFavorites) {
        // Don't notify the seller
        if (favorite.userAddress.toLowerCase() === listing.seller.toLowerCase()) {
          continue;
        }
        
        const favoriterNeynar = await lookupNeynarByAddress(favorite.userAddress);
        await createNotification(
          favorite.userAddress,
          'FAVORITE_ENDING_SOON',
          'Favorited Listing Ending Soon',
          `${artworkName} by ${sellerName} ends in ${timeString}${bidInfo}`,
          {
            fid: favoriterNeynar?.fid,
            listingId: listing.listingId,
            metadata: {
              artworkName,
              seller: listing.seller,
              endTime: listing.endTime,
              timeRemaining,
              currentBid: (listing.bids && listing.bids.length > 0 ? listing.bids[0].amount : null),
            },
          }
        );
      }
    }
  } catch (error) {
    console.error('[notification-events] Error processing ending soon listings:', error);
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
    processEndedAuctions(), // Check for auctions that have ended but not been finalized
  ]);
}

