import { NextRequest, NextResponse } from 'next/server';
import { validateMembershipMiddleware } from '~/lib/auth';
import { getDatabase, airdropHistory, eq, desc } from '@repo/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!fid) {
      return NextResponse.json(
        { error: 'FID parameter is required' },
        { status: 400 }
      );
    }

    const fidNumber = parseInt(fid, 10);
    if (isNaN(fidNumber)) {
      return NextResponse.json(
        { error: 'Invalid FID parameter' },
        { status: 400 }
      );
    }

    // Validate CryptoArt membership
    const membershipValidation = await validateMembershipMiddleware(fidNumber);
    if (!membershipValidation.valid) {
      return NextResponse.json(
        { error: membershipValidation.error },
        { status: 403 }
      );
    }

    const db = getDatabase();

    // Get airdrop history for the creator
    const airdrops = await db
      .select()
      .from(airdropHistory)
      .where(eq(airdropHistory.creatorFid, fidNumber))
      .orderBy(desc(airdropHistory.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalCount = await db
      .select({ count: airdropHistory.id })
      .from(airdropHistory)
      .where(eq(airdropHistory.creatorFid, fidNumber));

    return NextResponse.json({
      airdrops,
      pagination: {
        limit,
        offset,
        total: totalCount.length,
        hasMore: offset + limit < totalCount.length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch airdrop history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch airdrop history. Please try again.' },
      { status: 500 }
    );
  }
}
