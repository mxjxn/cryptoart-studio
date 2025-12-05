import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, hiddenUsers, desc } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

/**
 * GET /api/admin/users/hidden
 * Get list of hidden users
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const db = getDatabase();
    
    const users = await db
      .select()
      .from(hiddenUsers)
      .orderBy(desc(hiddenUsers.hiddenAt));
    
    return NextResponse.json({ users });
  } catch (error) {
    console.error('[Admin] Error fetching hidden users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hidden users' },
      { status: 500 }
    );
  }
}

