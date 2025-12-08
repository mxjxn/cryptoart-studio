import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAdmin } from '~/lib/server/admin';

/**
 * POST /api/admin/featured-sections/[id]/invalidate
 * Invalidate cache for a specific section and homepage
 */
export async function POST(
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
    
    // Revalidate homepage and featured sections API
    revalidatePath('/');
    revalidatePath('/api/featured-sections');
    
    return NextResponse.json({
      success: true,
      message: 'Cache invalidated. Please hard refresh (Cmd+Shift+R or Ctrl+Shift+R) to bypass browser cache.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Error invalidating cache:', error);
    return NextResponse.json(
      { error: 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}

