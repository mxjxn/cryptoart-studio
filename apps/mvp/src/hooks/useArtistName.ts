"use client";

import { useState, useEffect, useRef } from "react";

type NameSource = "farcaster" | "ens" | "override" | "contract-creator" | null;

interface ArtistNameResult {
  artistName: string | null;
  source: NameSource;
  isLoading: boolean;
  error: Error | null;
  creatorAddress?: string | null; // Contract creator address if found but name not resolved
}

// In-memory cache for artist names to avoid repeated API calls
const artistNameCache = new Map<string, { name: string | null; source: NameSource; creatorAddress?: string | null }>();
// Pending requests to deduplicate in-flight fetches
const pendingArtistRequests = new Map<string, Promise<{ name: string | null; source: NameSource; creatorAddress?: string | null }>>();

/**
 * Hook to resolve an artist name from an Ethereum address.
 * 
 * Resolution priority:
 * 1. Neynar API (Farcaster user by verified address)
 * 2. ENS reverse resolution
 * 3. Manual overrides
 * 4. Contract creator lookup (if contractAddress provided)
 * 
 * Results are cached in-memory to avoid repeated API calls.
 * 
 * @param address - The Ethereum address to resolve
 * @param contractAddress - Optional contract address to check creator
 * @param tokenId - Optional token ID for contract creator lookup
 * @returns Object containing artistName, source, isLoading, and error states
 */
export function useArtistName(
  address: string | null | undefined,
  contractAddress?: string | null,
  tokenId?: string | number | bigint | null
): ArtistNameResult {
  const [artistName, setArtistName] = useState<string | null>(null);
  const [source, setSource] = useState<NameSource>(null);
  const [creatorAddress, setCreatorAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    // Allow null address if contractAddress is provided (for contract creator lookup)
    if (!address && !contractAddress) {
      setArtistName(null);
      setSource(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // If address is provided, validate it
    if (address && !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      setArtistName(null);
      setSource(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Use a dummy address if none provided but contractAddress is (for API route validation)
    // The API will prioritize contract creator lookup anyway
    const normalizedAddress = address ? address.toLowerCase() : '0x0000000000000000000000000000000000000000';
    
    // Create a cache key that includes contractAddress when provided
    // This ensures different contracts get different cache entries
    const cacheKey = contractAddress 
      ? `${normalizedAddress}:${contractAddress.toLowerCase()}:${tokenId || ''}`
      : normalizedAddress;

    // Check cache first
    const cached = artistNameCache.get(cacheKey);
    if (cached) {
      setArtistName(cached.name);
      setSource(cached.source);
      setCreatorAddress(cached.creatorAddress || null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check if there's already a pending request for this cache key
    if (pendingArtistRequests.has(cacheKey)) {
      setIsLoading(true);
      pendingArtistRequests.get(cacheKey)!.then((result) => {
        setArtistName(result.name);
        setSource(result.source);
        setCreatorAddress(result.creatorAddress || null);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
      return;
    }

    // Prevent duplicate fetches for the same cache key
    if (fetchedRef.current === cacheKey) {
      return;
    }

    fetchedRef.current = cacheKey;
    setIsLoading(true);
    setError(null);

    // Build URL with optional contract address and tokenId
    const url = new URL(`/api/artist/${normalizedAddress}`, window.location.origin);
    if (contractAddress) {
      url.searchParams.set("contractAddress", contractAddress);
    }
    if (tokenId !== undefined && tokenId !== null) {
      url.searchParams.set("tokenId", String(tokenId));
    }

    // Create and store the pending request
    const request = fetch(url.toString())
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch artist name: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        const result = {
          name: data.name as string | null,
          source: data.source as NameSource,
          creatorAddress: data.creatorAddress as string | null | undefined,
        };
        artistNameCache.set(cacheKey, result);
        return result;
      })
      .finally(() => {
        pendingArtistRequests.delete(cacheKey);
      });

    pendingArtistRequests.set(cacheKey, request);

    request.then((result) => {
      setArtistName(result.name);
      setSource(result.source);
      setCreatorAddress(result.creatorAddress || null);
      setIsLoading(false);
    }).catch((err) => {
      console.error("Error fetching artist name:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setArtistName(null);
      setSource(null);
      setIsLoading(false);
    });
  }, [address, contractAddress, tokenId]);

  return { artistName, source, isLoading, error, creatorAddress };
}

/**
 * Batch fetch artist names for multiple addresses.
 * Useful for lists where you need to resolve many names at once.
 * 
 * @param addresses - Array of Ethereum addresses to resolve
 * @returns Map of address -> { name, source }
 */
export function useArtistNames(addresses: (string | null | undefined)[]): Map<string, { artistName: string | null; source: NameSource; isLoading: boolean }> {
  const [results, setResults] = useState<Map<string, { artistName: string | null; source: NameSource; isLoading: boolean }>>(new Map());
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const validAddresses = addresses
      .filter((addr): addr is string => !!addr && /^0x[a-fA-F0-9]{40}$/i.test(addr))
      .map((addr) => addr.toLowerCase());

    if (validAddresses.length === 0) {
      return;
    }

    // Initialize results with cached values and loading states
    const newResults = new Map<string, { artistName: string | null; source: NameSource; isLoading: boolean }>();
    const addressesToFetch: string[] = [];

    for (const addr of validAddresses) {
      const cached = artistNameCache.get(addr);
      if (cached) {
        newResults.set(addr, { artistName: cached.name, source: cached.source, isLoading: false });
      } else if (!fetchedRef.current.has(addr)) {
        newResults.set(addr, { artistName: null, source: null, isLoading: true });
        addressesToFetch.push(addr);
      }
    }

    setResults(newResults);

    // Fetch uncached addresses
    async function fetchAll() {
      for (const addr of addressesToFetch) {
        if (fetchedRef.current.has(addr)) continue;
        fetchedRef.current.add(addr);

        try {
          const response = await fetch(`/api/artist/${addr}`);
          if (response.ok) {
            const data = await response.json();
            artistNameCache.set(addr, { name: data.name, source: data.source });
            setResults((prev) => {
              const updated = new Map(prev);
              updated.set(addr, { artistName: data.name, source: data.source, isLoading: false });
              return updated;
            });
          }
        } catch (err) {
          console.error(`Error fetching artist name for ${addr}:`, err);
          setResults((prev) => {
            const updated = new Map(prev);
            updated.set(addr, { artistName: null, source: null, isLoading: false });
            return updated;
          });
        }
      }
    }

    if (addressesToFetch.length > 0) {
      fetchAll();
    }
  }, [addresses.join(",")]); // Re-run when addresses change

  return results;
}

/**
 * Clear the artist name cache.
 * Useful for forcing a refresh of all artist names.
 */
export function clearArtistNameCache(): void {
  artistNameCache.clear();
}

