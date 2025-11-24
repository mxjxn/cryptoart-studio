"use client";

import { HeroSection } from "./HeroSection";
import { FeaturedArtistShowcase } from "./FeaturedArtistShowcase";
import { AuctionGrid } from "./AuctionGrid";
import { PoolPreview } from "./PoolPreview";
import { RecognitionRow } from "./RecognitionRow";
import { LandingFooter } from "./LandingFooter";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-16">
        {/* Hero Section */}
        <HeroSection />

        {/* Featured Artist Showcase */}
        <FeaturedArtistShowcase />

        {/* Featured 1/1 Auctions */}
        <AuctionGrid title="Featured 1/1 Auctions" type="featured" limit={5} />

        {/* Community Auctions (Unified Marketplace) */}
        <AuctionGrid title="All Auctions" type="active" limit={20} />

        {/* Recognition Row */}
        <RecognitionRow />

        {/* Featured NFT LPs */}
        <PoolPreview />

        {/* Footer */}
        <LandingFooter />
      </div>
    </div>
  );
}

