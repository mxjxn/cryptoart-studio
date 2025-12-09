import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

// Cache the image for 24 hours to improve performance
export const revalidate = 86400;
export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');

  // Create a fast, static opengraph image
  // If fid is provided, we could customize it, but for now we keep it static for speed
  return new ImageResponse(
    (
      <div tw="flex h-full w-full flex-col justify-center items-center relative bg-gradient-to-br from-purple-600 to-blue-600">
        {/* App Icon */}
        <div tw="flex w-32 h-32 rounded-full overflow-hidden mb-8 border-4 border-white shadow-2xl">
          <div tw="w-full h-full bg-white flex items-center justify-center">
            <div tw="text-6xl">🎨</div>
          </div>
        </div>
        
        {/* App Title */}
        <h1 tw="text-6xl text-white font-bold text-center mb-4">
          CryptoArt Studio
        </h1>
        
        {/* Subtitle */}
        <p tw="text-3xl text-white opacity-90 text-center mb-8">
          Creator Studio Toolbox
        </p>
        
        {/* Loading indicator */}
        <div tw="flex items-center space-x-2">
          <div tw="w-4 h-4 bg-white rounded-full"></div>
          <div tw="w-4 h-4 bg-white rounded-full"></div>
          <div tw="w-4 h-4 bg-white rounded-full"></div>
        </div>
        
        {/* Bottom text */}
        <p tw="text-2xl text-white opacity-70 mt-8">
          Powered by Neynar 🪐
        </p>
      </div>
    ),
    {
      width: 1200,
      height: 630, // Standard OG image size
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
      },
    }
  );
}