"use client";

import { useState, useEffect } from "react";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { AuctionCard } from "~/components/AuctionCard";
import { FollowButton } from "~/components/FollowButton";
import { FollowersModal } from "~/components/FollowersModal";
import { AdminContextMenu } from "~/components/AdminContextMenu";
import { ProfileGalleriesSection } from "~/components/ProfileGalleriesSection";
import { useIsAdmin } from "~/hooks/useIsAdmin";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useAccount } from "wagmi";
import type { EnrichedAuctionData } from "~/lib/types";
import Link from "next/link";
import { formatEther } from "viem";

interface UserProfileClientProps {
  username: string;
}

interface UserProfileData {
  user: {
    ethAddress: string;
    fid?: number | null;
    username?: string | null;
    displayName?: string | null;
    pfpUrl?: string | null;
    verifiedWallets?: string[] | null;
    ensName?: string | null;
  } | null;
  primaryAddress: string;
  verifiedWallets: string[];
  listingsCreated: EnrichedAuctionData[];
  purchases: Array<{
    id: string;
    listing: any;
    buyer: string;
    amount: string;
    count: number;
    timestamp: string;
    metadata: any;
  }>;
  collectedFrom: Array<{
    seller: string;
    count: number;
    username?: string | null;
    displayName?: string | null;
    pfpUrl?: string | null;
  }>;
  // Listings of NFTs from contracts created by this user (the artist's work)
  artworkListings: EnrichedAuctionData[];
  // Legacy: raw contract data
  artworksCreated: Array<{
    contractAddress: string;
    name?: string | null;
    symbol?: string | null;
    creatorAddress?: string | null;
  }>;
}

const gradients = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
];

type ProfileTab = 'wallets' | 'artworks' | 'listings' | 'collections' | 'galleries' | 'stats';

