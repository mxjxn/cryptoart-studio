import { NextRequest, NextResponse } from 'next/server';
import { and, eq, getDatabase, homepageLayoutSections } from '@cryptoart/db';
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { adminAddress, ...updates } = body;

    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    if (updates.sectionType && !validateType(updates.sectionType)) {
      return NextResponse.json({ error: 'Invalid sectionType' }, { status: 400 });
    }

    if (updates.config && updates.sectionType) {
      const validation = validateConfig(updates.sectionType, updates.config);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    const db = getDatabase();
    const [section] = await db
      .update(homepageLayoutSections)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(homepageLayoutSections.id, id))
      .returning();

    return NextResponse.json({ section });
  } catch (error) {
    console.error('[Admin Homepage Layout] PATCH error', error);
    return NextResponse.json({ error: 'Failed to update homepage section' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');

    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const db = getDatabase();
    await db.delete(homepageLayoutSections).where(eq(homepageLayoutSections.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Homepage Layout] DELETE error', error);
    return NextResponse.json({ error: 'Failed to delete homepage section' }, { status: 500 });
  }
}

function validateType(value: string): value is SectionType {
  return [
    'upcoming_auctions',
    'recently_concluded',
    'live_bids',
    'artist',
    'gallery',
    'collector',
    'listing',
    'featured_carousel',
    'custom_section',
  ].includes(value as SectionType);
}




