import { NextRequest, NextResponse } from 'next/server';
import { configuredMarketplaceAddress } from '~/lib/marketplaceAddress';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const chainId = Number(new URL(req.url).searchParams.get('chainId'));
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return NextResponse.json({ error: 'chainId is required' }, { status: 400 });
  }

  const address = configuredMarketplaceAddress(chainId);
  if (!address) {
    return NextResponse.json(
      {
        error: `No auction house address for chain ${chainId}. Set CHAIN_${chainId}_MARKETPLACE_ADDRESS on the cryptoart-studio Vercel project.`,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ chainId, address });
}
