import { ImageResponse } from "next/og";

export const alt = "MVP Auction";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
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
      ...size,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    }
  );
}

