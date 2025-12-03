import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const alt = "cryptoart.social";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  const fontPath = join(process.cwd(), "public", "MEK-Mono.otf");
  const fontData = await readFile(fontPath);

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #000000, #333333)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '80px',
          color: 'white',
          fontFamily: 'MEK-Mono',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 'bold',
              marginBottom: '24px',
              letterSpacing: '4px',
              lineHeight: '1.1',
            }}
          >
            cryptoart.social
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 'bold',
              letterSpacing: '2px',
              opacity: 1,
            }}
          >
            v1 — Auctionhouse & Marketplace
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'MEK-Mono',
          data: fontData,
          style: 'normal',
        },
      ],
      headers: {
        // Following Farcaster miniapp-img reference implementation
        // Use stale-while-revalidate for better performance
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate',
      },
    }
  );
}

