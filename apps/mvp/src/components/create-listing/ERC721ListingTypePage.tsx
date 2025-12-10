"use client";

interface ERC721ListingTypePageProps {
  onSelectType: (type: "AUCTION" | "FIXED_PRICE" | "OFFERS_ONLY") => void;
  onBack: () => void;
}

/**
 * ERC721 Listing Type Selection Page
 */
export function ERC721ListingTypePage({
  onSelectType,
  onBack,
}: ERC721ListingTypePageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light mb-2">Choose Listing Type</h2>
        <p className="text-sm text-[#999999] mb-4">
          Select how you want to sell this artwork
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Auction Option */}
        <button
          type="button"
          onClick={() => onSelectType("AUCTION")}
          className="p-6 rounded-lg border border-[#333333] bg-[#0a0a0a] hover:border-[#555555] transition-colors text-left"
        >
          <h3 className="text-lg font-medium text-white mb-2">Auction</h3>
          <p className="text-sm text-[#999999]">
            Start an auction with a reserve price. Highest bidder wins.
          </p>
        </button>

        {/* Fixed Price Option */}
        <button
          type="button"
          onClick={() => onSelectType("FIXED_PRICE")}
          className="p-6 rounded-lg border border-[#333333] bg-[#0a0a0a] hover:border-[#555555] transition-colors text-left"
        >
          <h3 className="text-lg font-medium text-white mb-2">Fixed Price</h3>
          <p className="text-sm text-[#999999]">
            Set a fixed price. First buyer pays the listed price.
          </p>
        </button>

        {/* Offers Only Option */}
        <button
          type="button"
          onClick={() => onSelectType("OFFERS_ONLY")}
          className="p-6 rounded-lg border border-[#333333] bg-[#0a0a0a] hover:border-[#555555] transition-colors text-left"
        >
          <h3 className="text-lg font-medium text-white mb-2">Offers Only</h3>
          <p className="text-sm text-[#999999]">
            Accept offers only. No buy now button.
          </p>
        </button>
      </div>

      {/* Back Button */}
      <div className="pt-4 border-t border-[#333333]">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 bg-[#1a1a1a] border border-[#333333] text-white text-sm font-medium rounded hover:border-[#555555] transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}






