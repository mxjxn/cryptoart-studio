import { NextResponse } from 'next/server';

/**
 * Liveness probe for Docker / nginx / CI health checks.
 * Does not touch Postgres so a brief DB blip does not flap the container.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'mvp',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
