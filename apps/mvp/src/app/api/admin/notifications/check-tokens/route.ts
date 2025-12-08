import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '~/lib/server/admin';
import { checkNotificationTokens } from '~/lib/server/neynar-notifications';

/**
 * POST /api/admin/notifications/check-tokens
 * Check notification tokens registered with Neynar for specific FIDs
 * Admin only endpoint
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fids, adminAddress } = body;

    // Verify admin
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    // Validate input
    if (!fids || !Array.isArray(fids) || fids.length === 0) {
      return NextResponse.json(
        { error: 'FIDs array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate all FIDs are numbers
    const validFids = fids
      .map((fid: any) => {
        const num = typeof fid === 'string' ? parseInt(fid, 10) : fid;
        return isNaN(num) ? null : num;
      })
      .filter((fid): fid is number => fid !== null);

    if (validFids.length === 0) {
      return NextResponse.json(
        { error: 'No valid FIDs provided' },
        { status: 400 }
      );
    }

    // Check notification tokens
    const results = await checkNotificationTokens(validFids);

    console.log(`[check-tokens] Checked ${validFids.length} FIDs, found ${results.filter(r => r.hasToken).length} with tokens`);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        withTokens: results.filter(r => r.hasToken).length,
        withoutTokens: results.filter(r => !r.hasToken).length,
      },
    });
  } catch (error) {
    console.error('[check-tokens] Error checking notification tokens:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to check notification tokens',
      },
      { status: 500 }
    );
  }
}