export default function UserProfileClient({ username }: UserProfileClientProps) {
  const { isAdmin } = useIsAdmin();
  const { isPro: isMember } = useMembershipStatus();
  const { address: connectedAddress } = useAccount();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('wallets');
  const [statsData, setStatsData] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      setError(null);
      try {
        console.log(`[UserProfileClient] Fetching profile for: "${username}"`);
        const response = await fetch(`/api/user/${encodeURIComponent(username)}`);
        console.log(`[UserProfileClient] Response status: ${response.status}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`[UserProfileClient] API error:`, errorData);
          setError(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          throw new Error(errorData.error || 'Failed to fetch profile');
        }
        const data = await response.json();
        console.log(`[UserProfileClient] Got profile data:`, {
          hasUser: !!data.user,
          primaryAddress: data.primaryAddress,
          listingsCount: data.listingsCreated?.length,
        });
        setProfileData(data);
        
        // Fetch follower and following counts
        if (data.primaryAddress) {
          const [followersRes, followingRes] = await Promise.all([
            fetch(`/api/user/${encodeURIComponent(data.primaryAddress)}/followers`),
            fetch(`/api/user/${encodeURIComponent(data.primaryAddress)}/following`),
          ]);
          
          if (followersRes.ok) {
            const followersData = await followersRes.json();
            setFollowersCount(followersData.count || 0);
          }
          
          if (followingRes.ok) {
            const followingData = await followingRes.json();
            setFollowingCount(followingData.count || 0);
          }
        }
      } catch (err) {
        console.error('[UserProfileClient] Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [username]);

  // Fetch stats when stats tab is active
  useEffect(() => {
    async function fetchStats() {
      if (activeTab === 'stats' && profileData?.primaryAddress && !statsData && isMember && connectedAddress) {
        setLoadingStats(true);
        try {
          // Build query params with user address for membership check
          const params = new URLSearchParams();
          params.set('userAddress', connectedAddress);
          
          const response = await fetch(`/api/user/${encodeURIComponent(profileData.primaryAddress)}/stats?${params}`);
          if (response.ok) {
            const data = await response.json();
            setStatsData(data);
          } else if (response.status === 403) {
            // Access denied
            setStatsData({ error: 'Membership required to view stats' });
          }
        } catch (err) {
          console.error('[UserProfileClient] Error fetching stats:', err);
        } finally {
          setLoadingStats(false);
        }
      }
    }

    fetchStats();
  }, [activeTab, profileData?.primaryAddress, statsData, isMember, connectedAddress]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <div className="flex items-center gap-3">
            <ProfileDropdown />
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-[#cccccc]">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <div className="flex items-center gap-3">
            <ProfileDropdown />
          </div>
        </header>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2">
          <p className="text-[#cccccc]">Profile not found</p>
          {error && (
            <p className="text-xs text-[#666666]">Error: {error}</p>
          )}
          <p className="text-xs text-[#666666]">Looking for: @{username}</p>
        </div>
      </div>
    );
  }

  const displayName = profileData.user?.displayName || 
                      profileData.user?.username || 
                      profileData.user?.ensName ||
                      `${profileData.primaryAddress.slice(0, 6)}...${profileData.primaryAddress.slice(-4)}`;
  
  const isFarcasterProfile = !!profileData.user?.username;
  const walletsToShow = isFarcasterProfile 
    ? profileData.verifiedWallets 
    : [profileData.primaryAddress];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex justify-between items-center px-5 py-4 border-b border-[#333333]">
        <Logo />
        <div className="flex items-center gap-3">
          <ProfileDropdown />
        </div>
      </header>

      <div className="px-5 py-8">
        {/* Profile Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            {profileData.user?.pfpUrl ? (
              <img
                src={profileData.user.pfpUrl}
                alt={displayName}
                className="w-20 h-20 rounded-full"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2]" />
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-light mb-1">{displayName}</h1>
                  {profileData.user?.username && (
                    <p className="text-sm text-[#999999]">@{profileData.user.username}</p>
                  )}
                </div>
                <AdminContextMenu sellerAddress={profileData.primaryAddress} />
              </div>
              {profileData.user?.ensName && (
                <p className="text-sm text-[#999999]">{profileData.user.ensName}</p>
              )}
              
              {/* Follower/Following counts */}
              <div className="flex gap-4 mt-3">
                <button
                  onClick={() => setShowFollowersModal(true)}
                  className="text-sm text-[#999999] hover:text-white transition-colors"
                >
                  <span className="font-medium text-white">{followersCount ?? '...'}</span> followers
                </button>
                <button
                  onClick={() => setShowFollowingModal(true)}
                  className="text-sm text-[#999999] hover:text-white transition-colors"
                >
                  <span className="font-medium text-white">{followingCount ?? '...'}</span> following
                </button>
              </div>
            </div>
            <FollowButton followingAddress={profileData.primaryAddress} />
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-[#333333] mb-6">
            <button
              onClick={() => setActiveTab('wallets')}
              className={`pb-2 px-2 text-sm ${
                activeTab === 'wallets'
                  ? 'border-b-2 border-white text-white'
                  : 'text-[#999999] hover:text-[#cccccc]'
              }`}
            >
              Wallets ({walletsToShow.length})
            </button>
            <button
              onClick={() => setActiveTab('artworks')}
              className={`pb-2 px-2 text-sm ${
                activeTab === 'artworks'
                  ? 'border-b-2 border-white text-white'
                  : 'text-[#999999] hover:text-[#cccccc]'
              }`}
            >
              Artworks ({profileData.artworkListings?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('listings')}
              className={`pb-2 px-2 text-sm ${
                activeTab === 'listings'
                  ? 'border-b-2 border-white text-white'
                  : 'text-[#999999] hover:text-[#cccccc]'
              }`}
            >
              Listings ({profileData.listingsCreated.length})
            </button>
            <button
              onClick={() => setActiveTab('collections')}
              className={`pb-2 px-2 text-sm ${
                activeTab === 'collections'
                  ? 'border-b-2 border-white text-white'
                  : 'text-[#999999] hover:text-[#cccccc]'
              }`}
            >
              Collected ({profileData.purchases.length})
            </button>
            {isMember && (
              <button
                onClick={() => setActiveTab('stats')}
                className={`pb-2 px-2 text-sm ${
                  activeTab === 'stats'
                    ? 'border-b-2 border-white text-white'
                    : 'text-[#999999] hover:text-[#cccccc]'
                }`}
              >
                Stats
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('galleries')}
                className={`pb-2 px-2 text-sm ${
                  activeTab === 'galleries'
                    ? 'border-b-2 border-white text-white'
                    : 'text-[#999999] hover:text-[#cccccc]'
                }`}
              >
                Galleries
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'wallets' && (
          <div className="space-y-4">
            <h2 className="text-lg font-light mb-4">Verified Wallets</h2>
            {walletsToShow.map((wallet, index) => {
              const walletUser = profileData.user?.ethAddress.toLowerCase() === wallet.toLowerCase()
                ? profileData.user
                : null;
              const walletUsername = walletUser?.username;
              
              return (
                <div
                  key={wallet}
                  className="p-4 bg-[#1a1a1a] border border-[#333333] rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm">{wallet}</p>
                      {walletUsername && (
                        <Link
                          href={`/user/${walletUsername}`}
                          className="text-xs text-[#999999] hover:text-[#cccccc] mt-1"
                        >
                          @{walletUsername}
                        </Link>
                      )}
                    </div>
                    {wallet.toLowerCase() === profileData.primaryAddress.toLowerCase() && (
                      <span className="text-xs text-[#999999]">Primary</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'artworks' && (
          <div>
            <h2 className="text-lg font-light mb-4">Artworks Created</h2>
            {(!profileData.artworkListings || profileData.artworkListings.length === 0) ? (
              <p className="text-[#999999]">No artworks found</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {profileData.artworkListings.map((listing, index) => (
                  <AuctionCard
                    key={listing.listingId}
                    auction={listing}
                    gradient={gradients[index % gradients.length]}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'listings' && (
          <div>
            <h2 className="text-lg font-light mb-4">Listings Created</h2>
            {profileData.listingsCreated.length === 0 ? (
              <p className="text-[#999999]">No listings found</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {profileData.listingsCreated.map((listing, index) => (
                  <AuctionCard
                    key={listing.listingId}
                    auction={listing}
                    gradient={gradients[index % gradients.length]}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && isMember && (
          <div className="space-y-6">
            {loadingStats ? (
              <p className="text-[#999999]">Loading stats...</p>
            ) : !statsData?.stats ? (
              <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                <p className="text-[#999999]">
                  {statsData?.message || 'Stats not yet available. They will be calculated in the next update cycle.'}
                </p>
              </div>
            ) : (
              <>
                {/* Sales Stats */}
                <div>
                  <h2 className="text-lg font-light mb-4">Sales</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                      <p className="text-sm text-[#999999]">Artworks Sold</p>
                      <p className="text-2xl font-semibold">{statsData.stats.totalArtworksSold}</p>
                    </div>
                    <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                      <p className="text-sm text-[#999999]">Total Volume</p>
                      <p className="text-xl font-semibold">
                        {formatEther(BigInt(statsData.stats.totalSalesVolumeWei))} ETH
                      </p>
                    </div>
                    <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                      <p className="text-sm text-[#999999]">Unique Buyers</p>
                      <p className="text-2xl font-semibold">{statsData.stats.uniqueBuyers}</p>
                    </div>
                    <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                      <p className="text-sm text-[#999999]">Total Sales</p>
                      <p className="text-2xl font-semibold">{statsData.stats.totalSalesCount}</p>
                    </div>
                  </div>
                </div>
                
                {/* Purchase Stats */}
                <div>
                  <h2 className="text-lg font-light mb-4">Purchases</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                      <p className="text-sm text-[#999999]">Artworks Purchased</p>
                      <p className="text-2xl font-semibold">{statsData.stats.totalArtworksPurchased}</p>
                    </div>
                    <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                      <p className="text-sm text-[#999999]">Total Spent</p>
                      <p className="text-xl font-semibold">
                        {formatEther(BigInt(statsData.stats.totalPurchaseVolumeWei))} ETH
                      </p>
                    </div>
                    <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                      <p className="text-sm text-[#999999]">Unique Sellers</p>
                      <p className="text-2xl font-semibold">{statsData.stats.uniqueSellers}</p>
                    </div>
                    <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                      <p className="text-sm text-[#999999]">Total Purchases</p>
                      <p className="text-2xl font-semibold">{statsData.stats.totalPurchaseCount}</p>
                    </div>
                  </div>
                </div>
                
                {/* Bidding Stats */}
                {(statsData.stats.totalBidsPlaced > 0 || statsData.stats.totalOffersMade > 0) && (
                  <div>
                    <h2 className="text-lg font-light mb-4">Activity</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                        <p className="text-sm text-[#999999]">Bids Placed</p>
                        <p className="text-2xl font-semibold">{statsData.stats.totalBidsPlaced}</p>
                      </div>
                      <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                        <p className="text-sm text-[#999999]">Bids Won</p>
                        <p className="text-2xl font-semibold">{statsData.stats.totalBidsWon}</p>
                      </div>
                      <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                        <p className="text-sm text-[#999999]">Offers Made</p>
                        <p className="text-2xl font-semibold">{statsData.stats.totalOffersMade}</p>
                      </div>
                      <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
                        <p className="text-sm text-[#999999]">Active Listings</p>
                        <p className="text-2xl font-semibold">{statsData.stats.activeListings}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Token Breakdown */}
                {statsData.stats.tokensSoldIn && statsData.stats.tokensSoldIn.length > 0 && (
                  <div>
                    <h2 className="text-lg font-light mb-4">Tokens Sold In</h2>
                    <div className="space-y-2">
                      {statsData.stats.tokensSoldIn.map((token: any) => (
                        <div key={token.address} className="flex justify-between p-3 bg-[#1a1a1a] border border-[#333333]">
                          <span className="text-sm">{token.symbol}</span>
                          <span className="text-sm font-medium">
                            {formatEther(BigInt(token.totalAmount))} ({token.count} sales)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {statsData.stats.tokensBoughtIn && statsData.stats.tokensBoughtIn.length > 0 && (
                  <div>
                    <h2 className="text-lg font-light mb-4">Tokens Bought In</h2>
                    <div className="space-y-2">
                      {statsData.stats.tokensBoughtIn.map((token: any) => (
                        <div key={token.address} className="flex justify-between p-3 bg-[#1a1a1a] border border-[#333333]">
                          <span className="text-sm">{token.symbol}</span>
                          <span className="text-sm font-medium">
                            {formatEther(BigInt(token.totalAmount))} ({token.count} purchases)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {statsData.cached && statsData.calculatedAt && (
                  <p className="text-xs text-[#666666]">
                    Last updated: {new Date(statsData.calculatedAt).toLocaleString()}
                    {statsData.stale && ' (updating soon)'}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'galleries' && profileData && (
          <div>
            <h2 className="text-lg font-light mb-4">Galleries</h2>
            <ProfileGalleriesSection userAddress={profileData.primaryAddress} />
          </div>
        )}

        {activeTab === 'collections' && (
          <div className="space-y-8">
            {/* Purchased Artworks */}
            <div>
              <h2 className="text-lg font-light mb-4">Collection</h2>
              {profileData.purchases.length === 0 ? (
                <p className="text-[#999999]">No artworks collected yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {profileData.purchases.map((purchase, index) => {
                    const title = purchase.metadata?.title || purchase.metadata?.name || `Listing #${purchase.listing?.listingId}`;
                    const image = purchase.metadata?.image;
                    const listingId = purchase.listing?.listingId;
                    
                    return (
                      <Link
                        key={purchase.id}
                        href={`/listing/${listingId}`}
                        className="group relative w-full cursor-pointer transition-opacity hover:opacity-90"
                      >
                        <div
                          className="w-full aspect-square relative overflow-hidden rounded-lg"
                          style={{
                            background: image
                              ? `url(${image}) center/cover`
                              : gradients[index % gradients.length],
                          }}
                        >
                          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                            <p className="text-sm font-medium line-clamp-1">{title}</p>
                            {purchase.metadata?.artist && (
                              <p className="text-xs text-[#999999] line-clamp-1">
                                by {purchase.metadata.artist}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Collected From */}
            {profileData.collectedFrom.length > 0 && (
              <div>
                <h2 className="text-lg font-light mb-4">Collected From</h2>
                <div className="flex flex-wrap gap-3">
                  {profileData.collectedFrom.map((item) => (
                    <Link
                      key={item.seller}
                      href={item.username ? `/user/${item.username}` : `/user/${item.seller}`}
                      className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#333333] rounded-full hover:border-[#555555] transition-colors"
                    >
                      {item.pfpUrl ? (
                        <img
                          src={item.pfpUrl}
                          alt={item.displayName || item.username || item.seller}
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2]" />
                      )}
                      <span className="text-sm">
                        {item.displayName || item.username || `${item.seller.slice(0, 6)}...${item.seller.slice(-4)}`}
                      </span>
                      <span className="text-xs text-[#666666]">
                        ({item.count})
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Modals */}
      <FollowersModal
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        address={profileData.primaryAddress}
        type="followers"
      />
      <FollowersModal
        isOpen={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
        address={profileData.primaryAddress}
        type="following"
      />
    </div>
  );
}

