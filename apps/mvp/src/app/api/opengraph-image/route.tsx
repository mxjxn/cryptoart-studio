import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const mekMonoUrl = `${baseUrl}/MEK-Mono.otf`;
  const mekSansUrl = `${baseUrl}/MEKSans-Regular.otf`;
  const logoUrl = `${baseUrl}/cryptoart-logo-wgmeets.png`;
  
  // Load fonts from URL (edge runtime compatible)
  const [mekMonoFont, mekSansFont] = await Promise.all([
    fetch(mekMonoUrl).then((res) => res.ok ? res.arrayBuffer() : null).catch(() => null),
    fetch(mekSansUrl).then((res) => res.ok ? res.arrayBuffer() : null).catch(() => null),
  ]);

  // Load logo (edge runtime compatible)
  let logoDataUrl: string | null = null;
  try {
    const logoRes = await fetch(logoUrl);
    if (logoRes.ok) {
      const buffer = Buffer.from(await logoRes.arrayBuffer());
      const base64 = buffer.toString("base64");
      logoDataUrl = `data:image/png;base64,${base64}`;
    }
  } catch {
    // ignore; will fall back to direct URL
  }
  
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
          <img
            src={logoDataUrl || logoUrl}
            alt="Cryptoart"
            width={600}
            height={120}
            style={{
              height: '120px',
              width: 'auto',
              marginBottom: '24px',
              objectFit: 'contain',
            }}
          />
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

