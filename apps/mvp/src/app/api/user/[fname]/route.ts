import { NextRequest, NextResponse } from "next/server";
import { request, gql } from "graphql-request";
import { 
  getDatabase, 
  userCache, 
  contractCache,
  eq,
  or,
  inArray,
  type UserCacheData,
  type ContractCacheData
} from '@cryptoart/db';
import type { EnrichedAuctionData } from "~/lib/types";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import { type Address } from "viem";
import { normalizeListingType } from "~/lib/server/auction";

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
};

const LISTINGS_BY_SELLER_QUERY = gql`
  query ListingsBySeller($seller: String!, $first: Int!, $skip: Int!) {
    listings(
      where: { seller: $seller }
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      listingId
      marketplace
      seller
      tokenAddress
      tokenId
      tokenSpec
      listingType
      initialAmount
      totalAvailable
      totalPerSale
      startTime
      endTime
      lazy
      status
      totalSold
      hasBid
      finalized
      createdAt
      createdAtBlock
      updatedAt
      bids(orderBy: amount, orderDirection: desc, first: 1000) {
        id
        bidder
        amount
        timestamp
      }
    }
  }
`;

const PURCHASES_BY_BUYER_QUERY = gql`
  query PurchasesByBuyer($buyer: String!, $first: Int!, $skip: Int!) {
    purchases(
      where: { buyer: $buyer }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      listing {
        id
        listingId
        seller
        tokenAddress
        tokenId
        tokenSpec
        listingType
        initialAmount
        totalAvailable
        totalPerSale
        startTime
        endTime
        lazy
        status
        totalSold
        hasBid
        finalized
        createdAt
        createdAtBlock
        updatedAt
      }
      buyer
      amount
      count
      timestamp
      blockNumber
      transactionHash
    }
  }
`;

/**
 * Detect if fname is a Farcaster username or Ethereum address
 */
function isEthereumAddress(fname: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(fname);
}

/**
 * Resolve fname to user address(es)
 * Returns primary address and all verified wallets if Farcaster profile
 */
