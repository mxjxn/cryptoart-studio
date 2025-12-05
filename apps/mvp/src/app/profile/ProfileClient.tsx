"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useMiniApp } from "@neynar/react";
import { useProfile } from "@farcaster/auth-kit";
import { useUserAuctions } from "~/hooks/useUserAuctions";
import { useEnsNameForAddress } from "~/hooks/useEnsName";
import { useEnsAvatarForAddress } from "~/hooks/useEnsAvatar";
import { formatEther } from "viem";
import Link from "next/link";
import { TransitionLink } from "~/components/TransitionLink";
import { AuctionCard } from "~/components/AuctionCard";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { Logo } from "~/components/Logo";
import type { EnrichedAuctionData } from "~/lib/types";

type TabType = "created" | "collected" | "bids" | "offers" | "saved";

type FarcasterHandle = {
  fid: number;
  username: string;
  displayName: string | null;
  pfpUrl: string | null;
};

export default function ProfileClient() {
  const { address, isConnected } = useAccount();
  const { context } = useMiniApp();
  const { isAuthenticated: isFarcasterAuth, profile: farcasterProfile } = useProfile();
  const [activeTab, setActiveTab] = useState<TabType>("created");
  
  // Farcaster handles state
  const [farcasterHandles, setFarcasterHandles] = useState<FarcasterHandle[]>([]);
  const [farcasterHandlesLoading, setFarcasterHandlesLoading] = useState(false);
  const [farcasterHandlesExpanded, setFarcasterHandlesExpanded] = useState(false);
  const [lastFetchedAddress, setLastFetchedAddress] = useState<string | null>(null);
  
  // Get verified addresses from Farcaster if available (mini-app context)
  const farcasterMiniAppAddress = context?.user
    ? (context.user as any).verified_addresses?.primary?.eth_address ||
      (context.user as any).custody_address ||
      ((context.user as any).verifications?.[0] as string)
    : null;
  
  // Get verified address from Farcaster web auth profile if available
  const farcasterWebAddress = farcasterProfile
    ? (farcasterProfile as any).verified_addresses?.primary?.eth_address ||
      (farcasterProfile as any).custody_address ||
      ((farcasterProfile as any).verifications?.[0] as string)
    : null;
  
  // Use connected wallet address, or fall back to Farcaster verified address
  const userAddress = address || farcasterMiniAppAddress || farcasterWebAddress;
  
  // Determine if we're in mini-app context
  const isMiniApp = !!context?.user;
  
  // Determine if user is authenticated (matching ProfileDropdown logic)
  // Check farcasterProfile first as it's the most reliable indicator of authentication
  const isAuthenticated = isMiniApp
    ? !!context?.user
    : !!farcasterProfile || isFarcasterAuth || isConnected;
  
  // Resolve ENS name and avatar for address when not logged in via Farcaster
  const shouldResolveEns = !isMiniApp && !isFarcasterAuth && isConnected && !!address;
  const ensName = useEnsNameForAddress(address, shouldResolveEns);
  const ensAvatar = useEnsAvatarForAddress(address, shouldResolveEns);
  
  // Determine avatar URL: Farcaster pfp (mini-app) > Farcaster pfp (web) > ENS avatar > undefined
  const avatarUrl = context?.user?.pfpUrl || farcasterProfile?.pfpUrl || ensAvatar || undefined;
  
  // Determine currently logged-in Farcaster handle (for status chip highlighting)
  const currentFarcasterFid = isMiniApp
    ? (context?.user as any)?.fid
    : (farcasterProfile as any)?.fid;
  
  // Determine if we should fetch Farcaster handles
  // Only fetch when authenticated with wallet/ENS (not Farcaster) and address is available
  const shouldFetchFarcasterHandles = !isMiniApp && !isFarcasterAuth && isConnected && !!address;
  
  // Fetch Farcaster handles when authenticated with wallet/ENS
  useEffect(() => {
    if (shouldFetchFarcasterHandles && address && !farcasterHandlesLoading && address !== lastFetchedAddress) {
      const addressToFetch = address; // Store in const for TypeScript
      async function fetchFarcasterHandles() {
        setFarcasterHandlesLoading(true);
        try {
          const response = await fetch(`/api/user/${encodeURIComponent(addressToFetch)}/farcaster-handles`);
          if (response.ok) {
            const data = await response.json();
            setFarcasterHandles(data.handles || []);
            setLastFetchedAddress(addressToFetch);
          }
        } catch (error) {
          console.error('Error fetching Farcaster handles:', error);
          setFarcasterHandles([]);
        } finally {
          setFarcasterHandlesLoading(false);
        }
      }
      fetchFarcasterHandles();
    } else if (!shouldFetchFarcasterHandles) {
      // Clear handles when not in wallet/ENS auth mode
      setFarcasterHandles([]);
      setLastFetchedAddress(null);
    }
  }, [shouldFetchFarcasterHandles, address, farcasterHandlesLoading, lastFetchedAddress]);
  
  // Debug logging (remove in production)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ProfileClient] Auth state:', {
        isMiniApp,
        hasContextUser: !!context?.user,
        isFarcasterAuth,
        hasFarcasterProfile: !!farcasterProfile,
        isConnected,
        hasAddress: !!address,
        userAddress,
        isAuthenticated,
      });
    }
  }, [isMiniApp, context?.user, isFarcasterAuth, farcasterProfile, isConnected, address, userAddress, isAuthenticated]);
  
  const { createdAuctions, activeBids, activeOffers, loading } = useUserAuctions();
  
  // Collected artworks state
  const [purchases, setPurchases] = useState<Array<{
    id: string;
    listing: any;
    buyer: string;
    amount: string;
    count: number;
    timestamp: string;
    metadata: any;
  }>>([]);
  const [collectedFrom, setCollectedFrom] = useState<Array<{
    seller: string;
    count: number;
    username?: string | null;
    displayName?: string | null;
    pfpUrl?: string | null;
  }>>([]);
  const [collectedLoading, setCollectedLoading] = useState(false);
  const [collectedFetched, setCollectedFetched] = useState(false);
  
  // Fetch collected data when tab is active
  useEffect(() => {
    if (activeTab === "collected" && userAddress && !collectedLoading && !collectedFetched) {
      async function fetchCollected() {
        setCollectedLoading(true);
        try {
          const response = await fetch(`/api/user/${encodeURIComponent(userAddress)}`);
          if (response.ok) {
            const data = await response.json();
            setPurchases(data.purchases || []);
            setCollectedFrom(data.collectedFrom || []);
          }
        } catch (error) {
          console.error('Error fetching collected:', error);
        } finally {
          setCollectedLoading(false);
          setCollectedFetched(true);
        }
      }
      fetchCollected();
    }
  }, [activeTab, userAddress, collectedLoading, collectedFetched]);
  
  // Saved listings state
  const [savedListings, setSavedListings] = useState<EnrichedAuctionData[]>([]);
  const [savedListingsLoading, setSavedListingsLoading] = useState(false);
  
  // FIXME: Infinite loop bug - savedListings.length is in the dependency array (line 104),
  // which causes the effect to re-run when listings are fetched, creating an infinite loop.
  // The condition `savedListings.length === 0` in the if statement doesn't prevent this
  // because the dependency array still triggers when length changes from 0 to >0.
  // Fetch saved listings when tab is active
  useEffect(() => {
    if (activeTab === "saved" && userAddress && !savedListingsLoading && savedListings.length === 0) {
      async function fetchSavedListings() {
        setSavedListingsLoading(true);
        try {
          const response = await fetch(
            `/api/favorites/listings?userAddress=${encodeURIComponent(userAddress)}`
          );
          if (response.ok) {
            const data = await response.json();
            setSavedListings(data.listings || []);
          }
        } catch (error) {
          console.error('Error fetching saved listings:', error);
        } finally {
          setSavedListingsLoading(false);
        }
      }
      fetchSavedListings();
    }
  }, [activeTab, userAddress, savedListingsLoading, savedListings.length]);

  // Get display name
  const displayName = context?.user
    ? context.user.displayName || context.user.username
    : farcasterProfile
    ? farcasterProfile.displayName || farcasterProfile.username
    : ensName || `${userAddress?.slice(0, 6)}...${userAddress?.slice(-4)}`;

  const gradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
    "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <div className="flex items-center gap-3">
            <ProfileDropdown />
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-[#cccccc]">Please connect your wallet or sign in with Farcaster to view your profile.</p>
        </div>
      </div>
    );
  }

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
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-20 h-20 rounded-full"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2]" />
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-light mb-1">{displayName}</h1>
              {context?.user?.username && (
                <p className="text-sm text-[#999999]">@{context.user.username}</p>
              )}
              {farcasterProfile?.username && (
                <p className="text-sm text-[#999999]">@{farcasterProfile.username}</p>
              )}
              {ensName && (
                <p className="text-sm text-[#999999]">{ensName}</p>
              )}
              
              {/* Farcaster Handles Status Chips */}
              {shouldFetchFarcasterHandles && farcasterHandles.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {(farcasterHandlesExpanded ? farcasterHandles : farcasterHandles.slice(0, 7)).map((handle) => {
                    const isActive = handle.fid === currentFarcasterFid;
                    return (
                      <div
                        key={handle.fid}
                        className={`px-3 py-1 rounded-full text-sm border-2 ${
                          isActive
                            ? "border-green-500 text-green-500"
                            : "border-red-500 text-red-500"
                        }`}
                      >
                        @{handle.username}
                      </div>
                    );
                  })}
                  {farcasterHandles.length > 7 && (
                    <button
                      onClick={() => setFarcasterHandlesExpanded(!farcasterHandlesExpanded)}
                      className="text-sm text-[#999999] hover:text-[#cccccc] transition-colors"
                    >
                      {farcasterHandlesExpanded
                        ? "Show less"
                        : `(and ${farcasterHandles.length - 7} more...)`}
                    </button>
                  )}
                </div>
              )}
              {shouldFetchFarcasterHandles && farcasterHandlesLoading && (
                <p className="text-sm text-[#999999] mt-3">Loading Farcaster handles...</p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-[#333333] mb-6">
            <button
              onClick={() => setActiveTab("created")}
              className={`pb-2 px-2 text-sm ${
                activeTab === "created"
                  ? "border-b-2 border-white text-white"
                  : "text-[#999999] hover:text-[#cccccc]"
              }`}
            >
              Created ({createdAuctions.length})
            </button>
            <button
              onClick={() => setActiveTab("collected")}
              className={`pb-2 px-2 text-sm ${
                activeTab === "collected"
                  ? "border-b-2 border-white text-white"
                  : "text-[#999999] hover:text-[#cccccc]"
              }`}
            >
              Collected ({purchases.length})
            </button>
            <button
              onClick={() => setActiveTab("bids")}
              className={`pb-2 px-2 text-sm ${
                activeTab === "bids"
                  ? "border-b-2 border-white text-white"
                  : "text-[#999999] hover:text-[#cccccc]"
              }`}
            >
              Active Bids ({activeBids.length})
            </button>
            <button
              onClick={() => setActiveTab("offers")}
              className={`pb-2 px-2 text-sm ${
                activeTab === "offers"
                  ? "border-b-2 border-white text-white"
                  : "text-[#999999] hover:text-[#cccccc]"
              }`}
            >
              Offers ({activeOffers.length})
            </button>
            {/* Saved tab hidden - was glitching with infinite loop */}
            {/* <button
              onClick={() => setActiveTab("saved")}
              className={`pb-2 px-2 text-sm ${
                activeTab === "saved"
                  ? "border-b-2 border-white text-white"
                  : "text-[#999999] hover:text-[#cccccc]"
              }`}
            >
              Saved ({savedListings.length})
            </button> */}
          </div>
        </div>

        {/* Tab Content */}
        {loading ? (
          <p className="text-[#999999]">Loading...</p>
        ) : (
          <div>
            {activeTab === "created" && (
              <div>
                {createdAuctions.length === 0 ? (
                  <p className="text-[#999999]">No auctions created yet.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {createdAuctions.map((auction, index) => (
                      <AuctionCard
                        key={auction.id}
                        auction={auction as any}
                        gradient={gradients[index % gradients.length]}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === "collected" && (
              <div className="space-y-8">
                {collectedLoading ? (
                  <p className="text-[#999999]">Loading collection...</p>
                ) : (
                  <>
                    {/* Purchased Artworks */}
                    <div>
                      <h2 className="text-lg font-light mb-4">Collection</h2>
                      {purchases.length === 0 ? (
                        <p className="text-[#999999]">No artworks collected yet.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                          {purchases.map((purchase, index) => {
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
                    {collectedFrom.length > 0 && (
                      <div>
                        <h2 className="text-lg font-light mb-4">Collected From</h2>
                        <div className="flex flex-wrap gap-3">
                          {collectedFrom.map((item) => (
                            <Link
                              key={item.seller}
                              href={item.username ? `/user/${item.username}` : `/user/${item.seller}`}
                              className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#333333] rounded-full hover:border-[#555555] transition-colors"
                            >
                              {item.pfpUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
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
                  </>
                )}
              </div>
            )}
            {activeTab === "bids" && (
              <div>
                {activeBids.length === 0 ? (
                  <p className="text-[#999999]">No active bids.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {activeBids.map((auction, index) => (
                      <AuctionCard
                        key={auction.id}
                        auction={auction as any}
                        gradient={gradients[index % gradients.length]}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === "offers" && (
              <div>
                {activeOffers.length === 0 ? (
                  <p className="text-[#999999]">No active offers.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {activeOffers.map((auction, index) => (
                      <AuctionCard
                        key={auction.id}
                        auction={auction as any}
                        gradient={gradients[index % gradients.length]}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Saved tab content hidden - was glitching with infinite loop */}
            {/* {activeTab === "saved" && (
              <div>
                {savedListingsLoading ? (
                  <p className="text-[#999999]">Loading saved listings...</p>
                ) : savedListings.length === 0 ? (
                  <p className="text-[#999999]">No saved listings yet.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {savedListings.map((auction, index) => (
                      <AuctionCard
                        key={auction.listingId}
                        auction={auction}
                        gradient={gradients[index % gradients.length]}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </div>
            )} */}
          </div>
        )}
      </div>
    </div>
  );
}

