import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getDatabase, hiddenUsers, eq } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

/**
 * POST /api/admin/users/unhide
 * Unhide a user (restore their listings to algorithmic feeds)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userAddress, adminAddress } = body;
    
    // Validate input
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/i.test(userAddress)) {
      return NextResponse.json(
        { error: 'Valid user address is required' },
        { status: 400 }
      );
    }
    
    // Verify admin
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const db = getDatabase();
    
    // Delete hidden user entry
    await db
      .delete(hiddenUsers)
      .where(eq(hiddenUsers.userAddress, userAddress.toLowerCase()));
    
    console.log(`[Admin] User unhidden: ${userAddress} by ${adminAddress}`);
    
    // Invalidate auctions cache so unhidden user listings appear immediately
    revalidateTag('auctions', 'page');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Error unhiding user:', error);
    return NextResponse.json(
      { error: 'Failed to unhide user' },
      { status: 500 }
    );
  }
}

