"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { formatEther } from "viem";
import { TransitionLink } from "~/components/TransitionLink";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { Logo } from "~/components/Logo";
import { useEnsNameForAddress } from "~/hooks/useEnsName";
import { AuctionCard } from "~/components/AuctionCard";
import { AdminToolsPanel } from "~/components/AdminToolsPanel";
import { HomepageLayout } from "~/components/HomepageLayout";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useMiniApp } from "@neynar/react";
import { useAuthMode } from "~/hooks/useAuthMode";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter, usePathname } from "next/navigation";
import type { EnrichedAuctionData } from "~/lib/types";


// Helper function to check if a listing is ERC721
function isERC721(tokenSpec: EnrichedAuctionData["tokenSpec"]): boolean {
  return tokenSpec === "ERC721" || String(tokenSpec) === "1";
}

// Helper function to check if a listing is ERC1155
function isERC1155(tokenSpec: EnrichedAuctionData["tokenSpec"]): boolean {
  return tokenSpec === "ERC1155" || String(tokenSpec) === "2";
}

/** Decorative patron labels aligned with Figma Patrons section (preview only). */
const REDESIGN_PATRON_PREVIEW = [
  "0xbc9…9915", "0x053…6ee0", "0x9ff…f28b", "wokhe…eth", "maxca…eth", "gurug…eth",
  "tomat…eth", "tinyr…eth", "nifty…eth", "crypt…eth", "mxjxn…eth", "aoife…eth",
  "0x626…fc49", "0xc1d…7d14", "0x3c5…ba62", "0x2f0…9fa7", "0x9e7…90e5", "0x771…a711",
  "0x5c0…b3a3", "0x1a2…3307", "0x921…36a5", "mumbo…eth", "wgmee…eth", "push-…eth", "efdot…eth",
];

