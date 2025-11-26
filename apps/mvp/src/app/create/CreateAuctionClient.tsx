"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";

export default function CreateAuctionClient() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [formData, setFormData] = useState({
    nftContract: "",
    tokenId: "",
    reservePrice: "",
    startTime: "",
    endTime: "",
    minIncrementBPS: "500",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      alert("Please connect your wallet");
      return;
    }
    // TODO: Implement auction creation
    console.log("Create auction:", formData);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Create Auction</h1>

        {!isConnected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">Please connect your wallet to create an auction.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              NFT Contract Address
            </label>
            <input
              type="text"
              value={formData.nftContract}
              onChange={(e) => setFormData({ ...formData, nftContract: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="0x..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token ID
            </label>
            <input
              type="text"
              value={formData.tokenId}
              onChange={(e) => setFormData({ ...formData, tokenId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reserve Price (ETH)
            </label>
            <input
              type="number"
              step="0.001"
              value={formData.reservePrice}
              onChange={(e) => setFormData({ ...formData, reservePrice: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="0.1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Time (Unix timestamp, optional)
            </label>
            <input
              type="datetime-local"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Time (Unix timestamp)
            </label>
            <input
              type="datetime-local"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Increment (basis points, e.g., 500 = 5%)
            </label>
            <input
              type="number"
              value={formData.minIncrementBPS}
              onChange={(e) => setFormData({ ...formData, minIncrementBPS: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={!isConnected}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Create Auction
          </button>
        </form>
      </div>
    </div>
  );
}