async function resolveUserAddresses(fname: string): Promise<{
  primaryAddress: string | null;
  allAddresses: string[];
  userData: UserCacheData | null;
}> {
  const db = getDatabase();
  
  if (isEthereumAddress(fname)) {
    // Direct address lookup
    const normalizedAddress = fname.toLowerCase();
    const [user] = await db.select()
      .from(userCache)
      .where(eq(userCache.ethAddress, normalizedAddress))
      .limit(1);
    
    if (user) {
      const verifiedWallets = (user.verifiedWallets as string[] | null) || [];
      const allAddresses = [normalizedAddress, ...verifiedWallets.map(w => w.toLowerCase())]
        .filter((addr, idx, arr) => arr.indexOf(addr) === idx); // unique
      
      return {
        primaryAddress: normalizedAddress,
        allAddresses,
        userData: user as UserCacheData,
      };
    }
    
    return {
      primaryAddress: normalizedAddress,
      allAddresses: [normalizedAddress],
      userData: null,
    };
  } else {
    // Farcaster username lookup (case-insensitive)
    const [user] = await db.select()
      .from(userCache)
      .where(eq(userCache.username, fname.toLowerCase()))
      .limit(1);
    
    if (user) {
      const verifiedWallets = (user.verifiedWallets as string[] | null) || [];
      const primaryAddress = user.ethAddress.toLowerCase();
      const allAddresses = [primaryAddress, ...verifiedWallets.map(w => w.toLowerCase())]
        .filter((addr, idx, arr) => arr.indexOf(addr) === idx); // unique
      
      return {
        primaryAddress,
        allAddresses,
        userData: user as UserCacheData,
      };
    }
    
    return {
      primaryAddress: null,
      allAddresses: [],
      userData: null,
    };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fname: string }> }
) {
  try {
    const { fname } = await params;
    
    if (!fname) {
      return NextResponse.json(
        { error: "Username or address is required" },
        { status: 400 }
      );
    }

    // Resolve fname to address(es)
    const { primaryAddress, allAddresses, userData } = await resolveUserAddresses(fname);
    
    if (!primaryAddress) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const db = getDatabase();
    const endpoint = getSubgraphEndpoint();

    // Get listings created by user (query for all addresses)
    const listingsPromises = allAddresses.map(address => 
      request<{ listings: any[] }>(
        endpoint,
        LISTINGS_BY_SELLER_QUERY,
        {
          seller: address.toLowerCase(),
          first: 100,
          skip: 0,
        }
      )
    );
    
    const listingsResults = await Promise.all(listingsPromises);
    const allListings = listingsResults.flatMap(result => result.listings || []);
    
    // Get purchases made by user (query for all addresses)
    const purchasesPromises = allAddresses.map(address =>
      request<{ purchases: any[] }>(
        endpoint,
        PURCHASES_BY_BUYER_QUERY,
        {
          buyer: address.toLowerCase(),
          first: 100,
          skip: 0,
        }
      )
    );
    
    const purchasesResults = await Promise.all(purchasesPromises);
    const allPurchases = purchasesResults.flatMap(result => result.purchases || []);

    // Get artworks created by user
    // Query contractCache for contracts where creatorAddress matches any of user's addresses
    const artworksCreated = await db.select()
      .from(contractCache)
      .where(
        or(
          ...allAddresses.map(addr => eq(contractCache.creatorAddress, addr.toLowerCase()))
        )
      );

    // Get listings for artworks created by user
    // Find listings where tokenAddress matches contracts created by user
    const artworkContractAddresses = artworksCreated.map(c => c.contractAddress.toLowerCase());
    
    let artworkListings: any[] = [];
    if (artworkContractAddresses.length > 0) {
      // Query subgraph for listings with these token addresses
      // Note: We'll need to query each contract separately or use a different approach
      // For now, we'll enrich the artwork data with listings later if needed
    }

    // Enrich listings with metadata
    const enrichedListings: EnrichedAuctionData[] = await Promise.all(
      allListings.map(async (listing) => {
        const bidCount = listing.bids?.length || 0;
        const highestBid =
          listing.bids && listing.bids.length > 0
            ? listing.bids[0]
            : undefined;

        let metadata = null;
        if (listing.tokenAddress && listing.tokenId) {
          try {
            metadata = await fetchNFTMetadata(
              listing.tokenAddress as Address,
              listing.tokenId,
              listing.tokenSpec
            );
          } catch (error) {
            console.error(`Error fetching metadata:`, error);
          }
        }

        return {
          ...listing,
          listingType: normalizeListingType(listing.listingType, listing),
          bidCount,
          highestBid: highestBid
            ? {
                amount: highestBid.amount,
                bidder: highestBid.bidder,
                timestamp: highestBid.timestamp,
              }
            : undefined,
          title: metadata?.title || metadata?.name,
          artist: metadata?.artist || metadata?.creator,
          image: metadata?.image,
          description: metadata?.description,
          metadata,
        };
      })
    );

    // Enrich purchases with listing and metadata
    const enrichedPurchases = await Promise.all(
      allPurchases.map(async (purchase) => {
        const listing = purchase.listing;
        let metadata = null;
        
        if (listing?.tokenAddress && listing?.tokenId) {
          try {
            metadata = await fetchNFTMetadata(
              listing.tokenAddress as Address,
              listing.tokenId,
              listing.tokenSpec
            );
          } catch (error) {
            console.error(`Error fetching metadata:`, error);
          }
        }

        return {
          ...purchase,
          listing: {
            ...listing,
            listingType: normalizeListingType(listing?.listingType, listing),
          },
          metadata,
        };
      })
    );

    // Group purchases by seller to show "collected from X artists"
    const collectedFromMap = new Map<string, number>();
    enrichedPurchases.forEach(purchase => {
      const seller = purchase.listing?.seller?.toLowerCase();
      if (seller) {
        collectedFromMap.set(seller, (collectedFromMap.get(seller) || 0) + 1);
      }
    });

    const collectedFrom = Array.from(collectedFromMap.entries()).map(([seller, count]) => ({
      seller,
      count,
    }));

    // Get user info for collected from sellers
    const collectedFromSellers = Array.from(collectedFromMap.keys());
    const collectedFromUsers = collectedFromSellers.length > 0
      ? await db.select()
          .from(userCache)
          .where(
            or(
              ...collectedFromSellers.map(addr => eq(userCache.ethAddress, addr.toLowerCase()))
            )
          )
      : [];

    const collectedFromWithNames = collectedFrom.map(item => {
      const user = collectedFromUsers.find(u => 
        u.ethAddress.toLowerCase() === item.seller.toLowerCase()
      );
      return {
        ...item,
        username: user?.username || null,
        displayName: user?.displayName || null,
        pfpUrl: user?.pfpUrl || null,
      };
    });

    return NextResponse.json({
      success: true,
      user: userData,
      primaryAddress,
      verifiedWallets: allAddresses,
      listingsCreated: enrichedListings,
      purchases: enrichedPurchases,
      collectedFrom: collectedFromWithNames,
      artworksCreated: artworksCreated.map(artwork => ({
        contractAddress: artwork.contractAddress,
        name: artwork.name,
        symbol: artwork.symbol,
        creatorAddress: artwork.creatorAddress,
      })),
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch user profile",
      },
      { status: 500 }
    );
  }
}

