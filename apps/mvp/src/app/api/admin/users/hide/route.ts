import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDatabase, hiddenUsers } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

/**
 * POST /api/admin/users/hide
 * Hide a user from algorithmic feeds
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
    
    // Insert hidden user (ignore if already exists)
    await db.insert(hiddenUsers).values({
      userAddress: userAddress.toLowerCase(),
      hiddenBy: adminAddress.toLowerCase(),
    }).onConflictDoNothing();
    
    console.log(`[Admin] User hidden: ${userAddress} by ${adminAddress}`);
    
    // Invalidate auctions cache so hidden user listings are filtered out immediately
    revalidatePath('/');
    revalidatePath('/api/listings/browse');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Error hiding user:', error);
    return NextResponse.json(
      { error: 'Failed to hide user' },
      { status: 500 }
    );
  }
}

