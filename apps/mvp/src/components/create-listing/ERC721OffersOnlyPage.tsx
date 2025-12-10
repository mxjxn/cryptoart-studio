"use client";

import { useState } from "react";

interface ERC721OffersOnlyPageProps {
  contractAddress: string;
  tokenId: string;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

/**
 * ERC721 Offers Only Confirmation Page
 */
export function ERC721OffersOnlyPage({
  contractAddress,
  tokenId,
  onBack,
  onSubmit,
  isSubmitting = false,
}: ERC721OffersOnlyPageProps) {
  const [understood, setUnderstood] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light mb-2">Offers Only Listing</h2>
        <p className="text-sm text-[#999999] mb-4">
          This artwork will be listed for offers only
        </p>
      </div>

      <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-6">
        <p className="text-white text-sm leading-relaxed">
          You are putting this artwork in the cryptoart social gallery for offers only - there will be no buy now button.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          className="mt-1 w-5 h-5 text-white bg-black border-[#333333] rounded focus:ring-2 focus:ring-white"
        />
        <span className="text-sm text-white">I understand</span>
      </label>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-[#333333]">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 bg-[#1a1a1a] border border-[#333333] text-white text-sm font-medium rounded hover:border-[#555555] transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !understood}
          className="flex-1 px-6 py-3 bg-white text-black text-sm font-medium rounded hover:bg-[#cccccc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Creating Listing..." : "Create Listing"}
        </button>
      </div>
    </div>
  );
}





