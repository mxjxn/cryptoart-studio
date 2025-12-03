"use client";

import { useState, useEffect } from "react";

interface UseUsernameResult {
  username: string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to get username from address
 * Returns username if found, null otherwise
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

    setIsLoading(true);
    setError(null);

    fetch(`/api/user/username/${address}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch username");
        }
        return res.json();
      })
      .then((data) => {
        setUsername(data.username);
      })
      .catch((err) => {
        console.error("Error fetching username:", err);
        setError(err);
        setUsername(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [address]);

  return { username, isLoading, error };
}

