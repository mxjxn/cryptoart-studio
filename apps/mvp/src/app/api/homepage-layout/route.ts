import { NextResponse } from 'next/server';
import { resolveHomepageSections } from '~/lib/server/homepage-layout';
import { withTimeout } from '~/lib/utils';

// Set route timeout to 15 seconds (homepage layout may need more time)
export const maxDuration = 15;

export async function GET() {
  try {
    // Wrap in timeout to prevent hanging if database is slow
    const sections = await withTimeout(
      resolveHomepageSections(false),
      10000, // 10 second timeout
      [] // Fallback to empty array on timeout
    );
    return NextResponse.json({ sections });
  } catch (error) {
    console.error('[Homepage Layout] GET error', error);
    // Return empty sections instead of error to prevent page crash
    return NextResponse.json({ sections: [] });
  }
}

