import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const chainIdParam = req.nextUrl.searchParams.get('chainId');
  const chainId = chainIdParam ? Number(chainIdParam) : 8453;
  if (!Number.isFinite(chainId)) {
    return NextResponse.json({ error: 'Invalid chainId' }, { status: 400 });
  }

  const erc721 = Boolean(process.env[`CHAIN_${chainId}_FACTORY_ADDRESS`]);
  const erc1155 = Boolean(process.env[`CHAIN_${chainId}_ERC1155_FACTORY_ADDRESS`]);

  return NextResponse.json({
    chainId,
    standards: {
      erc721,
      erc1155,
    },
  });
}
