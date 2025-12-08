"use client";

import { useState, useEffect } from "react";
import { type Address } from "viem";
import { isETH } from "~/hooks/useERC20Token";

interface TokenImageProps {
  tokenAddress: string | undefined;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * TokenImage component - Displays ERC20 token logo with caching
 * Uses the /api/tokens/[address]/image endpoint which caches images in the database
 */
export function TokenImage({ 
  tokenAddress, 
  size = 20, 
  className = "",
  fallback 
}: TokenImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!tokenAddress || isETH(tokenAddress)) {
      setLoading(false);
      return;
    }

    const fetchImage = async () => {
      try {
        const response = await fetch(`/api/tokens/${tokenAddress}/image`);
        if (response.ok) {
          const data = await response.json();
          if (data.imageUrl) {
            setImageUrl(data.imageUrl);
          } else {
            setError(true);
          }
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Error fetching token image:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchImage();
  }, [tokenAddress]);

  if (!tokenAddress || isETH(tokenAddress)) {
    return null;
  }

  if (loading) {
    return (
      <div 
        className={`inline-block bg-[#333333] rounded-full ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  if (error || !imageUrl) {
    return fallback || null;
  }

  return (
    <img
      src={imageUrl}
      alt="Token"
      className={`inline-block rounded-full ${className}`}
      style={{ width: size, height: size }}
      onError={() => setError(true)}
    />
  );
}

