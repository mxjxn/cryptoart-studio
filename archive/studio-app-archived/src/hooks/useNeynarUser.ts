import { useEffect, useState } from "react";

export interface NeynarUser {
  fid: number;
  score: number;
}

export function useNeynarUser(context?: { user?: { fid?: number } }) {
  const [user, setUser] = useState<NeynarUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!context?.user?.fid) {
      setUser(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    
    // Add timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    fetch(`/api/users?fids=${context.user.fid}`, {
      signal: controller.signal,
    })
      .then((response) => {
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (data.users?.[0]) {
          setUser(data.users[0]);
        } else {
          setUser(null);
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setError('Request timed out. Please try again.');
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));
  }, [context?.user?.fid]);

  return { user, loading, error };
} 