import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
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
        <div
          style={{
            fontSize: 80,
            marginBottom: 20,
          }}
        >
          🎨
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 'bold',
            marginBottom: 20,
          }}
        >
          MVP Auction
        </div>
        <div
          style={{
            fontSize: 36,
            opacity: 0.9,
          }}
        >
          Browse Auctions
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Following Farcaster miniapp-img reference implementation
        // Use stale-while-revalidate for better performance
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate',
      },
    }
  );
}

