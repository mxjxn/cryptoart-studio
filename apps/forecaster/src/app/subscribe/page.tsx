"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { useTier } from "@/hooks/useTier";
import { Search, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";

// TODO: This would come from an API/indexer in production
const FEATURED_SUBSCRIPTIONS = [
  {
    address: "0x1234567890123456789012345678901234567890",
    name: "Premium Content Access",
    description: "Get exclusive access to premium content and updates",
  },
  {
    address: "0x2345678901234567890123456789012345678901",
    name: "Community Membership",
    description: "Join our exclusive community with special perks",
  },
  {
    address: "0x3456789012345678901234567890123456789012",
    name: "Creator Support",
    description: "Support your favorite creator and get rewards",
  },
];

export default function SubscribePage() {
  const { address, isConnected } = useAccount();
  const [searchQuery, setSearchQuery] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Browse Subscriptions
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Discover and subscribe to your favorite creators
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by name or contract address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowCustom(!showCustom)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Custom
            </Button>
          </div>

          {showCustom && (
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
              <h3 className="font-semibold mb-2">Enter Contract Address</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="0x..."
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                />
                <Link href={`/subscribe/${customAddress}`}>
                  <Button disabled={!customAddress.startsWith("0x")}>
                    View
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-blue-800 dark:text-blue-200">
              💡 Connect your wallet to subscribe and manage your subscriptions
            </p>
          </div>
        )}

        {/* Featured Subscriptions */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Featured Subscriptions
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURED_SUBSCRIPTIONS.filter((sub) =>
              searchQuery
                ? sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  sub.address.toLowerCase().includes(searchQuery.toLowerCase())
                : true
            ).map((subscription) => (
              <FeaturedSubscriptionCard
                key={subscription.address}
                {...subscription}
              />
            ))}
          </div>

          {FEATURED_SUBSCRIPTIONS.filter((sub) =>
            searchQuery
              ? sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                sub.address.toLowerCase().includes(searchQuery.toLowerCase())
              : true
          ).length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No subscriptions found matching &quot;{searchQuery}&quot;
              </p>
            </div>
          )}
        </div>

        {/* My Subscriptions Link */}
        {isConnected && (
          <div className="mt-12 text-center">
            <Link href="/my-subscriptions">
              <Button variant="outline" size="lg">
                View My Subscriptions
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturedSubscriptionCard({
  address,
  name,
  description,
}: {
  address: string;
  name: string;
  description: string;
}) {
  // In production, fetch tier info here
  const mockTier = {
    tierId: 0,
    periodDurationSeconds: 30 * 86400,
    maxSupply: 1000,
    currentSupply: 250,
    pricePerPeriod: BigInt("10000000000000000"), // 0.01 ETH
    initialMintPrice: BigInt("10000000000000000"),
    rewardBasisPoints: 2000,
    paused: false,
    transferrable: true,
  };

  return (
    <SubscriptionCard
      contractAddress={address}
      contractName={name}
      tier={mockTier}
    />
  );
}
