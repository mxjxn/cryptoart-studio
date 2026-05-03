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
  contractAddress: _contractAddress,
  tokenId: _tokenId,
  onBack,
  onSubmit,
  isSubmitting = false,
}: ERC721OffersOnlyPageProps) {
  const [understood, setUnderstood] = useState(false);

  return (
    <div className="space-y-6 font-space-grotesk">
      <div>
        <h2 className="mb-2 text-xl font-medium text-neutral-900">Offers only listing</h2>
        <p className="mb-4 text-sm text-neutral-600">This artwork will be listed for offers only.</p>
      </div>

      <div className="border border-neutral-200 bg-neutral-50 p-6">
        <p className="text-sm leading-relaxed text-neutral-800">
          You are putting this artwork in the cryptoart.social gallery for offers only — there will be no buy-now
          button.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
        />
        <span className="text-sm text-neutral-900">I understand</span>
      </label>

      <div className="flex gap-3 border-t border-neutral-200 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !understood}
          className="flex-1 bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Creating listing…" : "Create listing"}
        </button>
      </div>
    </div>
  );
}
