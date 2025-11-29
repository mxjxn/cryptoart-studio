"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/Button";
import { JoinModal } from "./JoinModal";

export function LandingFooter() {
  const [stats, setStats] = useState({
    collectors: 0,
    artists: 0,
    volume: "0",
  });
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/landing/stats");
        const data = await response.json();
        setStats({
          collectors: data.collectors || 0,
          artists: data.artists || 0,
          volume: data.volumeFormatted || "0",
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    }

    fetchStats();
  }, []);

  return (
    <>
      <footer className="py-12 border-t">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">Why Join Cryptoart.Social?</h3>
            <p className="text-gray-700 mb-2">
              Join a community of collectors discovering and supporting emerging artists.
            </p>
            <p className="text-gray-700 mb-2">
              Build your collection, curate galleries, and earn recognition for your taste.
            </p>
            <p className="text-gray-600 text-sm">
              This is about curation and discovery, not trading or flipping.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Button
                onClick={() => setShowJoinModal(true)}
                className="w-full max-w-none mb-2"
                variant="primary"
              >
                Join Cryptoart.Social
              </Button>
              <Button
                onClick={() => {
                  window.location.href = "/leaderboards";
                }}
                className="w-full max-w-none"
                variant="outline"
              >
                View All Leaderboards
              </Button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Community Stats</p>
              <div className="text-lg font-semibold">
                {stats.collectors} collectors | {stats.artists} artists | {stats.volume} ETH volume
              </div>
            </div>

            <div className="flex gap-4 text-sm">
              <a
                href="https://discord.gg/cryptoart"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Discord
              </a>
              <a
                href="https://t.me/cryptoart"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Telegram
              </a>
              <a
                href="https://warpcast.com/~/channel/cryptoart"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Farcaster
              </a>
            </div>
          </div>
        </div>
      </footer>

      {showJoinModal && (
        <JoinModal onClose={() => setShowJoinModal(false)} />
      )}
    </>
  );
}

