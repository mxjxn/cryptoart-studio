"use client";

import { useQuery } from "@tanstack/react-query";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { FeaturedSectionGrid } from "~/components/FeaturedSectionGrid";
import { useUsername } from "~/hooks/useUsername";
import type { EnrichedAuctionData } from "~/lib/types";

interface PublicGalleryClientProps {
  curatorAddress: string;
  slug: string;
}

interface GalleryData {
  gallery: {
    id: string;
    curatorAddress: string;
    title: string;
    description?: string | null;
    slug?: string | null;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    listings: Array<EnrichedAuctionData & { displayOrder: number; notes?: string | null; addedAt: Date }>;
    itemCount: number;
  };
}

export default function PublicGalleryClient({ curatorAddress, slug }: PublicGalleryClientProps) {
  const { username: curatorUsername } = useUsername(curatorAddress);

  // Fetch gallery data
  const { data, isLoading, error } = useQuery({
    queryKey: ["curation", "slug", curatorAddress, slug],
    queryFn: async () => {
      const response = await fetch(`/api/curation/slug/${slug}?curatorAddress=${curatorAddress}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error("Gallery not found");
        throw new Error("Failed to fetch gallery");
      }
      return response.json() as Promise<GalleryData>;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <ProfileDropdown />
        </header>
        <div className="px-5 py-12 text-center">
          <p className="text-[#cccccc]">Loading gallery...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <ProfileDropdown />
        </header>
        <div className="px-5 py-12 text-center">
          <p className="text-red-400 mb-2">Gallery not found</p>
          <p className="text-[#999999] text-sm mb-4">
            {error instanceof Error ? error.message : "This gallery may be private or doesn't exist"}
          </p>
          <TransitionLink href="/" className="text-white hover:underline">
            ← Back to Home
          </TransitionLink>
        </div>
      </div>
    );
  }

  const gallery = data.gallery;
  const createdDate = new Date(gallery.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
        <Logo />
        <ProfileDropdown />
      </header>

      <div className="px-5 py-8">
        {/* Gallery Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light mb-3">{gallery.title}</h1>
          {gallery.description && (
            <p className="text-base text-[#cccccc] mb-4 max-w-3xl">{gallery.description}</p>
          )}

          {/* Curator Info */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-[#999999]">Curated by</span>
            <TransitionLink
              href={curatorUsername ? `/user/${curatorUsername}` : `/user/${curatorAddress}`}
              className="text-sm text-white hover:underline"
            >
              {curatorUsername || `${curatorAddress.slice(0, 6)}...${curatorAddress.slice(-4)}`}
            </TransitionLink>
            <span className="text-sm text-[#666666]">•</span>
            <span className="text-sm text-[#999999]">
              {gallery.itemCount} {gallery.itemCount === 1 ? "listing" : "listings"} • Created {createdDate}
            </span>
          </div>

          {/* Share Button */}
          <button
            onClick={() => {
              const url = window.location.href;
              navigator.clipboard.writeText(url);
              alert("Gallery URL copied to clipboard!");
            }}
            className="px-4 py-2 text-sm bg-[#1a1a1a] border border-[#333333] hover:border-[#666666] transition-colors"
          >
            Share Gallery
          </button>
        </div>

        {/* Listings Grid */}
        {gallery.listings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#999999]">This gallery is empty</p>
          </div>
        ) : (
          <FeaturedSectionGrid
            title=""
            description=""
            listings={gallery.listings}
          />
        )}
      </div>
    </div>
  );
}

