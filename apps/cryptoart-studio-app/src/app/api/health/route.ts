import { NextResponse } from 'next/server';
import { getDatabase, sql } from '@repo/db';

export async function GET() {
  try {
    // Basic health check
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'cryptoart-studio-app',
      version: process.env.npm_package_version || '1.0.0',
    };

    // Optional: Check database connection
    try {
      const db = getDatabase();
      // Simple query to verify database connection
      await db.execute(sql`SELECT 1`);
      return NextResponse.json({
        ...health,
        database: 'connected',
      });
    } catch (dbError) {
      // Database check failed, but service is still running
      return NextResponse.json({
        ...health,
        database: 'disconnected',
        warning: 'Database health check failed',
      }, { status: 503 });
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

