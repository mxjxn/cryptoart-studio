"use client";

import { useQuery } from "@tanstack/react-query";
import { useIsAdmin } from "~/hooks/useIsAdmin";
import { TransitionLink } from "~/components/TransitionLink";
import type { CurationData } from "@cryptoart/db";

interface ProfileGalleriesSectionProps {
  userAddress: string | null | undefined;
}

interface GalleryWithCount extends CurationData {
  itemCount: number;
}

export function ProfileGalleriesSection({ userAddress }: ProfileGalleriesSectionProps) {
  const { isAdmin } = useIsAdmin();

  // Only show for admins
  if (!isAdmin) {
    return null;
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["curation", userAddress, "published"],
    queryFn: async () => {
      if (!userAddress) return { galleries: [] };
      const response = await fetch(`/api/curation/user/${userAddress}`);
      if (!response.ok) throw new Error("Failed to fetch galleries");
      return response.json();
    },
    enabled: !!userAddress,
  });

  const galleries: GalleryWithCount[] = data?.galleries || [];

  if (isLoading) {
    return <p className="text-[#999999]">Loading galleries...</p>;
  }

  if (error) {
    return <p className="text-red-400">Error loading galleries</p>;
  }

  if (galleries.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[#999999] mb-4">No published galleries yet</p>
        <TransitionLink
          href="/curate"
          className="px-6 py-2.5 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors inline-block"
        >
          Create Your First Gallery
        </TransitionLink>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {galleries.map((gallery) => (
        <GalleryCard key={gallery.id} gallery={gallery} curatorAddress={userAddress || ""} />
      ))}
    </div>
  );
}

interface GalleryCardProps {
  gallery: GalleryWithCount;
  curatorAddress: string;
}

function GalleryCard({ gallery, curatorAddress }: GalleryCardProps) {
  const galleryUrl = gallery.slug
    ? `/gallery/${curatorAddress}/${gallery.slug}`
    : `/curate/${gallery.id}`;

  return (
    <TransitionLink
      href={galleryUrl}
      className="block bg-[#1a1a1a] border border-[#333333] rounded-lg overflow-hidden hover:border-[#666666] transition-colors"
    >
      <div className="p-4">
        <h3 className="text-base font-normal line-clamp-2 mb-2">{gallery.title}</h3>
        {gallery.description && (
          <p className="text-sm text-[#999999] line-clamp-2 mb-3">{gallery.description}</p>
        )}
        <div className="flex items-center justify-between text-xs text-[#666666]">
          <span>{gallery.itemCount} {gallery.itemCount === 1 ? "listing" : "listings"}</span>
          <span className="text-green-400">Published</span>
        </div>
      </div>
    </TransitionLink>
  );
}

