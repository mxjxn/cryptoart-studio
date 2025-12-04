import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const mekMonoUrl = `${baseUrl}/MEK-Mono.otf`;
  const mekSansUrl = `${baseUrl}/MEKSans-Regular.otf`;
  
  // Load fonts from URL (edge runtime compatible)
  const [mekMonoFont, mekSansFont] = await Promise.all([
    fetch(mekMonoUrl).then((res) => res.ok ? res.arrayBuffer() : null).catch(() => null),
    fetch(mekSansUrl).then((res) => res.ok ? res.arrayBuffer() : null).catch(() => null),
  ]);
  
  // Build fonts array
  const fonts: Array<{ name: string; data: ArrayBuffer; style: 'normal' | 'italic' }> = [];
  if (mekMonoFont) {
    fonts.push({ name: 'MEK-Mono', data: mekMonoFont, style: 'normal' });
  }
  if (mekSansFont) {
    fonts.push({ name: 'MEKSans-Regular', data: mekSansFont, style: 'normal' });
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
              fontFamily: 'MEKSans-Regular',
            }}
          >
            CRYPTOART.SOCIAL
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
      fonts: fonts.length > 0 ? fonts : undefined,
      headers: {
        // Following Farcaster miniapp-img reference implementation
        // Use stale-while-revalidate for better performance
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate',
      },
    }
  );
}

