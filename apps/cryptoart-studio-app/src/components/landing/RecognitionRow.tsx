"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "~/components/ui/card";

interface RecognitionData {
  topCurator?: {
    collectorAddress: string;
    commissionsEarned: string;
    piecesSold: number;
  };
  mostSupportedArtist?: {
    artistFid: number;
    collectorCount: number;
    artistName?: string;
  };
  bestDiscovery?: {
    collectorAddress: string;
    discoveryCount: number;
    description: string;
  };
}

export function RecognitionRow() {
  const [recognition, setRecognition] = useState<RecognitionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecognition() {
      try {
        setLoading(true);
        const response = await fetch("/api/landing/recognition");
        const data = await response.json();
        setRecognition(data);
      } catch (error) {
        console.error("Error fetching recognition:", error);
        setRecognition(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRecognition();
  }, []);

  if (loading || !recognition) {
    return null;
  }

  const hasData = recognition.mostSupportedArtist || recognition.topCurator || recognition.bestDiscovery;

  if (!hasData) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">🔥 Recognition This Week</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recognition.topCurator && (
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-1">Top Curator</p>
              <p className="font-semibold text-sm truncate">
                {recognition.topCurator.collectorAddress.slice(0, 6)}...
                {recognition.topCurator.collectorAddress.slice(-4)}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {recognition.topCurator.piecesSold} pieces sold through curation
              </p>
              <button
                className="mt-2 text-xs text-primary hover:underline"
                onClick={() => {
                  // TODO: Navigate to curator profile
                  window.location.href = `/curator/${recognition.topCurator!.collectorAddress}`;
                }}
              >
                View Profile →
              </button>
            </CardContent>
          </Card>
        )}

        {recognition.mostSupportedArtist && (
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-1">Most Supported Artist</p>
              <p className="font-semibold text-sm">
                {recognition.mostSupportedArtist.artistName || 
                 `Artist #${recognition.mostSupportedArtist.artistFid}`}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {recognition.mostSupportedArtist.collectorCount} collectors
              </p>
              <button
                className="mt-2 text-xs text-primary hover:underline"
                onClick={() => {
                  // TODO: Navigate to artist gallery
                  window.location.href = `/artist/${recognition.mostSupportedArtist!.artistFid}`;
                }}
              >
                View Gallery →
              </button>
            </CardContent>
          </Card>
        )}

        {recognition.bestDiscovery && (
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-1">Best Discovery</p>
              <p className="font-semibold text-sm truncate">
                {recognition.bestDiscovery.collectorAddress.slice(0, 6)}...
                {recognition.bestDiscovery.collectorAddress.slice(-4)}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {recognition.bestDiscovery.description}
              </p>
              <button
                className="mt-2 text-xs text-primary hover:underline"
                onClick={() => {
                  // TODO: Navigate to collector profile
                  window.location.href = `/collector/${recognition.bestDiscovery!.collectorAddress}`;
                }}
              >
                See Collection →
              </button>
            </CardContent>
          </Card>
        )}
      </div>
      <div className="text-center">
        <button
          className="text-sm text-primary hover:underline"
          onClick={() => {
            window.location.href = "/leaderboards";
          }}
        >
          View All Leaderboards →
        </button>
      </div>
    </div>
  );
}

