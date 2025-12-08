import { notFound } from "next/navigation";
import { OutbidSharePageClient } from "./OutbidSharePageClient";
import { getAuctionServer } from "~/lib/server/auction";

interface OutbidSharePageProps {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ currentBid?: string; referralId?: string }>;
}

export default async function OutbidSharePage({
  params,
  searchParams,
}: OutbidSharePageProps) {
  const { listingId } = await params;
  const { currentBid, referralId } = await searchParams;

  // Fetch auction data
  const auction = await getAuctionServer(listingId);

  if (!auction) {
    notFound();
  }

  // Render the share page
  return (
    <OutbidSharePageClient
      listingId={listingId}
      auction={auction}
      currentBid={currentBid}
      referralId={referralId}
    />
  );
}

