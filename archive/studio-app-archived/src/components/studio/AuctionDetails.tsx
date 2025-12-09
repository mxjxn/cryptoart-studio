"use client";

import { type AuctionData } from "@cryptoart/unified-indexer";
import { formatEther } from "viem";

interface AuctionDetailsProps {
  auction: AuctionData;
}

export function AuctionDetails({ auction }: AuctionDetailsProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "FINALIZED":
        return "bg-gray-100 text-gray-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getListingTypeLabel = (type: string) => {
    switch (type) {
      case "INDIVIDUAL_AUCTION":
        return "Auction";
      case "FIXED_PRICE":
        return "Fixed Price";
      case "DYNAMIC_PRICE":
        return "Dynamic Price";
      case "OFFERS_ONLY":
        return "Offers Only";
      default:
        return type;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Listing #{auction.listingId}
          </h3>
          <p className="text-sm text-gray-500">Seller: {auction.seller}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(auction.status)}`}>
            {auction.status}
          </span>
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
            {getListingTypeLabel(auction.listingType)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <p className="text-sm text-gray-500">Initial Amount</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatEther(BigInt(auction.initialAmount))} ETH
          </p>
        </div>

        {auction.currentPrice && (
          <div>
            <p className="text-sm text-gray-500">Current Price</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatEther(BigInt(auction.currentPrice))} ETH
            </p>
          </div>
        )}

        <div>
          <p className="text-sm text-gray-500">Available</p>
          <p className="text-lg font-semibold text-gray-900">
            {Number(auction.totalAvailable) - Number(auction.totalSold)} / {auction.totalAvailable}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Per Sale</p>
          <p className="text-lg font-semibold text-gray-900">
            {auction.totalPerSale}
          </p>
        </div>
      </div>

      {auction.tokenId && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">Token ID</p>
          <p className="text-sm font-mono text-gray-900">{auction.tokenId}</p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Token Address</p>
          <p className="text-sm font-mono text-gray-900 truncate">{auction.tokenAddress}</p>
        </div>
        <a
          href={`https://basescan.org/address/${auction.marketplace}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          View Marketplace →
        </a>
      </div>
    </div>
  );
}

