import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, errorLogs, desc, eq, and, count } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

type ErrorType = 'all' | 'transaction_failed' | 'api_error' | 'subgraph_error' | 'contract_error' | 'webhook_error' | 'unknown';
type StatusFilter = 'all' | 'unresolved' | 'resolved';

/**
 * GET /api/admin/errors
 * Get error logs with filtering
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    const typeFilter = (searchParams.get('type') || 'all') as ErrorType;
    const statusFilter = (searchParams.get('status') || 'unresolved') as StatusFilter;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const db = getDatabase();
    
    // Build conditions
    const conditions = [];
    
    if (typeFilter !== 'all') {
      conditions.push(eq(errorLogs.type, typeFilter as any));
    }
    
    if (statusFilter === 'unresolved') {
      conditions.push(eq(errorLogs.resolved, false));
    } else if (statusFilter === 'resolved') {
      conditions.push(eq(errorLogs.resolved, true));
    }
    
    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(errorLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = countResult?.count ?? 0;
    
    // Get errors
    const errors = await db
      .select()
      .from(errorLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(errorLogs.createdAt))
      .limit(limit)
      .offset(offset);
    
    return NextResponse.json({
      errors,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Admin] Error fetching error logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch error logs' },
      { status: 500 }
    );
  }
}

