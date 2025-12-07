"use client";

import { useState, useEffect } from "react";

interface UseUsernameResult {
  username: string | null;
  isLoading: boolean;
  error: Error | null;
}

// Module-level cache to deduplicate requests across components
const usernameCache = new Map<string, string | null>();
const pendingRequests = new Map<string, Promise<string | null>>();

/**
 * Hook to get username from address
 * Returns username if found, null otherwise
 * Includes deduplication to prevent multiple requests for the same address
 */
export function useUsername(address: string | null | undefined): UseUsernameResult {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      setUsername(null);
      setIsLoading(false);
      return;
    }

    const normalizedAddress = address.toLowerCase();

    // Check cache first
    if (usernameCache.has(normalizedAddress)) {
      setUsername(usernameCache.get(normalizedAddress)!);
      setIsLoading(false);
      return;
    }

    // Check if there's already a pending request
    if (pendingRequests.has(normalizedAddress)) {
      setIsLoading(true);
      pendingRequests.get(normalizedAddress)!.then((result) => {
        setUsername(result);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    // Create and store the pending request
    const request = fetch(`/api/user/username/${normalizedAddress}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch username");
        }
        return res.json();
      })
      .then((data) => {
        const result = data.username as string | null;
        usernameCache.set(normalizedAddress, result);
        return result;
      })
      .catch((err) => {
        console.error("Error fetching username:", err);
        return null;
      })
      .finally(() => {
        pendingRequests.delete(normalizedAddress);
      });

    pendingRequests.set(normalizedAddress, request);

    request.then((result) => {
      setUsername(result);
      setIsLoading(false);
    }).catch((err) => {
      setError(err);
      setUsername(null);
      setIsLoading(false);
    });
  }, [address]);

  return { username, isLoading, error };
}

