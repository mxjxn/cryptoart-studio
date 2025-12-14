import { NextResponse } from 'next/server';
import { resolveHomepageSections } from '~/lib/server/homepage-layout';
import { withTimeout } from '~/lib/utils';

// Set route timeout to 15 seconds (homepage layout may need more time)
export const maxDuration = 15;

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Wrap in timeout to prevent hanging if database is slow
    const sections = await withTimeout(
      resolveHomepageSections(false),
      10000, // 10 second timeout
      [] // Fallback to empty array on timeout
    );
    const response = NextResponse.json({ sections });
    // Add cache control headers to prevent browser/CDN caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  } catch (error) {
    console.error('[Homepage Layout] GET error', error);
    // Return empty sections instead of error to prevent page crash
    const response = NextResponse.json({ sections: [] });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  }
}

