import type { Meta, StoryObj } from "@storybook/react";
import { formatEther } from "viem";
import { mockAuctions, KISMET_GRADIENTS } from "./mock-data";

/**
 * Extracted Bids strip row — the component currently inline in HomePageClientV2.
 * This story replicates the exact markup to develop fixes for:
 *   - #124: bidder identity (formatBidder is a pure truncator)
 *   - #126: thumbnail shows gradient placeholder instead of image
 *   - #128: artist name shows "—" (auction.artist is null)
 */

// ── Replicated helpers from HomePageClientV2 ──
function formatBidder(bidder: string | undefined, bidCount: number): string {
  if (!bidder || bidCount === 0) return "No bids";
  return `${bidder.slice(0, 6)}…${bidder.slice(-4)}`;
}

function formatListingEth(auction: { currentPrice?: string; initialAmount: string; erc20?: string }) {
  if (auction.currentPrice) {
    const val = parseFloat(formatEther(BigInt(auction.currentPrice)));
    return `${val.toFixed(val < 0.01 ? 4 : 2)} ETH`;
  }
  const val = parseFloat(formatEther(BigInt(auction.initialAmount)));
  return `${val.toFixed(val < 0.01 ? 4 : 2)} ETH`;
}

// ── The component under test ──
function BidsStripRow({ auction, index }: { auction: typeof mockAuctions[0]; index: number }) {
  return (
    <div
      className="flex items-center gap-2.5 p-2.5 md:border md:border-neutral-200"
      style={{ maxWidth: 400 }}
    >
      {/* Thumbnail — currently a gradient placeholder (#126) */}
      <div
        className="relative h-14 w-12 shrink-0 overflow-hidden bg-neutral-200"
        style={{ background: KISMET_GRADIENTS[Number(auction.tokenId ?? 1) % KISMET_GRADIENTS.length] }}
        aria-hidden
      />

      <div className="min-w-0 flex-1 font-space-grotesk text-sm">
        {/* Title */}
        <p className="truncate text-black">{auction.title || "Listing"}</p>
        {/* Artist — always shows "—" because auction.artist is null (#128) */}
        <p className="truncate text-black">by {auction.artist || "—"}</p>
      </div>

      <div className="shrink-0 text-right font-mek-mono text-sm text-black">
        {/* Price */}
        <p className="text-black">
          {formatListingEth({
            ...auction,
            currentPrice: auction.highestBid?.amount || auction.currentPrice,
          })}
        </p>
        {/* Bidder — truncated address instead of Farcaster handle (#124) */}
        <p className="text-black">{formatBidder(auction.highestBid?.bidder, auction.bidCount)}</p>
      </div>
    </div>
  );
}

function BidsStrip({ auctions }: { auctions: typeof mockAuctions }) {
  return (
    <div
      className="flex flex-col divide-y divide-neutral-200 md:grid md:grid-cols-2 md:gap-4 md:divide-y-0"
      style={{ background: "#fff", padding: 24 }}
    >
      {auctions.map((auction, index) => (
        <BidsStripRow key={`${auction.listingId}-${index}`} auction={auction} index={index} />
      ))}
    </div>
  );
}

const meta: Meta<typeof BidsStrip> = {
  title: "HomePage/Bids Strip",
  component: BidsStrip,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "light" },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof BidsStrip>;

export const WithBids: Story = {
  args: {
    auctions: mockAuctions,
  },
};

export const SingleRow: Story = {
  render: () => (
    <div style={{ background: "#fff", padding: 24, maxWidth: 400 }}>
      <BidsStripRow auction={mockAuctions[0]} index={0} />
    </div>
  ),
};

export const NoBids: Story = {
  args: {
    auctions: mockAuctions.map((a) => ({ ...a, bidCount: 0, highestBid: undefined })),
  },
};

/**
 * Fixed version — shows how the Bids strip should look with:
 * - Actual thumbnail image (#126 fix)
 * - Resolved artist name (#128 fix)
 * - Farcaster handle for bidder (#124 fix)
 */
export const FixedVersion: Story = {
  render: () => {
    const fixedAuctions = mockAuctions.map((a) => ({
      ...a,
      artist: a.seller === "0x10fc964ef70c8467cd8c53e9ed9347422adf96a8" ? "mxjxn.eth" : "artist_" + a.seller.slice(2, 6),
      highestBid: a.highestBid
        ? {
            ...a.highestBid,
            bidder: a.highestBid.bidder === "0xfa7f04469f2b1bfd97d0443fb98b3ad98522489c"
              ? "selenevisions"
              : a.highestBid.bidder.slice(0, 6) + "…",
          }
        : undefined,
    }));

    return (
      <div
        className="flex flex-col divide-y divide-neutral-200 md:grid md:grid-cols-2 md:gap-4 md:divide-y-0"
        style={{ background: "#fff", padding: 24 }}
      >
        {fixedAuctions.map((auction, index) => (
          <div
            key={`fixed-${auction.listingId}-${index}`}
            className="flex items-center gap-2.5 p-2.5 md:border md:border-neutral-200"
          >
            {/* Fixed: actual thumbnail image */}
            <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded">
              <img
                src={auction.thumbnailUrl || auction.image || ""}
                alt={auction.title || "Listing"}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1 font-space-grotesk text-sm">
              <p className="truncate text-black">{auction.title || "Listing"}</p>
              {/* Fixed: resolved artist name */}
              <p className="truncate text-black">by {auction.artist || "—"}</p>
            </div>

            <div className="shrink-0 text-right font-mek-mono text-sm text-black">
              <p>
                {formatListingEth({
                  ...auction,
                  currentPrice: auction.highestBid?.amount || auction.currentPrice,
                })}
              </p>
              {/* Fixed: Farcaster handle instead of truncated address */}
              <p>{auction.highestBid?.bidder || "No bids"}</p>
            </div>
          </div>
        ))}
      </div>
    );
  },
};
