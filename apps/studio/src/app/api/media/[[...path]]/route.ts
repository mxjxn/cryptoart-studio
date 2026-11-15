import { NextRequest } from 'next/server';
import { handleMedia } from '~/lib/platform';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handle(req: NextRequest) {
  return handleMedia(req);
}

export const GET = handle;
export const POST = handle;
