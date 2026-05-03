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
  const cardClass =
    "border border-neutral-200 bg-neutral-50 p-6 text-left font-space-grotesk transition-colors hover:border-neutral-400 hover:bg-white";

  return (
    <div className="space-y-6 font-space-grotesk">
      <div>
        <h2 className="mb-2 text-xl font-medium text-neutral-900">Choose listing type</h2>
        <p className="mb-4 text-sm text-neutral-600">Select how you want to sell this artwork.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button type="button" onClick={() => onSelectType("AUCTION")} className={cardClass}>
          <h3 className="mb-2 text-lg font-medium text-neutral-900">Auction</h3>
          <p className="text-sm text-neutral-600">
            Start an auction with a reserve price. Highest bidder wins.
          </p>
        </button>

        <button type="button" onClick={() => onSelectType("FIXED_PRICE")} className={cardClass}>
          <h3 className="mb-2 text-lg font-medium text-neutral-900">Fixed price</h3>
          <p className="text-sm text-neutral-600">Set a fixed price. First buyer pays the listed price.</p>
        </button>

        <button type="button" onClick={() => onSelectType("OFFERS_ONLY")} className={cardClass}>
          <h3 className="mb-2 text-lg font-medium text-neutral-900">Offers only</h3>
          <p className="text-sm text-neutral-600">Accept offers only. No buy-now button.</p>
        </button>
      </div>

      <div className="border-t border-neutral-200 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
        >
          Back
        </button>
      </div>
    </div>
  );
}
