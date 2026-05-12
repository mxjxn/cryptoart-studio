import { NextResponse } from 'next/server';
import { getRequestSiteUrl } from '~/lib/server/request-site-url';
import { getFarcasterDomainManifest } from '~/lib/utils';

export async function GET() {
  try {
    const siteUrl = await getRequestSiteUrl();
    const config = await getFarcasterDomainManifest({ siteUrl });
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error generating farcaster manifest:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

