import { NextRequest, NextResponse } from 'next/server';
import { asc, getDatabase, homepageLayoutSections } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

type SectionType =
  | 'upcoming_auctions'
  | 'recently_concluded'
  | 'live_bids'
  | 'artist'
  | 'gallery'
  | 'collector'
  | 'listing'
  | 'featured_carousel'
  | 'custom_section';

const VALID_SECTION_TYPES: SectionType[] = [
  'upcoming_auctions',
  'recently_concluded',
  'live_bids',
  'artist',
  'gallery',
  'collector',
  'listing',
  'featured_carousel',
  'custom_section',
];

function isValidSectionType(value: string): value is SectionType {
  return VALID_SECTION_TYPES.includes(value as SectionType);
}

function validateConfig(sectionType: SectionType, config: any): { valid: boolean; error?: string } {
  if (!config) return { valid: true };

  switch (sectionType) {
    case 'artist':
    case 'collector':
      if (!config.name) return { valid: false, error: 'name is required' };
      break;
    case 'gallery':
      if (!config.stubname || !config.curatorAddress) {
        return { valid: false, error: 'curatorAddress and stubname are required' };
      }
      break;
    case 'listing':
      if (!config.listingId) return { valid: false, error: 'listingId is required' };
      break;
    case 'custom_section':
      if (!config.sectionId) return { valid: false, error: 'sectionId is required' };
      break;
    default:
      break;
  }

  return { valid: true };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const db = getDatabase();
    const sections = await db
      .select()
      .from(homepageLayoutSections)
      .orderBy(asc(homepageLayoutSections.displayOrder));

    return NextResponse.json({ sections });
  } catch (error) {
    console.error('[Admin Homepage Layout] GET error', error);
    return NextResponse.json({ error: 'Failed to fetch homepage layout' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminAddress, sectionType, title, description, config, isActive = true } = body;

    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    if (!isValidSectionType(sectionType)) {
      return NextResponse.json({ error: 'Invalid sectionType' }, { status: 400 });
    }

    const configValidation = validateConfig(sectionType, config);
    if (!configValidation.valid) {
      return NextResponse.json({ error: configValidation.error }, { status: 400 });
    }

    const db = getDatabase();
    const existing = await db.select().from(homepageLayoutSections).orderBy(asc(homepageLayoutSections.displayOrder));
    const maxOrder = existing.length > 0 ? Math.max(...existing.map((s) => s.displayOrder)) + 1 : 0;

    const [section] = await db
      .insert(homepageLayoutSections)
      .values({
        sectionType,
        title,
        description,
        config,
        displayOrder: maxOrder,
        isActive,
      })
      .returning();

    return NextResponse.json({ section });
  } catch (error) {
    console.error('[Admin Homepage Layout] POST error', error);
    return NextResponse.json({ error: 'Failed to create homepage section' }, { status: 500 });
  }
}




