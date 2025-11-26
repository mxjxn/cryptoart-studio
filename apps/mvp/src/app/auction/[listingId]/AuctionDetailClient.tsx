"use client";

import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useAuction } from "~/hooks/useAuction";
import { ShareButton } from "~/components/ShareButton";

interface AuctionDetailClientProps {
  listingId: string;
}

export default function AuctionDetailClient({ listingId }: AuctionDetailClientProps) {
  const { address, isConnected } = useAccount();
  const { auction, loading } = useAuction(listingId);
  const [bidAmount, setBidAmount] = useState("");

  const handleBid = async () => {
    if (!isConnected || !bidAmount) {
      return;
    }
    // TODO: Implement bid functionality
    console.log("Place bid:", bidAmount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading auction...</p>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Auction not found</p>
      </div>
    );
  }

  const currentPrice = auction.currentPrice || auction.initialAmount;
  const endTime = parseInt(auction.endTime);
  const now = Math.floor(Date.now() / 1000);
  const isActive = endTime > now;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Auction #{listingId}
        </h1>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div className="aspect-square bg-gray-200 rounded-lg w-64" />
            <ShareButton
              url={typeof window !== 'undefined' ? window.location.href : ''}
              text={`Check out this auction!`}
            />
          </div>
          
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Details</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Reserve Price:</span>
                  <span className="font-medium">{formatEther(BigInt(auction.initialAmount))} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Bid:</span>
                  <span className="font-medium">{formatEther(BigInt(currentPrice))} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium">{isActive ? "Active" : "Ended"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Seller:</span>
                  <span className="font-medium font-mono text-xs">{auction.seller}</span>
                </div>
              </div>
            </div>

            {isActive && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Place Bid</h3>
                {!isConnected ? (
                  <p className="text-gray-600">Please connect your wallet to place a bid.</p>
                ) : (
                  <div className="space-y-4">
                    <input
                      type="number"
                      step="0.001"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder={`Min: ${formatEther(BigInt(currentPrice))} ETH`}
                    />
                    <button
                      onClick={handleBid}
                      className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors"
                    >
                      Place Bid
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

