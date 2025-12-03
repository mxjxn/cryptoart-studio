import { ImageResponse } from "next/og";

export const alt = "cryptoart.social";
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
          background: 'linear-gradient(to bottom right, #000000, #333333)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '40px',
          color: 'white',
          fontFamily: 'system-ui, -apple-system',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '30px',
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 'bold',
              marginBottom: '10px',
              letterSpacing: '2px',
            }}
          >
            CRYPTOART.SOCIAL
          </div>
          <div
            style={{
              fontSize: 28,
              opacity: 0.9,
            }}
          >
            Buy and sell art onchain, on the timeline.
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '40px',
            flex: 1,
          }}
        >
          {/* Left Column */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              gap: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}
              >
                FEATURES:
              </div>
              <div
                style={{
                  fontSize: 16,
                  lineHeight: '1.4',
                  opacity: 0.85,
                }}
              >
                Live auctions with real-time bidding • Fixed-price listings for instant purchase • Offers-only sales for negotiation • Native notifications for bids, outbids, wins • Cast embeds for social sharing • Multi-currency support (ETH + ERC20) • Artist and collector profiles • Membership access for creators
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}
              >
                FOR ARTISTS:
              </div>
              <div
                style={{
                  fontSize: 18,
                  lineHeight: '1.4',
                  opacity: 0.85,
                }}
              >
                List NFTs. Reach collectors on Farcaster. Build your audience.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}
              >
                FOR COLLECTORS:
              </div>
              <div
                style={{
                  fontSize: 18,
                  lineHeight: '1.4',
                  opacity: 0.85,
                }}
              >
                Discover art. Bid publicly. Signal your patronage on the timeline.
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              gap: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}
              >
                HOW IT WORKS:
              </div>
              <div
                style={{
                  fontSize: 18,
                  lineHeight: '1.5',
                  opacity: 0.85,
                }}
              >
                Connect wallet • Browse or create listings • Bid, buy, or make offers • Receive live notifications • Build your collection
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginTop: 'auto',
                paddingTop: '20px',
                borderTop: '2px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  letterSpacing: '1px',
                }}
              >
                FARCASTER NATIVE
              </div>
              <div
                style={{
                  fontSize: 20,
                  opacity: 0.9,
                }}
              >
                Built for the timeline. Fully on-chain.
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        // Following Farcaster miniapp-img reference implementation
        // Use stale-while-revalidate for better performance
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate',
      },
    }
  );
}

