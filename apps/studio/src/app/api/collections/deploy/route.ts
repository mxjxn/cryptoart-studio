import { NextRequest, NextResponse } from 'next/server';
import { encodeFunctionData, isAddress } from 'viem';
import { getDatabase, collectionDeployments } from '@cryptoart/db';

const FACTORY_ABI = [
  {
    name: 'createCollection',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'royaltyReceiver', type: 'address' },
      { name: 'royaltyBPS', type: 'uint16' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

function resolveFactoryAddress(chainId: number, tokenStandard: 'erc721' | 'erc1155') {
  if (tokenStandard === 'erc1155') {
    return process.env[`CHAIN_${chainId}_ERC1155_FACTORY_ADDRESS`] ?? null;
  }
  return process.env[`CHAIN_${chainId}_FACTORY_ADDRESS`] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, symbol, chainId, royaltyReceiver, royaltyBPS, ownerAddress } = body;
    const tokenStandard: 'erc721' | 'erc1155' =
      body.tokenStandard === 'erc1155' ? 'erc1155' : 'erc721';

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
      return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }
    if (!ownerAddress || !isAddress(ownerAddress)) {
      return NextResponse.json({ error: 'Valid ownerAddress is required' }, { status: 400 });
    }

    const resolvedChainId = chainId ?? 8453;
    const factoryAddress = resolveFactoryAddress(resolvedChainId, tokenStandard);
    if (!factoryAddress) {
      const envKey =
        tokenStandard === 'erc1155'
          ? `CHAIN_${resolvedChainId}_ERC1155_FACTORY_ADDRESS`
          : `CHAIN_${resolvedChainId}_FACTORY_ADDRESS`;
      return NextResponse.json(
        { error: `No ${tokenStandard} factory configured (${envKey})` },
        { status: 400 },
      );
    }

    const receiver = (royaltyReceiver as string | undefined) ?? ownerAddress;
    if (!isAddress(receiver)) {
      return NextResponse.json({ error: 'Invalid royaltyReceiver address' }, { status: 400 });
    }

    const bps = typeof royaltyBPS === 'number' ? royaltyBPS : 0;
    if (bps < 0 || bps > 10000) {
      return NextResponse.json({ error: 'royaltyBPS must be 0-10000' }, { status: 400 });
    }

    const data = encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: 'createCollection',
      args: [name.trim(), symbol.trim(), receiver as `0x${string}`, bps],
    });

    const db = getDatabase();
    const [deployment] = await db
      .insert(collectionDeployments)
      .values({
        chainId: resolvedChainId,
        txHash: `pending-${Date.now()}`,
        fromAddress: ownerAddress.toLowerCase(),
        toAddress: factoryAddress,
        name: name.trim(),
        symbol: symbol.trim(),
        royaltyReceiver: receiver.toLowerCase(),
        royaltyBPS: bps,
        status: 'pending',
      })
      .returning();

    const txRequest = {
      to: factoryAddress,
      data,
      from: ownerAddress,
      chainId: resolvedChainId,
      tokenStandard,
    };

    return NextResponse.json({
      txRequest,
      deploymentId: deployment!.id,
      tokenStandard,
    });
  } catch (error) {
    console.error('[POST /api/collections/deploy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare deployment' },
      { status: 500 },
    );
  }
}
