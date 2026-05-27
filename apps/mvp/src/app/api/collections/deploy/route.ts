import { NextRequest, NextResponse } from 'next/server';
import { encodeFunctionData } from 'viem';
import { getDatabase, collectionDeployments } from '@cryptoart/db';
import { isAddress } from 'viem';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, symbol, chainId, royaltyReceiver, royaltyBPS, ownerAddress } = body;

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

    const factoryAddress = process.env[`CHAIN_${resolvedChainId}_FACTORY_ADDRESS`];
    if (!factoryAddress) {
      return NextResponse.json(
        { error: `No factory address configured for chain ${resolvedChainId}` },
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
    };

    return NextResponse.json({
      txRequest,
      deploymentId: deployment!.id,
    });
  } catch (error) {
    console.error('[POST /api/collections/deploy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare deployment' },
      { status: 500 },
    );
  }
}
