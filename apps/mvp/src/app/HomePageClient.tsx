"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TransitionLink } from "~/components/TransitionLink";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { Logo } from "~/components/Logo";
import { AuctionCard } from "~/components/AuctionCard";
import { AdminToolsPanel } from "~/components/AdminToolsPanel";
import { HomepageLayout } from "~/components/HomepageLayout";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useMiniApp } from "@neynar/react";
import { useAuthMode } from "~/hooks/useAuthMode";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import type { EnrichedAuctionData } from "~/lib/types";


// Helper function to check if a listing is ERC721
function isERC721(tokenSpec: EnrichedAuctionData["tokenSpec"]): boolean {
  return tokenSpec === "ERC721" || String(tokenSpec) === "1";
}

// Helper function to check if a listing is ERC1155
function isERC1155(tokenSpec: EnrichedAuctionData["tokenSpec"]): boolean {
  return tokenSpec === "ERC1155" || String(tokenSpec) === "2";
}

export default function HomePageClient() {
  // Recent NFTs (ERC721) state
  const [nftListings, setNftListings] = useState<EnrichedAuctionData[]>([]);
  const [nftLoading, setNftLoading] = useState(true);
  const [nftError, setNftError] = useState<string | null>(null);
  const [nftSubgraphDown, setNftSubgraphDown] = useState(false);
  const nftLoadingRef = useRef(true);
  const nftHasInitializedRef = useRef(false);

  // Recent Editions (ERC1155) state
  const [editionListings, setEditionListings] = useState<EnrichedAuctionData[]>([]);
  const [editionLoading, setEditionLoading] = useState(true);
  const [editionError, setEditionError] = useState<string | null>(null);
  const [editionSubgraphDown, setEditionSubgraphDown] = useState(false);
  const editionLoadingRef = useRef(true);
  const editionHasInitializedRef = useRef(false);

  const pageSize = 4; // Show 4 listings per section on homepage
  const displayCount = 4; // Display exactly 4 items
  const { isPro, loading: membershipLoading } = useMembershipStatus();
  const isMember = isPro; // Alias for clarity
  const { actions, context } = useMiniApp();
  const { isMiniApp } = useAuthMode();
  const { isConnected } = useEffectiveAddress();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();
  const gradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
    "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  ];
  
  // Check if mini-app is installed using context.client.added from Farcaster SDK
  const isMiniAppInstalled = context?.client?.added ?? false;

  // Fetch recent NFTs (ERC721) - homepage only shows 6
  const fetchRecentNFTs = useCallback(async () => {
    setNftLoading(true);
    nftLoadingRef.current = true;
    setNftError(null);
    try {
      // Fetch more than needed to account for filtering
      const fetchCount = 20; // Fetch 20 to ensure we get enough ERC721 after filtering
      console.log('[HomePageClient] Fetching recent NFTs...', { fetchCount });
      const startTime = Date.now();
      
      // Use streaming mode for incremental loading
      const response = await fetch(`/api/listings/browse?first=${fetchCount}&skip=0&orderBy=createdAt&orderDirection=desc&enrich=true&stream=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // Parse streaming JSON response
      // The stream sends: {"success":true,"listings":[listing1,listing2,...],"count":...,...}
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let listings: EnrichedAuctionData[] = [];
      let metadata: { subgraphDown?: boolean; count?: number } = {};
      let listingsArrayStart = -1;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Find the start of the listings array
        if (listingsArrayStart === -1) {
          const arrayStart = buffer.indexOf('"listings":[');
          if (arrayStart !== -1) {
            listingsArrayStart = arrayStart + 11; // Length of '"listings":[' 
          }
        }
        
        if (listingsArrayStart !== -1) {
          // Parse complete listing objects from the buffer
          // Look for complete JSON objects (balanced braces, accounting for strings)
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          let startIdx = -1;
          const listingsPart = buffer.substring(listingsArrayStart);
          
          for (let i = 0; i < listingsPart.length; i++) {
            const char = listingsPart[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') {
                if (braceCount === 0) startIdx = i;
                braceCount++;
              } else if (char === '}') {
                braceCount--;
                if (braceCount === 0 && startIdx !== -1) {
                  // Found a complete listing object
                  try {
                    const listingJson = listingsPart.substring(startIdx, i + 1);
                    const listing = JSON.parse(listingJson);
                    if (listing.listingId && !listings.find(l => l.listingId === listing.listingId)) {
                      listings.push(listing);
                      // Filter for ERC721 and update state incrementally
                      const nftListings = listings.filter((l: EnrichedAuctionData) => isERC721(l.tokenSpec));
                      if (nftListings.length > 0) {
                        setNftListings(nftListings.slice(0, displayCount));
                      }
                    }
                  } catch (e) {
                    // Partial JSON, will be completed in next chunk
                  }
                  startIdx = -1;
                }
              } else if (char === ']' && braceCount === 0) {
                // End of listings array - try to parse final metadata
                const afterArray = buffer.substring(listingsArrayStart + i);
                try {
                  const metaMatch = afterArray.match(/"count":(\d+)/);
                  if (metaMatch) metadata.count = parseInt(metaMatch[1]);
                  const subgraphMatch = afterArray.match(/"subgraphDown":(true|false)/);
                  if (subgraphMatch) metadata.subgraphDown = subgraphMatch[1] === 'true';
                } catch {
                  // Continue
                }
                break;
              }
            }
          }
          
          // Keep the unprocessed part of the buffer (incomplete JSON objects)
          if (startIdx !== -1 && startIdx < listingsPart.length) {
            buffer = buffer.substring(0, listingsArrayStart + startIdx);
          } else {
            // Remove processed listings from buffer
            const lastProcessedIdx = listingsPart.lastIndexOf('}');
            if (lastProcessedIdx !== -1) {
              buffer = buffer.substring(0, listingsArrayStart + lastProcessedIdx + 1);
            }
          }
        }
      }
      
      // Final parse attempt for any remaining complete data
      try {
        const finalData = JSON.parse(buffer);
        if (finalData.listings && Array.isArray(finalData.listings)) {
          listings = finalData.listings;
          const nftListings = listings.filter((l: EnrichedAuctionData) => isERC721(l.tokenSpec));
          setNftListings(nftListings.slice(0, displayCount));
        }
        if (finalData.subgraphDown !== undefined) {
          metadata.subgraphDown = finalData.subgraphDown;
        }
      } catch {
        // Buffer might be incomplete, that's okay
      }
      
      const fetchTime = Date.now() - startTime;
      console.log('[HomePageClient] NFT fetch completed in', fetchTime, 'ms');
      
      // Filter for ERC721 only
      const nftListings = listings.filter((listing: EnrichedAuctionData) => isERC721(listing.tokenSpec));
      const isSubgraphDown = metadata.subgraphDown || false;
      console.log('[HomePageClient] Received NFTs:', nftListings.length, 'from', listings.length, 'total listings');
      
      // Take only displayCount for display
      setNftListings(nftListings.slice(0, displayCount));
      setNftSubgraphDown(isSubgraphDown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch NFTs';
      console.error('[HomePageClient] Error fetching NFTs:', errorMessage, error);
      setNftError(errorMessage);
    } finally {
      setNftLoading(false);
      nftLoadingRef.current = false;
    }
  }, [displayCount]);

  // Fetch recent Editions (ERC1155) - homepage only shows 6
  const fetchRecentEditions = useCallback(async () => {
    setEditionLoading(true);
    editionLoadingRef.current = true;
    setEditionError(null);
    try {
      // Fetch more than needed to account for filtering
      const fetchCount = 20; // Fetch 20 to ensure we get enough ERC1155 after filtering
      console.log('[HomePageClient] Fetching recent Editions...', { fetchCount });
      const startTime = Date.now();
      
      // Use streaming mode for incremental loading
      const response = await fetch(`/api/listings/browse?first=${fetchCount}&skip=0&orderBy=createdAt&orderDirection=desc&enrich=true&stream=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // Parse streaming JSON response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let listings: EnrichedAuctionData[] = [];
      let metadata: { subgraphDown?: boolean; count?: number } = {};
      let listingsArrayStart = -1;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Find the start of the listings array
        if (listingsArrayStart === -1) {
          const arrayStart = buffer.indexOf('"listings":[');
          if (arrayStart !== -1) {
            listingsArrayStart = arrayStart + 11; // Length of '"listings":[' 
          }
        }
        
        if (listingsArrayStart !== -1) {
          // Parse complete listing objects from the buffer
          // Look for complete JSON objects (balanced braces, accounting for strings)
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          let startIdx = -1;
          const listingsPart = buffer.substring(listingsArrayStart);
          
          for (let i = 0; i < listingsPart.length; i++) {
            const char = listingsPart[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') {
                if (braceCount === 0) startIdx = i;
                braceCount++;
              } else if (char === '}') {
                braceCount--;
                if (braceCount === 0 && startIdx !== -1) {
                  // Found a complete listing object
                  try {
                    const listingJson = listingsPart.substring(startIdx, i + 1);
                    const listing = JSON.parse(listingJson);
                    if (listing.listingId && !listings.find(l => l.listingId === listing.listingId)) {
                      listings.push(listing);
                      // Filter for ERC1155 and update state incrementally
                      const editionListings = listings.filter((l: EnrichedAuctionData) => isERC1155(l.tokenSpec));
                      if (editionListings.length > 0) {
                        setEditionListings(editionListings.slice(0, displayCount));
                      }
                    }
                  } catch (e) {
                    // Partial JSON, will be completed in next chunk
                  }
                  startIdx = -1;
                }
              } else if (char === ']' && braceCount === 0) {
                // End of listings array - try to parse final metadata
                const afterArray = buffer.substring(listingsArrayStart + i);
                try {
                  const metaMatch = afterArray.match(/"count":(\d+)/);
                  if (metaMatch) metadata.count = parseInt(metaMatch[1]);
                  const subgraphMatch = afterArray.match(/"subgraphDown":(true|false)/);
                  if (subgraphMatch) metadata.subgraphDown = subgraphMatch[1] === 'true';
                } catch {
                  // Continue
                }
                break;
              }
            }
          }
          
          // Keep the unprocessed part of the buffer (incomplete JSON objects)
          if (startIdx !== -1 && startIdx < listingsPart.length) {
            buffer = buffer.substring(0, listingsArrayStart + startIdx);
          } else {
            // Remove processed listings from buffer
            const lastProcessedIdx = listingsPart.lastIndexOf('}');
            if (lastProcessedIdx !== -1) {
              buffer = buffer.substring(0, listingsArrayStart + lastProcessedIdx + 1);
            }
          }
        }
      }
      
      // Final parse attempt for any remaining complete data
      try {
        const finalData = JSON.parse(buffer);
        if (finalData.listings && Array.isArray(finalData.listings)) {
          listings = finalData.listings;
          const editionListings = listings.filter((l: EnrichedAuctionData) => isERC1155(l.tokenSpec));
          setEditionListings(editionListings.slice(0, displayCount));
        }
        if (finalData.subgraphDown !== undefined) {
          metadata.subgraphDown = finalData.subgraphDown;
        }
      } catch {
        // Buffer might be incomplete, that's okay
      }
      
      const fetchTime = Date.now() - startTime;
      console.log('[HomePageClient] Edition fetch completed in', fetchTime, 'ms');
      
      // Filter for ERC1155 only
      const editionListings = listings.filter((listing: EnrichedAuctionData) => isERC1155(listing.tokenSpec));
      const isSubgraphDown = metadata.subgraphDown || false;
      console.log('[HomePageClient] Received Editions:', editionListings.length, 'from', listings.length, 'total listings');
      
      // Take only displayCount for display
      setEditionListings(editionListings.slice(0, displayCount));
      setEditionSubgraphDown(isSubgraphDown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Editions';
      console.error('[HomePageClient] Error fetching Editions:', errorMessage, error);
      setEditionError(errorMessage);
    } finally {
      setEditionLoading(false);
      editionLoadingRef.current = false;
    }
  }, [displayCount]);

  // Initialize NFTs section
  useEffect(() => {
    if (nftHasInitializedRef.current) return;
    nftHasInitializedRef.current = true;
    fetchRecentNFTs();
    
    // Refetch when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchRecentNFTs();
      }
    };
    
    // Refetch on window focus (user switches back to window)
    const handleFocus = () => {
      fetchRecentNFTs();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchRecentNFTs]);

  // Initialize Editions section
  useEffect(() => {
    if (editionHasInitializedRef.current) return;
    editionHasInitializedRef.current = true;
    fetchRecentEditions();
    
    // Refetch when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchRecentEditions();
      }
    };
    
    // Refetch on window focus (user switches back to window)
    const handleFocus = () => {
      fetchRecentEditions();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchRecentEditions]);


  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Bar */}
      <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
        <Logo />
        <div className="flex items-center gap-3">
          <ProfileDropdown />
        </div>
      </header>

      {/* Create Listing Button - Minimal */}
      {isMember && (
        <section className="border-b border-[#333333]">
          <div className="px-5 py-3 flex justify-center">
            <TransitionLink
              href="/create"
              prefetch={false}
              className="text-sm text-[#999999] hover:text-white transition-colors font-mek-mono tracking-[0.5px]"
            >
              + Create Listing
            </TransitionLink>
          </div>
        </section>
      )}

      {/* Homepage Layout (driven by admin arranger) */}
      <HomepageLayout />

      {/* Add Mini App Banner - Only show in miniapp context if not already added */}
      {isMiniApp && !isMiniAppInstalled && actions && (
        <section className="border-b border-[#333333]">
          <div className="px-5 py-3 flex justify-center items-center">
            <button
              onClick={actions.addMiniApp}
              className="text-[24px] font-mek-mono text-[#999999] hover:text-[#cccccc] transition-colors underline"
            >
              Add mini-app to Farcaster
            </button>
          </div>
        </section>
      )}

      {/* Membership Banner - Only show if not a member */}
      {!membershipLoading && !isMember && (
        <section className="border-b border-[#333333] bg-[#0a0a0a]">
          <div className="px-5 py-5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-bold text-[#ff6b35] tracking-[0.5px]">
                Mint Member for early access
              </div>
              <div className="text-xs font-normal text-[#999999]">
                only 0.0001 ETH/month
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => {
                  if (isConnected) {
                    router.push("/membership");
                  } else if (openConnectModal) {
                    openConnectModal();
                  }
                }}
                className="px-6 py-2.5 bg-[#ff6b35] text-black text-sm font-bold tracking-[0.5px] hover:bg-[#ff8555] transition-colors whitespace-nowrap"
              >
                Mint Member
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Recent NFTs and Editions - Side by side on xl screens */}
      <div className="xl:flex xl:gap-8">
      {/* Recent NFTs (721s) */}
      <section id="nfts" className="px-5 py-8 xl:flex-1">
        <div className="flex items-center justify-between mb-6">
          <TransitionLink
            href="/market?tab=recent"
            prefetch={false}
            className="text-base font-semibold uppercase tracking-[2px] text-white hover:text-white transition-colors font-mek-mono cursor-pointer underline decoration-white/60 hover:decoration-white"
          >
            Recent NFTs
          </TransitionLink>
        </div>

        {nftLoading ? (
          <div className="text-center py-12">
            <p className="text-[#cccccc]">Loading NFTs...</p>
          </div>
        ) : nftError ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-2">Error loading NFTs</p>
            <p className="text-[#999999] text-sm mb-4">{nftError}</p>
            <button
              onClick={() => {
                setNftListings([]);
                fetchRecentNFTs();
              }}
              className="text-white hover:underline"
            >
              Retry
            </button>
          </div>
        ) : nftListings.length === 0 ? (
          <div className="text-center py-12">
            {nftSubgraphDown ? (
              <>
                <p className="text-[#cccccc] mb-2">Unable to load NFTs</p>
                <p className="text-[#999999] text-sm mb-4">The data service is temporarily unavailable. Please check back later.</p>
                <button
                  onClick={() => {
                    setNftSubgraphDown(false);
                    fetchRecentNFTs();
                  }}
                  className="text-white hover:underline text-sm"
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <p className="text-[#cccccc] mb-4">No NFTs found</p>
                {isMember && (
                  <TransitionLink
                    href="/create"
                    prefetch={false}
                    className="text-white hover:underline"
                  >
                    Create your first listing
                  </TransitionLink>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              {nftListings.map((auction, index) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  gradient={gradients[index % gradients.length]}
                  index={index}
                />
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <TransitionLink
                href="/market?tab=recent&tokenSpec=ERC721"
                prefetch={false}
                className="text-xs text-[#999999] hover:text-white transition-colors font-mek-mono tracking-[0.5px] flex items-center gap-1"
              >
                <span>[</span>
                <span>—</span>
                <span>&gt;</span>
                <span>]</span>
              </TransitionLink>
            </div>
          </div>
        )}
      </section>

      {/* Recent Editions */}
      <section id="editions" className="px-5 py-8 xl:flex-1">
        <div className="flex items-center justify-between mb-6">
          <TransitionLink
            href="/market?tab=recent"
            prefetch={false}
            className="text-base font-semibold uppercase tracking-[2px] text-white hover:text-white transition-colors font-mek-mono cursor-pointer underline decoration-white/60 hover:decoration-white"
          >
            Recent Editions
          </TransitionLink>
        </div>

        {editionLoading ? (
          <div className="text-center py-12">
            <p className="text-[#cccccc]">Loading editions...</p>
          </div>
        ) : editionError ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-2">Error loading editions</p>
            <p className="text-[#999999] text-sm mb-4">{editionError}</p>
            <button
              onClick={() => {
                setEditionListings([]);
                fetchRecentEditions();
              }}
              className="text-white hover:underline"
            >
              Retry
            </button>
          </div>
        ) : editionListings.length === 0 ? (
          <div className="text-center py-12">
            {editionSubgraphDown ? (
              <>
                <p className="text-[#cccccc] mb-2">Unable to load editions</p>
                <p className="text-[#999999] text-sm mb-4">The data service is temporarily unavailable. Please check back later.</p>
                <button
                  onClick={() => {
                    setEditionSubgraphDown(false);
                    fetchRecentEditions();
                  }}
                  className="text-white hover:underline text-sm"
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <p className="text-[#cccccc] mb-4">No editions found</p>
                {isMember && (
                  <TransitionLink
                    href="/create"
                    prefetch={false}
                    className="text-white hover:underline"
                  >
                    Create your first listing
                  </TransitionLink>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              {editionListings.map((auction, index) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  gradient={gradients[index % gradients.length]}
                  index={index}
                />
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <TransitionLink
                href="/market?tab=recent&tokenSpec=ERC1155"
                prefetch={false}
                className="text-xs text-[#999999] hover:text-white transition-colors font-mek-mono tracking-[0.5px] flex items-center gap-1"
              >
                <span>[</span>
                <span>—</span>
                <span>&gt;</span>
                <span>]</span>
              </TransitionLink>
            </div>
          </div>
        )}
      </section>
      </div>

      {/* Admin Tools Panel - Only visible when admin mode is enabled */}
      <AdminToolsPanel />
    </div>
  );
}

