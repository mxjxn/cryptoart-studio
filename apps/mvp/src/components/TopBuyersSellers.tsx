"use client";

import { useState, useEffect } from "react";
import { TransitionLink } from "~/components/TransitionLink";

interface Buyer {
  address: string;
  totalSpent: string;
  artworkCount: number;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
  fid?: number | null;
}

interface Seller {
  address: string;
  totalSold: string;
  artworkCount: number;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
  fid?: number | null;
}

interface TopBuyersSellersData {
  buyers: Buyer[];
  sellers: Seller[];
}

function formatAmount(amount: string): string {
  const value = BigInt(amount || "0");
  const divisor = BigInt(10 ** 18); // ETH decimals
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;

  // Format whole part with commas
  const wholePartFormatted = wholePart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (fractionalPart === BigInt(0)) {
    return wholePartFormatted;
  }

  let fractionalStr = fractionalPart.toString().padStart(18, "0");
  fractionalStr = fractionalStr.replace(/0+$/, "");
  if (fractionalStr.length > 2) {
    fractionalStr = fractionalStr.slice(0, 2);
  }

  return `${wholePartFormatted}.${fractionalStr}`;
}

function UserAvatar({ 
  pfpUrl, 
  displayName, 
  address 
}: { 
  pfpUrl?: string | null; 
  displayName?: string | null;
  address: string;
}) {
  const [imageError, setImageError] = useState(false);
  const displayNameInitial = displayName?.[0]?.toUpperCase() || address[2]?.toUpperCase() || "?";

  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-[#1a1a1a] ring-2 ring-[#333333]">
      {pfpUrl && !imageError ? (
        <img
          src={pfpUrl}
          alt={displayName || address}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-white text-sm font-medium">
          {displayNameInitial}
        </div>
      )}
    </div>
  );
}

function UserRow({ 
  user, 
  amount, 
  artworkCount,
  type 
}: { 
  user: Buyer | Seller; 
  amount: string;
  artworkCount: number;
  type: "buyer" | "seller";
}) {
  const displayName = user.displayName || user.username || `${user.address.slice(0, 6)}...${user.address.slice(-4)}`;
  const userLink = user.username ? `/user/${user.username}` : `/user/${user.address}`;

  return (
    <TransitionLink
      href={userLink}
      className="flex items-center gap-3 px-3 py-2 hover:bg-[#1a1a1a] transition-colors rounded"
    >
      <UserAvatar 
        pfpUrl={user.pfpUrl} 
        displayName={user.displayName || user.username}
        address={user.address}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium line-clamp-1">{displayName}</div>
        <div className="text-xs text-[#999999]">
          {artworkCount} {artworkCount === 1 ? "artwork" : "artworks"}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-sm font-medium">{formatAmount(amount)} ETH</div>
        <div className="text-xs text-[#999999] uppercase tracking-[0.5px]">
          {type === "buyer" ? "spent" : "sold"}
        </div>
      </div>
    </TransitionLink>
  );
}

export function TopBuyersSellers() {
  const [data, setData] = useState<TopBuyersSellersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/users/top-buyers-sellers?limit=10");
        if (!response.ok) {
          throw new Error("Failed to fetch top buyers and sellers");
        }
        const result = await response.json();
        if (result.success) {
          setData(result);
        } else {
          throw new Error(result.error || "Failed to fetch data");
        }
      } catch (err) {
        console.error("Error fetching top buyers and sellers:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <section className="px-5 py-8 border-b border-[#333333]">
        <div className="text-center py-8">
          <p className="text-[#999999] text-sm">Loading top buyers and sellers...</p>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return null; // Fail silently
  }

  const hasBuyers = data.buyers && data.buyers.length > 0;
  const hasSellers = data.sellers && data.sellers.length > 0;

  if (!hasBuyers && !hasSellers) {
    return null; // Don't show section if no data
  }

  return (
    <section className="px-5 py-8 border-b border-[#333333]">
      <h2 className="text-[13px] uppercase tracking-[2px] text-[#999999] font-mek-mono mb-6">
        Top Buyers & Sellers
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Buyers Column */}
        <div>
          <h3 className="text-xs uppercase tracking-[1px] text-[#666666] font-mek-mono mb-3">
            Top Buyers
          </h3>
          {hasBuyers ? (
            <div className="space-y-1">
              {data.buyers.map((buyer) => (
                <UserRow
                  key={buyer.address}
                  user={buyer}
                  amount={buyer.totalSpent}
                  artworkCount={buyer.artworkCount}
                  type="buyer"
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-[#666666] py-4">No buyers yet</div>
          )}
        </div>

        {/* Top Sellers Column */}
        <div>
          <h3 className="text-xs uppercase tracking-[1px] text-[#666666] font-mek-mono mb-3">
            Top Sellers
          </h3>
          {hasSellers ? (
            <div className="space-y-1">
              {data.sellers.map((seller) => (
                <UserRow
                  key={seller.address}
                  user={seller}
                  amount={seller.totalSold}
                  artworkCount={seller.artworkCount}
                  type="seller"
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-[#666666] py-4">No sellers yet</div>
          )}
        </div>
      </div>
    </section>
  );
}
