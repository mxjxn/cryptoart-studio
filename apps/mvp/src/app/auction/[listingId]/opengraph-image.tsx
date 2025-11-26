import { ImageResponse } from "next/og";
import { getAuction } from "~/lib/subgraph";
import { formatEther } from "viem";

export const alt = "Auction";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const auction = await getAuction(listingId);

  if (!auction) {
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 60,
            background: 'linear-gradient(to bottom right, #8b5cf6, #6366f1)',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 'bold' }}>
            Auction Not Found
          </div>
        </div>
      ),
      {
        ...size,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
      }
    );
  }

  const currentPrice = auction.currentPrice || auction.initialAmount;
  const endTime = parseInt(auction.endTime);
  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = endTime > now ? endTime - now : 0;
  const hours = Math.floor(timeRemaining / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 60,
          background: 'linear-gradient(to bottom right, #8b5cf6, #6366f1)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          padding: '40px',
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 'bold', marginBottom: 20 }}>
          Auction #{listingId}
        </div>
        <div style={{ fontSize: 36, marginBottom: 30 }}>
          Current Bid: {formatEther(BigInt(currentPrice))} ETH
        </div>
        {timeRemaining > 0 && (
          <div style={{ fontSize: 32 }}>
            Time Remaining: {hours}h {minutes}m
          </div>
        )}
      </div>
    ),
    {
      ...size,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    }
  );
}

