import { NextRequest, NextResponse } from "next/server";
import { request, gql } from "graphql-request";
import { 
  getDatabase, 
  userCache, 
  contractCache,
  eq,
  or,
  inArray,
  sql,
  type UserCacheData,
  type ContractCacheData
} from '@cryptoart/db';
import type { EnrichedAuctionData } from "~/lib/types";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import { type Address } from "viem";
import { normalizeListingType } from "~/lib/server/auction";
import { discoverAndCacheUser } from "~/lib/server/user-discovery";
import { lookupNeynarByUsername } from "~/lib/artist-name-resolution";

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
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
 * Also searches verifiedWallets array to find users by their secondary addresses
 */
async function resolveUserAddresses(fname: string): Promise<{
  primaryAddress: string | null;
  allAddresses: string[];
  userData: UserCacheData | null;
}> {
  console.log(`[resolveUserAddresses] Starting lookup for: "${fname}"`);
  
  const db = getDatabase();
  
  if (isEthereumAddress(fname)) {
    console.log(`[resolveUserAddresses] Detected as Ethereum address`);
    // Direct address lookup
    const normalizedAddress = fname.toLowerCase();
    
    // First try exact ethAddress match
    const [user] = await db.select()
      .from(userCache)
      .where(eq(userCache.ethAddress, normalizedAddress))
      .limit(1);
    
    if (user) {
      const verifiedWallets = (user.verifiedWallets as string[] | null) || [];
      const allAddresses = [user.ethAddress.toLowerCase(), ...verifiedWallets.map(w => w.toLowerCase())]
        .filter((addr, idx, arr) => arr.indexOf(addr) === idx); // unique
      
      return {
        primaryAddress: user.ethAddress.toLowerCase(),
        allAddresses,
        userData: user as UserCacheData,
      };
    }
    
    // If not found by primary address, search in verifiedWallets JSONB array
    // This handles cases where the address is a verified wallet, not the primary
    const [userByVerified] = await db.select()
      .from(userCache)
      .where(sql`${userCache.verifiedWallets} @> ${JSON.stringify([normalizedAddress])}::jsonb`)
      .limit(1);
    
    if (userByVerified) {
      const verifiedWallets = (userByVerified.verifiedWallets as string[] | null) || [];
      const allAddresses = [userByVerified.ethAddress.toLowerCase(), ...verifiedWallets.map(w => w.toLowerCase())]
        .filter((addr, idx, arr) => arr.indexOf(addr) === idx); // unique
      
      return {
        primaryAddress: userByVerified.ethAddress.toLowerCase(),
        allAddresses,
        userData: userByVerified as UserCacheData,
      };
    }
    
    // User not in cache - try to discover them
    // This will look up via Neynar/ENS and cache the result
    await discoverAndCacheUser(normalizedAddress, { failSilently: true });
    
    // Re-fetch from cache after discovery attempt (check both primary and verified)
    const [discoveredUser] = await db.select()
      .from(userCache)
      .where(eq(userCache.ethAddress, normalizedAddress))
      .limit(1);
    
    if (discoveredUser) {
      const verifiedWallets = (discoveredUser.verifiedWallets as string[] | null) || [];
      const allAddresses = [discoveredUser.ethAddress.toLowerCase(), ...verifiedWallets.map(w => w.toLowerCase())]
        .filter((addr, idx, arr) => arr.indexOf(addr) === idx); // unique
      
      return {
        primaryAddress: discoveredUser.ethAddress.toLowerCase(),
        allAddresses,
        userData: discoveredUser as UserCacheData,
      };
    }
    
    // Also check verified wallets after discovery
    const [discoveredByVerified] = await db.select()
      .from(userCache)
      .where(sql`${userCache.verifiedWallets} @> ${JSON.stringify([normalizedAddress])}::jsonb`)
      .limit(1);
    
    if (discoveredByVerified) {
      const verifiedWallets = (discoveredByVerified.verifiedWallets as string[] | null) || [];
      const allAddresses = [discoveredByVerified.ethAddress.toLowerCase(), ...verifiedWallets.map(w => w.toLowerCase())]
        .filter((addr, idx, arr) => arr.indexOf(addr) === idx); // unique
      
      return {
        primaryAddress: discoveredByVerified.ethAddress.toLowerCase(),
        allAddresses,
        userData: discoveredByVerified as UserCacheData,
      };
    }
    
    return {
      primaryAddress: normalizedAddress,
      allAddresses: [normalizedAddress],
      userData: null,
    };
  } else {
    // Farcaster username lookup (case-insensitive)
    const normalizedUsername = fname.toLowerCase();
    console.log(`[resolveUserAddresses] Detected as username, querying DB for: "${normalizedUsername}"`);
    
    // Use SQL lower() for truly case-insensitive comparison
    const [user] = await db.select()
      .from(userCache)
      .where(sql`lower(${userCache.username}) = ${normalizedUsername}`)
      .limit(1);
    
    console.log(`[resolveUserAddresses] DB query result:`, user ? {
      ethAddress: user.ethAddress,
      username: user.username,
      fid: user.fid,
      hasVerifiedWallets: !!(user.verifiedWallets as string[] | null)?.length,
    } : 'NOT FOUND');
    
    if (user) {
      const verifiedWallets = (user.verifiedWallets as string[] | null) || [];
      const primaryAddress = user.ethAddress.toLowerCase();
      const allAddresses = [primaryAddress, ...verifiedWallets.map(w => w.toLowerCase())]
        .filter((addr, idx, arr) => arr.indexOf(addr) === idx); // unique
      
      console.log(`[resolveUserAddresses] Found in cache! primaryAddress: ${primaryAddress}, allAddresses: ${allAddresses.length}`);
      
      return {
        primaryAddress,
        allAddresses,
        userData: user as UserCacheData,
      };
    }
    
    // Username not found in cache - try to discover via Neynar API
    console.log(`[resolveUserAddresses] Username "${fname}" not in cache, looking up via Neynar API...`);
    const neynarUser = await lookupNeynarByUsername(fname);
    
    console.log(`[resolveUserAddresses] Neynar lookup result:`, neynarUser ? {
      address: neynarUser.address,
      fid: neynarUser.fid,
      username: neynarUser.username,
      verifiedWalletsCount: neynarUser.verifiedWallets.length,
    } : 'NOT FOUND');
    
    if (neynarUser) {
      // User found via Neynar - re-fetch from cache (it should be cached now)
      const [discoveredUser] = await db.select()
        .from(userCache)
        .where(eq(userCache.ethAddress, neynarUser.address))
        .limit(1);
      
      console.log(`[resolveUserAddresses] After Neynar discovery, cache lookup:`, discoveredUser ? 'FOUND' : 'NOT FOUND');
      
      if (discoveredUser) {
        const verifiedWallets = (discoveredUser.verifiedWallets as string[] | null) || [];
        const allAddresses = [neynarUser.address, ...verifiedWallets.map(w => w.toLowerCase())]
          .filter((addr, idx, arr) => arr.indexOf(addr) === idx); // unique
        
        return {
          primaryAddress: neynarUser.address,
          allAddresses,
          userData: discoveredUser as UserCacheData,
        };
      }
      
      // If cache lookup failed but we have Neynar data, return it anyway
      console.log(`[resolveUserAddresses] Cache lookup failed but using Neynar data directly`);
      return {
        primaryAddress: neynarUser.address,
        allAddresses: neynarUser.verifiedWallets.length > 0 
          ? [neynarUser.address, ...neynarUser.verifiedWallets]
          : [neynarUser.address],
        userData: {
          ethAddress: neynarUser.address,
          fid: neynarUser.fid,
          username: neynarUser.username,
          displayName: neynarUser.displayName,
          pfpUrl: neynarUser.pfpUrl,
          verifiedWallets: neynarUser.verifiedWallets,
        } as UserCacheData,
      };
    }
    
    // Username not found - could be a new user or invalid username
    console.log(`[resolveUserAddresses] FAILED: No user found for username "${fname}" in cache or via Neynar`);
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
    
    console.log(`[GET /api/user/${fname}] Request received`);
    
    if (!fname) {
      console.log(`[GET /api/user] ERROR: No fname provided`);
      return NextResponse.json(
        { error: "Username or address is required" },
        { status: 400 }
      );
    }

    // Resolve fname to address(es)
    const { primaryAddress, allAddresses, userData } = await resolveUserAddresses(fname);
    
    console.log(`[GET /api/user/${fname}] resolveUserAddresses result:`, {
      primaryAddress,
      allAddressesCount: allAddresses.length,
      hasUserData: !!userData,
    });
    
    if (!primaryAddress) {
      console.log(`[GET /api/user/${fname}] ERROR: User not found - returning 404`);
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
        },
        getSubgraphHeaders()
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

    // Filter out cancelled auctions before enriching
    const activeListings = allListings.filter((listing) => listing.status !== "CANCELLED");

    // Enrich listings with metadata
    const enrichedListings: EnrichedAuctionData[] = await Promise.all(
      activeListings.map(async (listing) => {
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

