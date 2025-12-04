import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const fontUrl = `${baseUrl}/MEK-Mono.otf`;
  
  // Load font from URL (edge runtime compatible)
  let fontData: ArrayBuffer | null = null;
  try {
    const fontResponse = await fetch(fontUrl);
    if (!fontResponse.ok) {
      throw new Error(`Failed to fetch font: ${fontResponse.statusText}`);
    }
    fontData = await fontResponse.arrayBuffer();
  } catch (error) {
    console.error(`[OG Image] Error loading font:`, error);
    // Continue without font - will use default system font
  }

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
      width: 1200,
      height: 630,
      fonts: fontData ? [
        {
          name: 'MEK-Mono',
          data: fontData,
          style: 'normal',
        },
      ] : undefined,
      headers: {
        // Following Farcaster miniapp-img reference implementation
        // Use stale-while-revalidate for better performance
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate',
      },
    }
  );
}

