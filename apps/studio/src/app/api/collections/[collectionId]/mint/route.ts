import { NextRequest, NextResponse } from 'next/server';
import { encodeFunctionData, isAddress } from 'viem';
import { eq } from 'drizzle-orm';
import { getDatabase, collections } from '@cryptoart/db';

const ERC721_MINT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'uri', type: 'string' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const ERC1155_MINT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'maxSupply_', type: 'uint256' },
      { name: 'tokenURI_', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  try {
    const { collectionId } = await params;
    const body = await req.json();
    const {
      to,
      metadataUri,
      uploadJobId,
      amount = 1,
      maxSupply = 0,
    } = body as {
      to?: string;
      metadataUri?: string;
      uploadJobId?: string;
      amount?: number;
      maxSupply?: number;
    };

    if (!to || !isAddress(to)) {
      return NextResponse.json({ error: 'Valid to address is required' }, { status: 400 });
    }
    if (!metadataUri || typeof metadataUri !== 'string') {
      return NextResponse.json(
        { error: 'Confirmed metadataUri is required (ar://… or https gateway)' },
        { status: 400 },
      );
    }

    const db = getDatabase();
    const rows = await db.select().from(collections).where(eq(collections.id, collectionId)).limit(1);
    const collection = rows[0];
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    const standard = (collection.tokenStandard as 'erc721' | 'erc1155' | null) ?? 'erc721';
    const contractAddress = collection.contractAddress as `0x${string}`;

    let data: `0x${string}`;
    if (standard === 'erc1155') {
      const qty = Number(amount);
      const cap = Number(maxSupply);
      if (!Number.isFinite(qty) || qty < 1) {
        return NextResponse.json({ error: 'amount must be >= 1' }, { status: 400 });
      }
      if (!Number.isFinite(cap) || cap < 0) {
        return NextResponse.json({ error: 'maxSupply must be >= 0 (0 = open)' }, { status: 400 });
      }
      data = encodeFunctionData({
        abi: ERC1155_MINT_ABI,
        functionName: 'mint',
        args: [to as `0x${string}`, BigInt(qty), BigInt(cap), metadataUri],
      });
    } else {
      data = encodeFunctionData({
        abi: ERC721_MINT_ABI,
        functionName: 'mint',
        args: [to as `0x${string}`, metadataUri],
      });
    }

    return NextResponse.json({
      txRequest: {
        to: contractAddress,
        data,
        from: to,
        chainId: collection.chainId,
      },
      tokenStandard: standard,
      uploadJobId: uploadJobId ?? null,
      metadataUri,
    });
  } catch (error) {
    console.error('[POST /api/collections/:id/mint] Error:', error);
    return NextResponse.json({ error: 'Failed to prepare mint' }, { status: 500 });
  }
}
