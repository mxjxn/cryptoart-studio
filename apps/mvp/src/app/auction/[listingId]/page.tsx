import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import AuctionDetailClient from "./AuctionDetailClient";

interface AuctionPageProps {
  params: Promise<{ listingId: string }>;
}

export async function generateMetadata({ params }: AuctionPageProps): Promise<Metadata> {
  const { listingId } = await params;
  const auctionImageUrl = process.env.NEXT_PUBLIC_URL
    ? `${process.env.NEXT_PUBLIC_URL}/auction/${listingId}/opengraph-image`
    : `/auction/${listingId}/opengraph-image`;

  return {
    title: `Auction #${listingId} | ${APP_NAME}`,
    description: "View auction details and place bids",
    other: {
      "fc:miniapp": JSON.stringify(getMiniAppEmbedMetadata(auctionImageUrl)),
      "fc:frame": JSON.stringify(getMiniAppEmbedMetadata(auctionImageUrl)),
    },
  };
}

export default async function AuctionPage({ params }: AuctionPageProps) {
  const { listingId } = await params;
  return <AuctionDetailClient listingId={listingId} />;
}

