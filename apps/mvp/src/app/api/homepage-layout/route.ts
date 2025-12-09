import { NextResponse } from 'next/server';
import { resolveHomepageSections } from '~/lib/server/homepage-layout';

export async function GET() {
  try {
    const sections = await resolveHomepageSections(false);
    return NextResponse.json({ sections });
  } catch (error) {
    console.error('[Homepage Layout] GET error', error);
    return NextResponse.json({ error: 'Failed to fetch homepage layout' }, { status: 500 });
  }
}

