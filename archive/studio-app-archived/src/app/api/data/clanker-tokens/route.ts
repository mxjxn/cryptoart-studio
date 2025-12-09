import { NextRequest, NextResponse } from 'next/server';
import { validateMembershipMiddleware } from '~/lib/auth';
import { getClankerTokens } from '~/lib/clanker';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

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

    // Fetch Clanker tokens for the user
    const tokens = await getClankerTokens(fidNumber);

    return NextResponse.json({
      fid: fidNumber,
      tokens,
      totalTokens: tokens.length,
    });
  } catch (error) {
    console.error('Failed to fetch Clanker tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Clanker tokens. Please try again.' },
      { status: 500 }
    );
  }
}
