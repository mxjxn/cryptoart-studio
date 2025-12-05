import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, errorLogs, eq } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

/**
 * POST /api/admin/errors/[id]/resolve
 * Mark an error as resolved
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    
    // Verify admin
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const db = getDatabase();
    
    await db
      .update(errorLogs)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: adminAddress?.toLowerCase(),
      })
      .where(eq(errorLogs.id, id));
    
    console.log(`[Admin] Error resolved: ${id} by ${adminAddress}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Error resolving error log:', error);
    return NextResponse.json(
      { error: 'Failed to resolve error' },
      { status: 500 }
    );
  }
}

