"use client";

import { useState } from "react";
import { CopyButton } from "~/components/CopyButton";

export default function ShareTestPage() {
  const [listingId, setListingId] = useState("1");
  const [bidAmount, setBidAmount] = useState("0.1");
  const [salePrice, setSalePrice] = useState("0.5");
  const [currentBid, setCurrentBid] = useState("0.2");

  const baseUrl =
    process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

  const shareLinks = {
    "auction-created": `${baseUrl}/share/auction-created/${listingId}`,
    "bid-placed": `${baseUrl}/share/bid-placed/${listingId}?bidAmount=${bidAmount}`,
    "auction-won": `${baseUrl}/share/auction-won/${listingId}?salePrice=${salePrice}`,
    "outbid": `${baseUrl}/share/outbid/${listingId}?currentBid=${currentBid}`,
    "referral": `${baseUrl}/share/referral/${listingId}`,
  };

  const testLinks = [
    {
      name: "Auction Created",
      moment: "auction-created",
      description: "Share when a new auction is created",
      link: shareLinks["auction-created"],
      exampleListingId: "1",
    },
    {
      name: "Bid Placed",
      moment: "bid-placed",
      description: "Share when a user places a bid",
      link: shareLinks["bid-placed"],
      exampleListingId: "1",
      params: { bidAmount },
    },
    {
      name: "Auction Won",
      moment: "auction-won",
      description: "Share when a user wins an auction",
      link: shareLinks["auction-won"],
      exampleListingId: "1",
      params: { salePrice },
    },
    {
      name: "Outbid",
      moment: "outbid",
      description: "Share when a user gets outbid",
      link: shareLinks["outbid"],
      exampleListingId: "1",
      params: { currentBid },
    },
    {
      name: "Referral",
      moment: "referral",
      description: "Share any artwork as a referral",
      link: shareLinks["referral"],
      exampleListingId: "1",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Shareable Moments Test Page</h1>
        <p className="text-[#999999] mb-8">
          Test OG images and share links for all Tier 1 shareable moments
        </p>

        {/* Configuration */}
        <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#999999] mb-2">
                Listing ID
              </label>
              <input
                type="text"
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333333] rounded text-white"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm text-[#999999] mb-2">
                Bid Amount (ETH)
              </label>
              <input
                type="text"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333333] rounded text-white"
                placeholder="0.1"
              />
            </div>
            <div>
              <label className="block text-sm text-[#999999] mb-2">
                Sale Price (ETH)
              </label>
              <input
                type="text"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333333] rounded text-white"
                placeholder="0.5"
              />
            </div>
            <div>
              <label className="block text-sm text-[#999999] mb-2">
                Current Bid (ETH)
              </label>
              <input
                type="text"
                value={currentBid}
                onChange={(e) => setCurrentBid(e.target.value)}
                className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333333] rounded text-white"
                placeholder="0.2"
              />
            </div>
          </div>
        </div>

        {/* Share Links */}
        <div className="space-y-4">
          {testLinks.map((test) => (
            <div
              key={test.moment}
              className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-1">{test.name}</h3>
                  <p className="text-sm text-[#999999] mb-2">
                    {test.description}
                  </p>
                  {test.params && (
                    <div className="text-xs text-[#666666] mt-2">
                      Params: {JSON.stringify(test.params)}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <a
                    href={test.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white text-black text-sm font-medium hover:bg-[#e0e0e0] transition-colors rounded"
                  >
                    View OG Image
                  </a>
                  <a
                    href={test.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm font-medium hover:bg-[#2a2a2a] transition-colors rounded"
                  >
                    Test Redirect
                  </a>
                </div>
              </div>
              <div className="bg-[#1a1a1a] border border-[#333333] rounded p-3 flex items-center gap-2">
                <code className="text-xs text-[#cccccc] flex-1 break-all">
                  {test.link}
                </code>
                <CopyButton text={test.link} />
              </div>
              <div className="mt-4 text-xs text-[#666666]">
                <strong>Testing:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>
                    Click "View OG Image" to see the generated OG image (bot
                    mode)
                  </li>
                  <li>
                    Click "Test Redirect" to verify it redirects to the listing
                    page (user mode)
                  </li>
                  <li>
                    Use the link in a cast embed to test how it appears in
                    Farcaster
                  </li>
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Links Section */}
        <div className="mt-8 bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Test Links</h2>
          <div className="space-y-2">
            <div className="text-sm text-[#999999] mb-2">
              Copy these links to test in Farcaster cast composer or OG image
              preview tools:
            </div>
            {Object.entries(shareLinks).map(([moment, link]) => (
              <div
                key={moment}
                className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333333] rounded p-2"
              >
                <span className="text-xs text-[#666666] w-32 capitalize">
                  {moment.replace("-", " ")}:
                </span>
                <code className="text-xs text-[#cccccc] flex-1 break-all">
                  {link}
                </code>
                <CopyButton text={link} />
              </div>
            ))}
          </div>
        </div>

        {/* Testing Instructions */}
        <div className="mt-8 bg-blue-900/20 border border-blue-700/50 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Testing Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-[#cccccc]">
            <li>
              <strong>OG Image Testing:</strong> Open each link in a new tab. If
              you see an image, the OG generation is working. If you get
              redirected, you're being treated as a user (try with a bot
              user-agent).
            </li>
            <li>
              <strong>Redirect Testing:</strong> Click "Test Redirect" - you
              should be redirected to `/auction/{listingId}`.
            </li>
            <li>
              <strong>Farcaster Embed Testing:</strong> Copy a link and paste it
              into a Farcaster cast composer. The OG image should appear as a
              preview.
            </li>
            <li>
              <strong>Bot Testing:</strong> Use a tool like{" "}
              <a
                href="https://www.opengraph.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                opengraph.xyz
              </a>{" "}
              or curl with a bot user-agent to test OG image generation.
            </li>
            <li>
              <strong>Real Listing Testing:</strong> Replace the listingId with
              a real listing ID from your marketplace to see actual artwork and
              data.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

