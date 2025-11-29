"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "~/components/ui/card";
import { formatEther } from "viem";

interface ArtistStats {
  artistFid: number;
  artistName?: string;
  artistPfp?: string;
  collectionCount: number;
  totalVolume: string;
  collectorCount: number;
  newestPiece?: {
    collectionAddress: string;
    tokenId?: string;
    createdAt: string;
  };
}

export function FeaturedArtistShowcase() {
  const [artists, setArtists] = useState<ArtistStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArtists() {
      try {
        setLoading(true);
        const response = await fetch("/api/landing/featured-artists?limit=4");
        const data = await response.json();
        setArtists(data.artists || []);
      } catch (error) {
        console.error("Error fetching featured artists:", error);
        setArtists([]);
      } finally {
        setLoading(false);
      }
    }

    fetchArtists();
  }, []);

  if (loading) {
    return (
      <div className="h-[30vh] flex items-center justify-center">
        <div className="text-gray-500">Loading featured artists...</div>
      </div>
    );
  }

  if (artists.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Featured Artists</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {artists.map((artist) => (
          <Card
            key={artist.artistFid}
            className="min-w-[280px] flex-shrink-0 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => {
              // TODO: Navigate to artist profile
              window.location.href = `/artist/${artist.artistFid}`;
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                {artist.artistPfp ? (
                  <img
                    src={artist.artistPfp}
                    alt={artist.artistName || "Artist"}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-xs">Artist</span>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">
                    {artist.artistName || `Artist #${artist.artistFid}`}
                  </h3>
                  <p className="text-xs text-gray-500">
                    This week's most collected artist
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Collectors</p>
                  <p className="font-semibold">{artist.collectorCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Volume</p>
                  <p className="font-semibold">
                    {formatEther(BigInt(artist.totalVolume))} ETH
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-gray-500 mb-1">Collected by</p>
                <div className="flex gap-1">
                  {/* TODO: Show collector avatars */}
                  <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                  <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                  <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                </div>
              </div>

              <button
                className="mt-3 text-sm text-primary hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `/artist/${artist.artistFid}`;
                }}
              >
                View Gallery →
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

