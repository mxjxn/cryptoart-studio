import { NextRequest } from 'next/server';
import { handleIdentity } from '~/lib/platform';

export const dynamic = 'force-dynamic';

async function handle(req: NextRequest) {
  return handleIdentity(req, '/api');
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