/** Preview homepage matching Figma "Homepage" (Screens); served at /redesign */
export default function HomePageClientV2() {
  // Recent NFTs (ERC721) state
  const [nftListings, setNftListings] = useState<EnrichedAuctionData[]>([]);
  const [nftExpandedListings, setNftExpandedListings] = useState<EnrichedAuctionData[]>([]);
  const [nftLoading, setNftLoading] = useState(true);
  const [nftLoadingMore, setNftLoadingMore] = useState(false);
  const [nftError, setNftError] = useState<string | null>(null);
  const [nftSubgraphDown, setNftSubgraphDown] = useState(false);
  const [nftHasMore, setNftHasMore] = useState(true);
  const nftLoadingRef = useRef(true);
  const nftHasInitializedRef = useRef(false);
  const nftExpandedRef = useRef(false);

  // Recent Editions (ERC1155) state
  const [editionListings, setEditionListings] = useState<EnrichedAuctionData[]>([]);
  const [editionExpandedListings, setEditionExpandedListings] = useState<EnrichedAuctionData[]>([]);
  const [editionLoading, setEditionLoading] = useState(true);
  const [editionLoadingMore, setEditionLoadingMore] = useState(false);
  const [editionError, setEditionError] = useState<string | null>(null);
  const [editionSubgraphDown, setEditionSubgraphDown] = useState(false);
  const [editionHasMore, setEditionHasMore] = useState(true);
  const editionLoadingRef = useRef(true);
  const editionHasInitializedRef = useRef(false);
  const editionExpandedRef = useRef(false);

  // Loading modal state for listing navigation
  const [loadingListing, setLoadingListing] = useState<{
    listingId: string;
    image: string | null;
    title: string;
  } | null>(null);

  const pageSize = 4; // Show 4 listings per section on homepage
  const displayCount = 4; // Display exactly 4 items initially
  const initialFetchCount = 20; // Fetch 20 initially to account for filtering
  const loadMoreCount = 20; // Load 20 more items when expanding

  // Load more NFTs inline
  const loadMoreNFTs = useCallback(async () => {
    if (nftLoadingMore || !nftHasMore || nftExpandedRef.current) return;
    
    setNftLoadingMore(true);
    nftExpandedRef.current = true;
    
    try {
      // Skip the initial fetch count since we fetched that many listings initially
      // This ensures we don't get duplicates when filtering client-side
      const skip = initialFetchCount;
      const response = await fetch(`/api/listings/browse?first=${loadMoreCount}&skip=${skip}&orderBy=createdAt&orderDirection=desc&enrich=true&stream=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // Parse streaming JSON response (same logic as fetchRecentNFTs)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let listings: EnrichedAuctionData[] = [];
      let listingsArrayStart = -1;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        if (listingsArrayStart === -1) {
          const arrayStart = buffer.indexOf('"listings":[');
          if (arrayStart !== -1) {
            listingsArrayStart = arrayStart + 11;
          }
        }
        
        if (listingsArrayStart !== -1) {
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
                  try {
                    const listingJson = listingsPart.substring(startIdx, i + 1);
                    const listing = JSON.parse(listingJson);
                    if (listing.listingId && !listings.find(l => l.listingId === listing.listingId)) {
                      listings.push(listing);
                      const nftListings = listings.filter((l: EnrichedAuctionData) => isERC721(l.tokenSpec));
                      setNftExpandedListings(nftListings);
                    }
                  } catch (e) {
                    // Partial JSON, will be completed in next chunk
                  }
                  startIdx = -1;
                }
              } else if (char === ']' && braceCount === 0) {
                break;
              }
            }
          }
        }
      }
      
      // Final parse attempt
      try {
        const finalData = JSON.parse(buffer);
        if (finalData.listings && Array.isArray(finalData.listings)) {
          listings = finalData.listings;
          const nftListings = listings.filter((l: EnrichedAuctionData) => isERC721(l.tokenSpec));
          setNftExpandedListings(nftListings);
        }
      } catch {
        // Buffer might be incomplete, that's okay
      }
      
      const nftListings = listings.filter((listing: EnrichedAuctionData) => isERC721(listing.tokenSpec));
      setNftExpandedListings(nftListings);
      
      // Check if we have more to load
      if (nftListings.length < loadMoreCount) {
        setNftHasMore(false);
      }
    } catch (error) {
      console.error('[HomePageClientV2] Error loading more NFTs:', error);
    } finally {
      setNftLoadingMore(false);
    }
  }, [initialFetchCount, loadMoreCount, nftHasMore, nftLoadingMore]);

  // Load more Editions inline
  const loadMoreEditions = useCallback(async () => {
    if (editionLoadingMore || !editionHasMore || editionExpandedRef.current) return;
    
    setEditionLoadingMore(true);
    editionExpandedRef.current = true;
    
    try {
      // Skip the initial fetch count since we fetched that many listings initially
      // This ensures we don't get duplicates when filtering client-side
      const skip = initialFetchCount;
      const response = await fetch(`/api/listings/browse?first=${loadMoreCount}&skip=${skip}&orderBy=createdAt&orderDirection=desc&enrich=true&stream=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // Parse streaming JSON response (same logic as fetchRecentEditions)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let listings: EnrichedAuctionData[] = [];
      let listingsArrayStart = -1;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        if (listingsArrayStart === -1) {
          const arrayStart = buffer.indexOf('"listings":[');
          if (arrayStart !== -1) {
            listingsArrayStart = arrayStart + 11;
          }
        }
        
        if (listingsArrayStart !== -1) {
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
                  try {
                    const listingJson = listingsPart.substring(startIdx, i + 1);
                    const listing = JSON.parse(listingJson);
                    if (listing.listingId && !listings.find(l => l.listingId === listing.listingId)) {
                      listings.push(listing);
                      const editionListings = listings.filter((l: EnrichedAuctionData) => isERC1155(l.tokenSpec));
                      setEditionExpandedListings(editionListings);
                    }
                  } catch (e) {
                    // Partial JSON, will be completed in next chunk
                  }
                  startIdx = -1;
                }
              } else if (char === ']' && braceCount === 0) {
                break;
              }
            }
          }
        }
      }
      
      // Final parse attempt
      try {
        const finalData = JSON.parse(buffer);
        if (finalData.listings && Array.isArray(finalData.listings)) {
          listings = finalData.listings;
          const editionListings = listings.filter((l: EnrichedAuctionData) => isERC1155(l.tokenSpec));
          setEditionExpandedListings(editionListings);
        }
      } catch {
        // Buffer might be incomplete, that's okay
      }
      
      const editionListings = listings.filter((listing: EnrichedAuctionData) => isERC1155(listing.tokenSpec));
      setEditionExpandedListings(editionListings);
      
      // Check if we have more to load
      if (editionListings.length < loadMoreCount) {
        setEditionHasMore(false);
      }
    } catch (error) {
      console.error('[HomePageClientV2] Error loading more Editions:', error);
    } finally {
      setEditionLoadingMore(false);
    }
  }, [initialFetchCount, loadMoreCount, editionHasMore, editionLoadingMore]);
  const { isPro, loading: membershipLoading } = useMembershipStatus();
  const isMember = isPro; // Alias for clarity
  const { actions, context } = useMiniApp();
  const { isMiniApp } = useAuthMode();
  const { address, isConnected } = useEffectiveAddress();
  const ensName = useEnsNameForAddress(address, !isMiniApp && isConnected && !!address);
  const { openConnectModal } = useConnectModal();
  const router = useRouter();
  const pathname = usePathname();

  // Hide loading modal when route changes away from homepage (navigation completes)
  useEffect(() => {
    if (loadingListing) {
      // If we're no longer on the homepage, hide the modal
      // pathname will be /listing/[id] when navigation completes
      if (pathname && pathname !== '/' && pathname.startsWith('/listing/')) {
        // Small delay to allow page transition to complete
        const timer = setTimeout(() => {
          setLoadingListing(null);
        }, 300);
        return () => clearTimeout(timer);
      } else {
        // Fallback: hide modal after 5 seconds if navigation doesn't happen
        const fallbackTimer = setTimeout(() => {
          setLoadingListing(null);
        }, 5000);
        return () => clearTimeout(fallbackTimer);
      }
    }
  }, [pathname, loadingListing]);
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
      console.log('[HomePageClientV2] Fetching recent NFTs...', { fetchCount: initialFetchCount });
      const startTime = Date.now();
      
      // Use streaming mode for incremental loading
      const response = await fetch(`/api/listings/browse?first=${initialFetchCount}&skip=0&orderBy=createdAt&orderDirection=desc&enrich=true&stream=true`);
      
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
      console.log('[HomePageClientV2] NFT fetch completed in', fetchTime, 'ms');
      
      // Filter for ERC721 only
      const nftListings = listings.filter((listing: EnrichedAuctionData) => isERC721(listing.tokenSpec));
      const isSubgraphDown = metadata.subgraphDown || false;
      console.log('[HomePageClientV2] Received NFTs:', nftListings.length, 'from', listings.length, 'total listings');
      
      // Take only displayCount for display
      setNftListings(nftListings.slice(0, displayCount));
      setNftSubgraphDown(isSubgraphDown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch NFTs';
      console.error('[HomePageClientV2] Error fetching NFTs:', errorMessage, error);
      setNftError(errorMessage);
    } finally {
      setNftLoading(false);
      nftLoadingRef.current = false;
    }
  }, [displayCount, initialFetchCount]);

  // Fetch recent Editions (ERC1155) - homepage only shows 6
  const fetchRecentEditions = useCallback(async () => {
    setEditionLoading(true);
    editionLoadingRef.current = true;
    setEditionError(null);
    try {
      // Fetch more than needed to account for filtering
      const fetchCount = 20; // Fetch 20 to ensure we get enough ERC1155 after filtering
      console.log('[HomePageClientV2] Fetching recent Editions...', { fetchCount });
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
      console.log('[HomePageClientV2] Edition fetch completed in', fetchTime, 'ms');
      
      // Filter for ERC1155 only
      const editionListings = listings.filter((listing: EnrichedAuctionData) => isERC1155(listing.tokenSpec));
      const isSubgraphDown = metadata.subgraphDown || false;
      console.log('[HomePageClientV2] Received Editions:', editionListings.length, 'from', listings.length, 'total listings');
      
      // Take only displayCount for display
      setEditionListings(editionListings.slice(0, displayCount));
      setEditionSubgraphDown(isSubgraphDown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Editions';
      console.error('[HomePageClientV2] Error fetching Editions:', errorMessage, error);
      setEditionError(errorMessage);
    } finally {
      setEditionLoading(false);
      editionLoadingRef.current = false;
    }
  }, [displayCount, initialFetchCount]);

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

  const displayHandle = isMiniApp
    ? context?.user?.username
      ? `@${context.user.username}`
      : context?.user?.displayName ?? "Guest"
    : !isConnected || !address
      ? "Connect wallet"
      : ensName
        ? `@${ensName.replace(/^@/, "")}`
        : `@${address.slice(0, 6)}…${address.slice(-4)}`;

  const formatListingEth = (a: EnrichedAuctionData) => {
    try {
      const v = a.currentPrice || a.initialAmount || "0";
      return `${formatEther(BigInt(v))} ETH`;
    } catch {
      return "— ETH";
    }
  };

  const bidRankLabels = ["Top bidder", "Second bidder", "Third bidder", "Fourth bidder"];
  const featuredListing = nftListings[0];
  const patronColSize = Math.ceil(REDESIGN_PATRON_PREVIEW.length / 3);
  const patronCols = [
    REDESIGN_PATRON_PREVIEW.slice(0, patronColSize),
    REDESIGN_PATRON_PREVIEW.slice(patronColSize, patronColSize * 2),
    REDESIGN_PATRON_PREVIEW.slice(patronColSize * 2),
  ];

  const gutter = "px-3 sm:px-5 md:px-8 lg:px-12 xl:px-16";

  return (
    <div className="min-h-screen bg-black text-white flex justify-center">
      <div className="flex w-full max-w-[402px] sm:max-w-[min(100%,720px)] md:max-w-[min(100%,900px)] lg:max-w-[min(100%,1100px)] xl:max-w-[min(100%,1280px)] flex-col min-h-screen border-x border-[#222] shadow-2xl">
      {/* Top Bar — centered logo; preferences left; profile right */}
      <header className="relative flex min-h-[72px] items-center justify-center border-b border-[#101010] bg-black px-4 py-4 sm:px-6 md:px-8">
        <div className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 items-center sm:left-6 md:left-8">
          <TransitionLink
            href="/settings"
            prefetch={false}
            className="flex min-h-11 min-w-11 items-center justify-center text-[#cccccc] transition-opacity hover:text-white hover:opacity-90"
            aria-label="Preferences and settings"
          >
            <svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </TransitionLink>
        </div>
        <Logo className="shrink-0" />
        <div className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 items-center gap-3 sm:right-6 md:right-8">
          <ProfileDropdown />
        </div>
      </header>

      {/* Create Listing */}
      {isMember && (
        <section className="border-b border-[#333333]">
          <div className={`flex justify-center py-3 ${gutter}`}>
            <TransitionLink
              href="/create"
              prefetch={false}
              className="font-mek-mono text-sm tracking-[0.5px] text-[#999999] transition-colors hover:text-white"
            >
              + Create Listing
            </TransitionLink>
          </div>
        </section>
      )}

      {/* Figma: membership strip */}
      {!membershipLoading && (
        <button
          type="button"
          onClick={() => {
            if (isMember) return;
            if (isConnected) router.push("/membership");
            else openConnectModal?.();
          }}
          className="flex w-full flex-wrap items-center justify-center gap-2.5 bg-[#f5b0d3] p-2.5 font-mek-mono text-[clamp(0.75rem,3.5vw,1.05rem)] font-medium leading-normal text-black"
        >
          <span>{isMember ? "Member" : "become a member"}</span>
          {!isMember && <span>0.0001 ETH /MONTH</span>}
        </button>
      )}

      {/* Figma: identity row */}
      <div className={`flex w-full items-center justify-between py-5 font-mek-mono text-sm text-white ${gutter}`}>
        <span className="min-w-0 truncate">{displayHandle}</span>
        <TransitionLink href="/settings" prefetch={false} className="shrink-0 text-white hover:underline">
          Settings
        </TransitionLink>
      </div>

      {/* Figma: hero / logo + tagline — stack on mobile, row on desktop */}
      <div className={`flex flex-col gap-4 pb-5 md:flex-row md:items-center md:gap-8 md:pb-8 ${gutter}`}>
        <div className="relative aspect-[384/119] w-full md:w-1/2 md:max-w-xl md:shrink-0">
          <Image
            src="/cryptoart-logo-wgmeets.png"
            alt="CryptoArt"
            fill
            className="object-contain object-left md:object-center"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 45vw, 576px"
            priority
          />
        </div>
        <p className="font-mek-mono text-sm leading-normal text-white md:flex-1 md:py-0">
          CryptoArt is an auction marketplace for digital art, centered on human curation. Create galleries to surface what
          matters.
        </p>
      </div>

      {/* Figma: Galleries (lime) */}
      <section className="w-full bg-[#dcf54c] text-[#272727]">
        <h2 className={`pb-2 pt-5 font-mek-mono text-[clamp(2rem,11vw,4.25rem)] font-medium leading-none ${gutter}`}>
          Galleries
        </h2>
        <HomepageLayout />
        <div className={`flex items-center justify-between border-t border-black/10 py-5 font-mek-mono text-sm ${gutter}`}>
          <span>Created by users</span>
          <TransitionLink href="/curate" prefetch={false} className="hover:underline">
            see more →
          </TransitionLink>
        </div>
      </section>

      {isMiniApp && !isMiniAppInstalled && actions && (
        <section className="border-b border-[#333333]">
          <div className={`flex items-center justify-center py-3 ${gutter}`}>
            <button
              type="button"
              onClick={actions.addMiniApp}
              className="font-mek-mono text-[#999999] underline decoration-[#999999] hover:text-[#cccccc]"
            >
              Add mini-app to Farcaster
            </button>
          </div>
        </section>
      )}

      {/* Figma: Listings (pink) */}
      <section id="nfts" className="w-full bg-[#f5acd1] pb-6">
        <h2 className={`pb-2 pt-5 font-mek-mono text-[clamp(2rem,11vw,4.25rem)] font-medium leading-none text-[#272727] ${gutter}`}>
          Listings
        </h2>

        {nftLoading ? (
          <p className={`py-8 text-center font-mek-mono text-sm text-[#272727] ${gutter}`}>Loading listings…</p>
        ) : nftError ? (
          <div className={`py-8 text-center ${gutter}`}>
            <p className="font-mek-mono text-sm text-red-700">{nftError}</p>
            <button type="button" onClick={() => { setNftListings([]); fetchRecentNFTs(); }} className="mt-2 font-mek-mono text-sm underline">
              Retry
            </button>
          </div>
        ) : nftListings.length === 0 ? (
          <p className={`py-8 text-center font-mek-mono text-sm text-[#272727] ${gutter}`}>No listings yet.</p>
        ) : (
          <>
            <div className={`space-y-2.5 lg:flex lg:flex-row lg:items-start lg:gap-8 lg:space-y-0 ${gutter}`}>
            {featuredListing && (
              <div className="pb-2.5 lg:max-w-md lg:shrink-0 lg:pb-0 lg:w-full">
                <TransitionLink
                  href={`/listing/${featuredListing.listingId}`}
                  prefetch={false}
                  onClick={() =>
                    setLoadingListing({
                      listingId: featuredListing.listingId,
                      image: featuredListing.thumbnailUrl || featuredListing.image || null,
                      title: featuredListing.title || "Listing",
                    })
                  }
                  className="block overflow-hidden bg-white"
                >
                  <div className="relative aspect-square w-full max-w-[392px] mx-auto bg-neutral-200 lg:mx-0 lg:max-w-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={featuredListing.thumbnailUrl || featuredListing.image || ""}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute left-0 top-0 flex items-center gap-2.5 bg-[#272727] p-2.5">
                      <span className="h-2 w-2 shrink-0 bg-[#00ff11]" aria-hidden />
                      <span className="font-mek-mono text-sm text-white">active</span>
                    </div>
                    <div className="absolute bottom-0 left-0 bg-white p-2.5 font-mek-mono text-sm text-black">
                      <p>{formatListingEth(featuredListing)}</p>
                      <p className="text-neutral-700">by @{featuredListing.artist || "artist"}</p>
                    </div>
                  </div>
                  <div className="bg-[#1b1b1b] p-2.5 font-mek-mono text-sm text-white">
                    <p>{featuredListing.title || "Untitled"}</p>
                    <p className="text-neutral-400">by {featuredListing.artist || "—"}</p>
                  </div>
                </TransitionLink>
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {nftListings.slice(1).map((auction, index) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  gradient={gradients[(index + 1) % gradients.length]}
                  index={index + 1}
                  onNavigate={(listingId, image, title) => setLoadingListing({ listingId, image, title })}
                />
              ))}
            </div>

            {nftExpandedListings.length > 0 && (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {nftExpandedListings.map((auction, index) => (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    gradient={gradients[(nftListings.length + index) % gradients.length]}
                    index={nftListings.length + index + 100}
                    onNavigate={(listingId, image, title) => setLoadingListing({ listingId, image, title })}
                  />
                ))}
              </div>
            )}

            {!nftExpandedRef.current && (
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={loadMoreNFTs}
                  disabled={nftLoadingMore || !nftHasMore}
                  className="font-mek-mono text-sm text-[#272727] underline disabled:opacity-40"
                >
                  {nftLoadingMore ? "Loading…" : "More listings →"}
                </button>
              </div>
            )}
            </div>
            </div>
          </>
        )}
      </section>

      {/* Figma: Bids (white) */}
      <section className="w-full bg-white text-black">
        <h2 className={`pb-2 pt-5 font-mek-mono text-[clamp(2rem,11vw,4.25rem)] font-medium leading-none text-[#272727] ${gutter}`}>
          Bids
        </h2>
        <div className={`flex flex-col divide-y divide-neutral-200 pb-6 md:grid md:grid-cols-2 md:gap-4 md:divide-y-0 xl:grid-cols-4 ${gutter}`}>
          {nftLoading ? (
            <p className="p-2.5 font-mek-mono text-sm text-neutral-600 md:col-span-2 xl:col-span-4">Loading…</p>
          ) : (
            nftListings.slice(0, 4).map((auction, i) => (
              <TransitionLink
                key={auction.id}
                href={`/listing/${auction.listingId}`}
                prefetch={false}
                className="flex items-center gap-2.5 p-2.5 md:border md:border-neutral-200"
              >
                <div className="relative h-14 w-12 shrink-0 overflow-hidden bg-neutral-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={auction.thumbnailUrl || auction.image || ""}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 font-mek-mono text-sm">
                  <p className="truncate">{auction.title || "Listing"}</p>
                  <p className="truncate text-neutral-600">by {auction.artist || "—"}</p>
                </div>
                <p className="shrink-0 text-center font-mek-mono text-sm text-neutral-800">
                  {bidRankLabels[i] ?? `Bidder ${i + 1}`}
                </p>
              </TransitionLink>
            ))
          )}
        </div>
      </section>

      {/* Figma: Patrons (gold + red type) */}
      <section className="w-full bg-[#ecc100] pb-10">
        <h2 className={`pb-2 pt-5 font-mek-mono text-[clamp(2rem,11vw,4.25rem)] font-medium leading-none text-[#ff0402] ${gutter}`}>
          Patrons
        </h2>
        <div className={`mx-auto max-w-5xl border-b border-[#ff0402] py-2.5 font-mek-mono text-sm text-[#ff0402] ${gutter}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
            {patronCols.map((col, ci) => (
              <div key={ci} className="min-w-0 space-y-0">
                {col.map((line, li) => (
                  <p key={`${ci}-${li}`} className="truncate leading-normal">
                    {line}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className={`pt-3 font-mek-mono text-xs text-[#ff0402]/80 ${gutter}`}>Preview labels — member directory coming soon.</p>
      </section>

      </div>

      {/* Admin Tools Panel - Only visible when admin mode is enabled */}
      <AdminToolsPanel />

      {/* Loading Listing Modal - Shows when navigating to a listing */}
      {loadingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative max-w-md w-full mx-4 bg-[#1a1a1a] border border-[#333333] rounded-lg overflow-hidden">
            {/* Image */}
            {loadingListing.image ? (
              <div className="relative w-full aspect-square bg-black">
                <img
                  src={loadingListing.image}
                  alt={loadingListing.title}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="relative w-full aspect-square bg-gradient-to-br from-[#667eea] to-[#764ba2]" />
            )}
            
            {/* Content */}
            <div className="p-6">
              <h3 className="text-lg font-normal text-white mb-2 line-clamp-2">
                {loadingListing.title}
              </h3>
              <div className="flex items-center justify-center gap-2 text-[#999999] text-sm">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Loading listing</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

