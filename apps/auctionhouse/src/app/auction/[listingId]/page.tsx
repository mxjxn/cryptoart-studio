import { AuctionDetail } from '~/components/auctions/AuctionDetail';

interface AuctionPageProps {
  params: {
    listingId: string;
  };
}

export default function AuctionPage({ params }: AuctionPageProps) {
  const listingId = parseInt(params.listingId, 10);

  if (isNaN(listingId)) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Invalid Auction</h1>
        <p className="text-gray-600 dark:text-gray-400">
          The auction ID you're looking for doesn't exist.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <AuctionDetail listingId={listingId} />
    </div>
  );
}

